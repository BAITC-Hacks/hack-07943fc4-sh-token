from pathlib import Path
import json

import pandas as pd

from money_graph import ROLES, run_pipeline


ROOT = Path(__file__).resolve().parents[2]


def test_pipeline_generates_valid_outputs(tmp_path: Path) -> None:
    summary = run_pipeline(ROOT / "data", tmp_path)

    assert summary["nodes"] == 2248
    assert summary["top_nodes"] >= 20
    assert (tmp_path / "graph.json").exists()

    nodes = pd.read_csv(tmp_path / "nodes_roles.csv", dtype={"gid": "string"})
    assert set(nodes["role"]) == ROLES
    assert nodes["evidence"].str.len().max() <= 200
    assert int(nodes["truncated_by_depth"].sum()) == 444

    dashboard = json.loads((tmp_path / "graph.json").read_text(encoding="utf-8"))
    assert isinstance(dashboard["nodes"][0]["gid"], str)
    assert len(dashboard["nodes"][0]["gid"]) == 18
