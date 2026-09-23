"""Descriptive signals for investigation, never changes roles or priority scores."""
import pandas as pd


def node_signals(frame: pd.DataFrame, transactions: pd.DataFrame) -> dict[int, dict]:
    tx = transactions.copy()
    tx["day"] = pd.to_datetime(tx["date"]).dt.strftime("%Y-%m-%d")
    incoming = tx[tx.src != tx.dst].groupby(["dst", "day"]).agg(payers=("src", "nunique"), count=("src", "size"))
    activity = pd.concat([
        tx[["src", "day"]].rename(columns={"src": "gid"}),
        tx[["dst", "day"]].rename(columns={"dst": "gid"}),
    ]).groupby(["gid", "day"]).size()
    # Self-transfers count once as an operation in the activity series.
    self_tx = tx[tx.src == tx.dst].groupby(["src", "day"]).size()
    self_tx.index.names = ["gid", "day"]
    activity = activity.subtract(self_tx, fill_value=0)
    small = tx[(tx.sum_kzt >= 5000) & (tx.sum_kzt < 10000)].groupby(["src", "day"]).size()
    calendar_days = max(1, (pd.to_datetime(tx.date).max() - pd.to_datetime(tx.date).min()).days + 1)
    turnover = frame.in_kzt + frame.out_kzt
    result = {}
    for row in frame.itertuples(index=False):
        gid = int(row.gid)
        peers = turnover[frame.depth == row.depth]
        q1, q3 = peers.quantile(0.25), peers.quantile(0.75)
        limit = float(q3 + 1.5 * (q3 - q1))
        own = activity.loc[gid] if gid in activity.index.get_level_values(0) else pd.Series(dtype=float)
        ins = incoming.loc[gid] if gid in incoming.index.get_level_values(0) else pd.DataFrame(columns=["payers", "count"])
        peak = int(own.max()) if len(own) else 0
        average = float(own.sum() / calendar_days) if len(own) else 0.0
        small_days = small.loc[gid] if gid in small.index.get_level_values(0) else pd.Series(dtype=float)
        result[gid] = {
            "peak_day": str(own.idxmax()) if len(own) else None,
            "peak_day_tx": peak,
            "daily_average_tx": round(average, 3),
            "activity_spike": bool(peak >= 5 and average > 0 and peak >= 3 * average),
            "synchronous_payers": int(ins.payers.max()) if len(ins) else 0,
            "synchronous_day": str(ins.payers.idxmax()) if len(ins) else None,
            "near_threshold_max_daily": int(small_days.max()) if len(small_days) else 0,
            "turnover_outlier": bool(len(peers) >= 4 and row.in_kzt + row.out_kzt > limit),
            "depth_turnover_upper_fence": limit,
            "depth_peer_count": int(len(peers)),
        }
    return result
