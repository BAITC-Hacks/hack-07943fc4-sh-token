from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd

from .diagnostics import node_signals

ROLES = {
    "consolidator",
    "transit",
    "distributor",
    "terminal",
    "coordinator",
    "peripheral",
}

ROLE_NAMES_RU = {
    "consolidator": "консолидация",
    "transit": "транзит",
    "distributor": "распределение",
    "terminal": "конечные получатели",
    "coordinator": "координация",
    "peripheral": "периферия",
}

EDGE_COLUMNS = {"src", "dst", "sum_kzt", "n_tx", "depth"}
NODE_COLUMNS = {"gid", "depth", "is_seed"}
TX_COLUMNS = {"src", "dst", "date", "sum_kzt"}


def load_data(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load and validate the three input parquet tables."""
    paths = {
        "edges": data_dir / "edges.parquet",
        "nodes": data_dir / "nodes.parquet",
        "transactions": data_dir / "transactions.parquet",
    }
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing input files: {', '.join(missing)}")

    edges = pd.read_parquet(paths["edges"])
    nodes = pd.read_parquet(paths["nodes"])
    transactions = pd.read_parquet(paths["transactions"])
    transactions["date"] = pd.to_datetime(transactions["date"])

    _require_columns(edges, EDGE_COLUMNS, "edges.parquet")
    _require_columns(nodes, NODE_COLUMNS, "nodes.parquet")
    _require_columns(transactions, TX_COLUMNS, "transactions.parquet")

    if nodes["gid"].duplicated().any():
        raise ValueError("nodes.parquet contains duplicate gid values")
    if edges[["src", "dst"]].duplicated().any():
        raise ValueError("edges.parquet contains duplicate src/dst pairs")

    known = set(nodes["gid"].astype(int))
    referenced = set(edges["src"].astype(int)) | set(edges["dst"].astype(int))
    unknown = referenced - known
    if unknown:
        raise ValueError(f"Edges reference {len(unknown)} gid values absent from nodes")

    aggregated = (
        transactions.groupby(["src", "dst"], as_index=False)
        .agg(tx_sum=("sum_kzt", "sum"), tx_count=("sum_kzt", "size"))
        .sort_values(["src", "dst"])
    )
    checked = edges.merge(aggregated, on=["src", "dst"], how="outer", indicator=True)
    if not (checked["_merge"] == "both").all():
        raise ValueError("edges and transactions disagree on src/dst pairs")
    if not np.allclose(checked["sum_kzt"], checked["tx_sum"], rtol=1e-9, atol=0.01):
        raise ValueError("edges.sum_kzt does not match transaction sums")
    if not (checked["n_tx"].astype(int) == checked["tx_count"].astype(int)).all():
        raise ValueError("edges.n_tx does not match transaction counts")

    return (
        edges.sort_values(["src", "dst"]).reset_index(drop=True),
        nodes.sort_values("gid").reset_index(drop=True),
        transactions.sort_values(["date", "src", "dst"]).reset_index(drop=True),
    )


def _require_columns(frame: pd.DataFrame, required: set[str], name: str) -> None:
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"{name} misses columns: {', '.join(sorted(missing))}")


def build_graph(edges: pd.DataFrame, nodes: pd.DataFrame) -> nx.DiGraph:
    """Build a deterministic directed graph, including isolated seed nodes."""
    graph = nx.DiGraph()
    graph.add_nodes_from(int(gid) for gid in nodes["gid"].sort_values())
    for row in edges.sort_values(["src", "dst"]).itertuples(index=False):
        amount = float(row.sum_kzt)
        graph.add_edge(
            int(row.src),
            int(row.dst),
            sum_kzt=amount,
            n_tx=int(row.n_tx),
            depth=int(row.depth),
        )
    return graph


def calculate_features(
    graph: nx.DiGraph,
    nodes: pd.DataFrame,
    transactions: pd.DataFrame,
) -> pd.DataFrame:
    """Calculate structural and temporal features used by explainable rules."""
    in_degree = dict(graph.in_degree())
    out_degree = dict(graph.out_degree())
    in_amount = dict(graph.in_degree(weight="sum_kzt"))
    out_amount = dict(graph.out_degree(weight="sum_kzt"))
    in_tx = dict(graph.in_degree(weight="n_tx"))
    out_tx = dict(graph.out_degree(weight="n_tx"))
    pagerank = nx.pagerank(graph, weight="sum_kzt", max_iter=500, tol=1e-10)

    # Approximation is deterministic and comfortably inside the five-minute limit.
    sample_size = min(400, graph.number_of_nodes())
    betweenness = nx.betweenness_centrality(
        graph,
        k=sample_size if sample_size < graph.number_of_nodes() else None,
        normalized=True,
        weight=None,
        seed=42,
    )

    seed_reach: Counter[int] = Counter()
    seed_distance: dict[int, int] = {}
    seed_ids = sorted(int(gid) for gid in nodes.loc[nodes["is_seed"], "gid"])
    for seed in seed_ids:
        distances = nx.single_source_shortest_path_length(graph, seed, cutoff=4)
        for gid, distance in distances.items():
            seed_reach[gid] += 1
            if gid not in seed_distance or distance < seed_distance[gid]:
                seed_distance[gid] = distance

    temporal = _temporal_features(transactions, graph.nodes)
    frame = nodes[["gid", "depth", "is_seed"]].copy()
    frame["gid"] = frame["gid"].astype("int64")
    frame["in_deg"] = frame["gid"].map(in_degree).fillna(0).astype(int)
    frame["out_deg"] = frame["gid"].map(out_degree).fillna(0).astype(int)
    frame["in_kzt"] = frame["gid"].map(in_amount).fillna(0.0).astype(float)
    frame["out_kzt"] = frame["gid"].map(out_amount).fillna(0.0).astype(float)
    frame["in_tx"] = frame["gid"].map(in_tx).fillna(0).astype(int)
    frame["out_tx"] = frame["gid"].map(out_tx).fillna(0).astype(int)
    frame["pagerank"] = frame["gid"].map(pagerank).fillna(0.0)
    frame["betweenness"] = frame["gid"].map(betweenness).fillna(0.0)
    frame["seed_reach"] = frame["gid"].map(seed_reach).fillna(0).astype(int)
    frame["seed_distance"] = frame["gid"].map(seed_distance).astype("Int64")
    frame["pass_through"] = np.where(
        frame["in_kzt"] > 0,
        frame["out_kzt"] / frame["in_kzt"],
        np.nan,
    )
    frame["retention_ratio"] = np.where(
        frame["in_kzt"] > 0,
        np.clip(1.0 - frame["pass_through"], 0.0, 1.0),
        0.0,
    )
    frame["truncated_by_depth"] = (frame["depth"] == 4) & (frame["out_deg"] == 0)
    frame["is_isolated"] = (frame["in_deg"] == 0) & (frame["out_deg"] == 0)
    return frame.merge(temporal, on="gid", how="left")


def _temporal_features(
    transactions: pd.DataFrame, node_ids: Any
) -> pd.DataFrame:
    incoming = transactions.groupby("dst")["date"].apply(list).to_dict()
    outgoing = transactions.groupby("src")["date"].apply(list).to_dict()
    activity: dict[int, set[pd.Timestamp]] = {int(gid): set() for gid in node_ids}
    for row in transactions.itertuples(index=False):
        day = pd.Timestamp(row.date).normalize()
        activity[int(row.src)].add(day)
        activity[int(row.dst)].add(day)

    records: list[dict[str, Any]] = []
    for gid in sorted(int(value) for value in node_ids):
        ins = sorted(pd.Timestamp(value) for value in incoming.get(gid, []))
        outs = np.array(
            sorted(np.datetime64(pd.Timestamp(value), "ns") for value in outgoing.get(gid, [])),
            dtype="datetime64[ns]",
        )
        delays: list[int] = []
        quick = 0
        if len(outs):
            for value in ins:
                incoming_date = np.datetime64(value, "ns")
                index = int(np.searchsorted(outs, incoming_date, side="left"))
                if index < len(outs):
                    delay = int((outs[index] - incoming_date) / np.timedelta64(1, "D"))
                    delays.append(delay)
                    if delay <= 2:
                        quick += 1
        records.append(
            {
                "gid": gid,
                "quick_forward_ratio": quick / len(ins) if ins else 0.0,
                "median_forward_days": float(np.median(delays)) if delays else np.nan,
                "active_days": len(activity[gid]),
            }
        )
    return pd.DataFrame.from_records(records)


def assign_clusters(
    graph: nx.DiGraph,
    features: pd.DataFrame,
) -> tuple[pd.DataFrame, nx.Graph]:
    """Run deterministic Louvain on a weighted undirected projection."""
    undirected = nx.Graph()
    undirected.add_nodes_from(sorted(graph.nodes))
    for source, target, attrs in sorted(graph.edges(data=True)):
        amount = float(attrs["sum_kzt"])
        if undirected.has_edge(source, target):
            undirected[source][target]["weight"] += amount
        else:
            undirected.add_edge(source, target, weight=amount)

    communities = nx.community.louvain_communities(
        undirected,
        weight="weight",
        resolution=1.0,
        threshold=1e-7,
        seed=42,
    )
    ordered = sorted(communities, key=lambda group: (-len(group), min(group)))
    cluster_by_gid = {
        int(gid): cluster_id
        for cluster_id, community in enumerate(ordered)
        for gid in sorted(community)
    }
    result = features.copy()
    result["cluster_id"] = result["gid"].map(cluster_by_gid).astype(int)
    return result, undirected


def assign_roles(features: pd.DataFrame) -> pd.DataFrame:
    """Assign one explainable role and confidence score to every node."""
    frame = features.copy()
    rank_columns = [
        "in_deg",
        "out_deg",
        "in_kzt",
        "out_kzt",
        "in_tx",
        "out_tx",
        "pagerank",
        "betweenness",
        "seed_reach",
    ]
    for column in rank_columns:
        frame[f"{column}_rank"] = frame[column].rank(method="average", pct=True)

    balance = (1.0 - (frame["pass_through"] - 1.0).abs()).clip(0.0, 1.0).fillna(0.0)
    fanout = frame["out_deg"] / (frame["in_deg"] + frame["out_deg"]).replace(0, np.nan)
    fanout = fanout.fillna(0.0)

    frame["score_consolidator"] = (
        0.35 * frame["in_deg_rank"]
        + 0.20 * frame["in_kzt_rank"]
        + 0.20 * frame["retention_ratio"]
        + 0.15 * frame["seed_reach_rank"]
        + 0.10 * (1.0 - fanout)
    )
    frame["score_distributor"] = (
        0.40 * frame["out_deg_rank"]
        + 0.25 * frame["out_kzt_rank"]
        + 0.15 * frame["out_tx_rank"]
        + 0.20 * fanout
    )
    frame["score_transit"] = (
        0.35 * balance
        + 0.25 * frame["quick_forward_ratio"]
        + 0.20 * frame["betweenness_rank"]
        + 0.10 * frame["in_deg_rank"]
        + 0.10 * frame["out_deg_rank"]
    )
    frame["score_terminal"] = (
        0.35 * (frame["out_deg"] == 0).astype(float)
        + 0.25 * frame["retention_ratio"]
        + 0.20 * frame["in_kzt_rank"]
        + 0.20 * frame["in_deg_rank"]
    )
    frame["score_coordinator"] = (
        0.30 * frame["betweenness_rank"]
        + 0.20 * frame["pagerank_rank"]
        + 0.20 * frame["seed_reach_rank"]
        + 0.15 * frame["in_deg_rank"]
        + 0.15 * frame["out_deg_rank"]
    )

    roles: list[str] = []
    role_scores: list[float] = []
    evidence: list[str] = []
    for row in frame.itertuples(index=False):
        eligible: dict[str, float] = {}
        if not row.is_seed and not row.truncated_by_depth:
            if row.in_deg >= 3 and (row.retention_ratio >= 0.35 or row.in_deg > row.out_deg):
                eligible["consolidator"] = row.score_consolidator
            if row.in_deg > 0 and row.out_deg > 0 and 0.7 <= row.pass_through <= 1.3:
                eligible["transit"] = row.score_transit
            if row.depth < 4 and row.in_deg > 0 and (row.out_deg == 0 or row.pass_through <= 0.15):
                eligible["terminal"] = row.score_terminal
        if row.out_deg >= 10 and row.out_deg >= 1.5 * max(row.in_deg, 1):
            eligible["distributor"] = row.score_distributor
        if (
            row.in_deg >= 2
            and row.out_deg >= 2
            and (row.betweenness_rank >= 0.85 or row.seed_reach >= 7)
        ):
            eligible["coordinator"] = row.score_coordinator

        if eligible:
            role, score = max(eligible.items(), key=lambda item: (item[1], item[0]))
        else:
            role = "peripheral"
            strongest = max(
                row.score_consolidator,
                row.score_transit,
                row.score_distributor,
                row.score_terminal,
                row.score_coordinator,
            )
            score = 0.55 + 0.35 * (1.0 - strongest)
            if row.truncated_by_depth:
                score = 0.72
            elif row.is_isolated:
                score = 0.95

        score = float(np.clip(score, 0.0, 1.0))
        roles.append(role)
        role_scores.append(score)
        evidence.append(_role_evidence(role, row))

    frame["role"] = roles
    frame["role_score"] = role_scores
    frame["evidence"] = evidence
    return frame


def _role_evidence(role: str, row: Any) -> str:
    incoming = _format_money(row.in_kzt)
    outgoing = _format_money(row.out_kzt)
    if role == "consolidator":
        return _shorten(
            f"Гипотеза консолидации: {row.in_deg} отправителей, вход {incoming} KZT; "
            f"удержано {row.retention_ratio:.0%} наблюдаемого потока."
        )
    if role == "distributor":
        return _shorten(
            f"Гипотеза распределения: {row.out_deg} получателей, выход {outgoing} KZT "
            f"в {row.out_tx} переводах."
        )
    if role == "transit":
        return _shorten(
            f"Гипотеза транзита: передано {row.pass_through:.0%} входящего потока; "
            f"{row.quick_forward_ratio:.0%} входов получили продолжение за 2 дня."
        )
    if role == "terminal":
        return _shorten(
            f"Гипотеза конечного получателя: вход {incoming} KZT от {row.in_deg} отправителей; "
            f"наблюдаемый выход {outgoing} KZT, depth={row.depth}."
        )
    if role == "coordinator":
        return _shorten(
            f"Гипотеза координации: входов {row.in_deg}, выходов {row.out_deg}, "
            f"достижим из {row.seed_reach} seed; посредничество {row.betweenness:.4f}."
        )
    if row.truncated_by_depth:
        return "Периферия: узел обрезан границей depth=4; отсутствие выхода не доказывает оседание средств."
    if row.is_isolated:
        return "Периферия: узел отсутствует в наблюдаемых рёбрах; структурных признаков роли недостаточно."
    return _shorten(
        f"Периферия: входов {row.in_deg}, выходов {row.out_deg}, оборот "
        f"{_format_money(row.in_kzt + row.out_kzt)} KZT; сильных признаков роли нет."
    )


def _format_money(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ")


def _shorten(value: str, limit: int = 200) -> str:
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def calculate_priority(features: pd.DataFrame) -> pd.DataFrame:
    frame = features.copy()
    raw = (
        0.30 * frame["score_coordinator"]
        + 0.20 * frame["score_consolidator"]
        + 0.16 * frame["score_distributor"]
        + 0.12 * frame["score_transit"]
        + 0.10 * frame["pagerank_rank"]
        + 0.08 * frame["betweenness_rank"]
        + 0.04 * frame["seed_reach_rank"]
        + 0.04 * (~frame["is_seed"]).astype(float)
    )
    raw = raw * np.where(frame["truncated_by_depth"], 0.55, 1.0)
    raw = raw * np.where(frame["is_isolated"], 0.10, 1.0)
    minimum, maximum = float(raw.min()), float(raw.max())
    frame["priority_score"] = (
        (raw - minimum) / (maximum - minimum) if maximum > minimum else 0.0
    )
    return frame


def build_cluster_output(
    frame: pd.DataFrame,
    edges: pd.DataFrame,
) -> pd.DataFrame:
    cluster_by_gid = frame.set_index("gid")["cluster_id"].to_dict()
    internal_amount: Counter[int] = Counter()
    for row in edges.itertuples(index=False):
        source_cluster = cluster_by_gid[int(row.src)]
        if source_cluster == cluster_by_gid[int(row.dst)]:
            internal_amount[int(source_cluster)] += float(row.sum_kzt)

    records: list[dict[str, Any]] = []
    for cluster_id, group in frame.groupby("cluster_id", sort=True):
        role_counts = Counter(group["role"])
        dominant_role, dominant_count = role_counts.most_common(1)[0]
        dominant_label = ROLE_NAMES_RU[dominant_role]
        top = group.sort_values(["priority_score", "gid"], ascending=[False, True]).head(5)
        n_seed = int(group["is_seed"].sum())
        if len(group) == 1 and int(group.iloc[0]["in_deg"] + group.iloc[0]["out_deg"]) == 0:
            hypothesis = "Изолированный seed без наблюдаемых транзакций."
        elif n_seed > 1:
            hypothesis = (
                f"Связанная группа из {len(group)} узлов и {n_seed} seed; "
                f"доминирует роль «{dominant_label}» ({dominant_count})."
            )
        else:
            hypothesis = (
                f"Сообщество из {len(group)} узлов; доминирует роль "
                f"«{dominant_label}» ({dominant_count})."
            )
        records.append(
            {
                "cluster_id": int(cluster_id),
                "n_nodes": int(len(group)),
                "n_seed": n_seed,
                "sum_kzt_internal": float(internal_amount[int(cluster_id)]),
                "top_gids": "|".join(str(int(gid)) for gid in top["gid"]),
                "hypothesis": _shorten(hypothesis),
            }
        )
    return pd.DataFrame.from_records(records)


def build_outputs(
    frame: pd.DataFrame,
    clusters: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    base_columns = [
        "gid",
        "role",
        "role_score",
        "cluster_id",
        "priority_score",
        "evidence",
    ]
    extra_columns = [
        "depth",
        "is_seed",
        "in_deg",
        "out_deg",
        "in_kzt",
        "out_kzt",
        "in_tx",
        "out_tx",
        "pagerank",
        "betweenness",
        "pass_through",
        "seed_reach",
        "quick_forward_ratio",
        "median_forward_days",
        "active_days",
        "truncated_by_depth",
    ]
    nodes_roles = frame[base_columns + extra_columns].sort_values("gid").reset_index(drop=True)
    top_nodes = (
        frame.loc[~frame["is_isolated"]]
        .sort_values(["priority_score", "gid"], ascending=[False, True])
        .head(50)
        .reset_index(drop=True)
    )
    top_nodes.insert(0, "rank", np.arange(1, len(top_nodes) + 1))
    top_nodes["why"] = top_nodes["evidence"]
    top_nodes = top_nodes[["rank", "gid", "role", "priority_score", "why"]]
    return nodes_roles, clusters.sort_values("cluster_id"), top_nodes


def write_dashboard_json(
    out_path: Path,
    frame: pd.DataFrame,
    edges: pd.DataFrame,
    clusters: pd.DataFrame,
    top_nodes: pd.DataFrame,
    transactions: pd.DataFrame,
) -> None:
    node_columns = [
        "gid",
        "role",
        "role_score",
        "cluster_id",
        "priority_score",
        "evidence",
        "depth",
        "is_seed",
        "in_deg",
        "out_deg",
        "in_kzt",
        "out_kzt",
        "seed_reach",
        "quick_forward_ratio",
        "truncated_by_depth",
    ]
    node_records = frame[node_columns].to_dict(orient="records")
    edge_records = edges[["src", "dst", "sum_kzt", "n_tx", "depth"]].to_dict(orient="records")
    cluster_records = clusters.to_dict(orient="records")
    top_records = top_nodes.to_dict(orient="records")
    signals = node_signals(frame, transactions)

    for record in node_records:
        record["signals"] = signals[int(record["gid"])]
        record["gid"] = str(record["gid"])
    for record in edge_records:
        record["src"] = str(record["src"])
        record["dst"] = str(record["dst"])
    for record in top_records:
        record["gid"] = str(record["gid"])
    for record in cluster_records:
        record["top_gids"] = str(record["top_gids"]).split("|") if record["top_gids"] else []

    payload = {
        "meta": {
            "nodes": len(frame),
            "edges": len(edges),
            "transactions": len(transactions),
            "turnoverKzt": float(edges["sum_kzt"].sum()),
            "periodStart": transactions["date"].min().date().isoformat(),
            "periodEnd": transactions["date"].max().date().isoformat(),
            "roleCounts": {
                role: int(count) for role, count in frame["role"].value_counts().items()
            },
        },
        "nodes": node_records,
        "edges": edge_records,
        "clusters": cluster_records,
        "topNodes": top_records,
    }
    out_path.write_text(
        json.dumps(
            _json_clean(payload),
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )


def _json_clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_clean(item) for item in value]
    if isinstance(value, np.generic):
        return _json_clean(value.item())
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if pd.isna(value):
        return None
    return value


def validate_outputs(out_dir: Path, expected_nodes: int) -> dict[str, int]:
    paths = {
        "nodes": out_dir / "nodes_roles.csv",
        "clusters": out_dir / "clusters.csv",
        "top": out_dir / "top_nodes.csv",
    }
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing output files: {', '.join(missing)}")

    nodes = pd.read_csv(paths["nodes"], dtype={"gid": "string"})
    clusters = pd.read_csv(paths["clusters"])
    top = pd.read_csv(paths["top"], dtype={"gid": "string"})
    required_nodes = {
        "gid",
        "role",
        "role_score",
        "cluster_id",
        "priority_score",
        "evidence",
    }
    required_clusters = {
        "cluster_id",
        "n_nodes",
        "n_seed",
        "sum_kzt_internal",
        "top_gids",
        "hypothesis",
    }
    required_top = {"rank", "gid", "role", "priority_score", "why"}
    _require_columns(nodes, required_nodes, "nodes_roles.csv")
    _require_columns(clusters, required_clusters, "clusters.csv")
    _require_columns(top, required_top, "top_nodes.csv")

    if len(nodes) != expected_nodes:
        raise ValueError(f"nodes_roles.csv has {len(nodes)} rows; expected {expected_nodes}")
    if nodes["gid"].duplicated().any():
        raise ValueError("nodes_roles.csv has duplicate gid values")
    if not set(nodes["role"]).issubset(ROLES) or nodes["role"].isna().any():
        raise ValueError("nodes_roles.csv contains an invalid or empty role")
    for column in ["role_score", "priority_score"]:
        if not nodes[column].between(0, 1, inclusive="both").all():
            raise ValueError(f"{column} must be inside [0, 1]")
    if nodes["evidence"].isna().any() or (nodes["evidence"].str.len() == 0).any():
        raise ValueError("Every node must have non-empty evidence")
    if (nodes["evidence"].str.len() > 200).any():
        raise ValueError("Evidence must not exceed 200 characters")
    if set(nodes["cluster_id"]) != set(clusters["cluster_id"]):
        raise ValueError("clusters.csv and nodes_roles.csv disagree on cluster ids")
    if int(clusters["n_nodes"].sum()) != expected_nodes:
        raise ValueError("Cluster sizes do not add up to the number of nodes")
    if clusters["hypothesis"].isna().any():
        raise ValueError("Every cluster must have a hypothesis")
    if len(top) < 20:
        raise ValueError("top_nodes.csv must contain at least 20 rows")
    if list(top["rank"]) != list(range(1, len(top) + 1)):
        raise ValueError("top_nodes.csv ranks must be consecutive and start at 1")
    if not top["priority_score"].is_monotonic_decreasing:
        raise ValueError("top_nodes.csv must be sorted by descending priority")
    if top["why"].isna().any():
        raise ValueError("Every top node must have an explanation")

    return {"nodes": len(nodes), "clusters": len(clusters), "top_nodes": len(top)}


def run_pipeline(
    data_dir: Path,
    out_dir: Path,
    web_out: Path | None = None,
) -> dict[str, int]:
    edges, nodes, transactions = load_data(data_dir)
    graph = build_graph(edges, nodes)
    features = calculate_features(graph, nodes, transactions)
    features, _ = assign_clusters(graph, features)
    features = assign_roles(features)
    features = calculate_priority(features)
    clusters = build_cluster_output(features, edges)
    nodes_roles, clusters, top_nodes = build_outputs(features, clusters)

    out_dir.mkdir(parents=True, exist_ok=True)
    nodes_roles.to_csv(out_dir / "nodes_roles.csv", index=False)
    clusters.to_csv(out_dir / "clusters.csv", index=False)
    top_nodes.to_csv(out_dir / "top_nodes.csv", index=False)
    write_dashboard_json(
        out_dir / "graph.json",
        features,
        edges,
        clusters,
        top_nodes,
        transactions,
    )
    if web_out is not None:
        web_out.parent.mkdir(parents=True, exist_ok=True)
        write_dashboard_json(
            web_out,
            features,
            edges,
            clusters,
            top_nodes,
            transactions,
        )
    return validate_outputs(out_dir, expected_nodes=len(nodes))
