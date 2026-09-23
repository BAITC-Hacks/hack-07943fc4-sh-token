import pandas as pd

from money_graph.diagnostics import node_signals


def test_temporal_signals_use_distinct_payers_and_count_self_transfer_once():
    nodes = pd.DataFrame([
        {"gid": gid, "depth": 1, "in_kzt": 6000 if gid != 4 else 500000, "out_kzt": 0}
        for gid in range(1, 7)
    ])
    tx = pd.DataFrame([
        {"src": src, "dst": dst, "sum_kzt": 6000, "date": day}
        for src, dst, day in [(1,4,"2026-07-01"),(2,4,"2026-07-01"),(3,4,"2026-07-01"),
                              (1,4,"2026-07-01"),(4,4,"2026-07-01"),(5,6,"2026-07-10")]
    ])
    result = node_signals(nodes, tx)
    assert result[4]["peak_day_tx"] == 5
    assert result[4]["synchronous_payers"] == 3
    assert result[4]["daily_average_tx"] == 0.5
    assert result[4]["activity_spike"] is True
    assert result[4]["turnover_outlier"] is True
    assert result[1]["near_threshold_max_daily"] == 2
    assert result[6]["activity_spike"] is False


def test_isolated_node_has_zero_signals():
    nodes = pd.DataFrame([{"gid": 7, "depth": 0, "in_kzt": 0, "out_kzt": 0}])
    tx = pd.DataFrame([{"src": 1, "dst": 2, "sum_kzt": 10000, "date": "2026-07-01"}])
    result = node_signals(nodes, tx)[7]
    assert result["peak_day_tx"] == 0
    assert result["peak_day"] is None
    assert result["turnover_outlier"] is False
