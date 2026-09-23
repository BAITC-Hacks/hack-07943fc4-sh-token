from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from .pipeline import load_data, run_pipeline, validate_outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="STRATA: explainable transaction-graph analysis"
    )
    parser.add_argument("--data", type=Path, default=Path("data"))
    parser.add_argument("--out", type=Path, default=Path("out"))
    parser.add_argument(
        "--web-out",
        type=Path,
        help="optional path for a browser-safe dashboard JSON copy",
    )
    parser.add_argument(
        "--web",
        type=Path,
        help="optional directory for generated graph.json and run_log.json",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="validate existing CSV outputs without recalculating the graph",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    started = time.perf_counter()

    if args.validate_only:
        _, nodes, _ = load_data(args.data)
        summary = validate_outputs(args.out, expected_nodes=len(nodes))
    else:
        graph_out = args.web / "graph.json" if args.web else args.web_out
        summary = run_pipeline(args.data, args.out, web_out=graph_out)

    elapsed = time.perf_counter() - started
    if elapsed > 300:
        raise RuntimeError(f"Pipeline exceeded the 5 minute limit: {elapsed:.1f}s")

    if args.web and not args.validate_only:
        args.web.mkdir(parents=True, exist_ok=True)
        run_log = {
            "status": "done",
            "elapsedSeconds": round(elapsed, 3),
            "steps": [
                "Проверка консистентности транзакций",
                "Расчёт структурных и временных признаков",
                "Кластеризация Louvain",
                "Присвоение объяснимых ролей",
                "Формирование приоритетов",
            ],
            **summary,
        }
        (args.web / "run_log.json").write_text(
            json.dumps(run_log, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    print("\nSTRATA MONEY GRAPH — ГОТОВО")
    print(f"  узлов                 : {summary['nodes']}")
    print(f"  кластеров             : {summary['clusters']}")
    print(f"  строк в топ-листе     : {summary['top_nodes']}")
    print(f"  время                 : {elapsed:.2f} с")
    print(f"  результаты            : {args.out.resolve()}")


if __name__ == "__main__":
    main()
