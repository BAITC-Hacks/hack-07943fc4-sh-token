import pandas as pd
from money_graph.routes import route_patterns


def tx(rows):
    return pd.DataFrame([dict(src=a, dst=b, date=day, sum_kzt=6000) for a, b, day in rows])


def test_repeated_chains_require_distinct_days_and_forward_date_order():
    result = route_patterns(tx([(1,2,"2026-07-01"),(2,3,"2026-07-02"),
                                (1,2,"2026-07-05"),(2,3,"2026-07-06")]))
    assert result["chains"][0]["gids"] == ["1", "2", "3"]
    assert result["chains"][0]["occurrences"] == 2
    reverse = route_patterns(tx([(1,2,"2026-07-02"),(2,3,"2026-07-01"),
                                 (1,2,"2026-07-06"),(2,3,"2026-07-05")]))
    assert reverse["chains"] == []


def test_cycles_deduplicate_rotations_but_keep_chronology():
    result = route_patterns(tx([(2,3,"2026-07-01"),(3,1,"2026-07-02"),(1,2,"2026-07-03")]))
    assert result["cycle_count"] == 1
    assert result["cycles"][0]["gids"] == ["2", "3", "1", "2"]
    assert result["cycles"][0]["occurrences"] == 1
    assert result["cycles"][0]["examples"] == [["2026-07-01","2026-07-02","2026-07-03"]]


def test_limits_are_explicit_and_same_day_is_not_repeated_across_days():
    result = route_patterns(tx([(1,2,"2026-07-01"),(1,2,"2026-07-01"),
                                (2,3,"2026-07-01"),(2,3,"2026-07-01")]))
    assert result["chains"] == []
    assert route_patterns(tx([(1,2,"2026-07-01"),(2,3,"2026-07-01"),(3,1,"2026-07-01")]), budget=1)["cycle_search_limited"]
