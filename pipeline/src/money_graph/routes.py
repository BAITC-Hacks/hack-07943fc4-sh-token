"""Bounded, reproducible route search. Date order is not attribution of funds."""
from bisect import bisect_left
from collections import defaultdict

import pandas as pd


def route_patterns(transactions: pd.DataFrame, budget: int = 200_000) -> dict:
    edges = defaultdict(list)
    adjacency = defaultdict(set)
    for index, row in enumerate(transactions.itertuples(index=False)):
        src, dst = int(row.src), int(row.dst)
        if src == dst:
            continue
        day = pd.Timestamp(row.date).normalize()
        edges[src, dst].append((day, index))
        adjacency[src].add(dst)
    for values in edges.values():
        values.sort()

    def observations(path):
        legs = [edges[a, b] for a, b in zip(path, path[1:])]
        used = set()
        matches = []
        # Greedy non-reusing matches within each route; not shared across routes.
        for first_day, first_index in legs[0]:
            if first_index in used:
                continue
            chosen = [(first_day, first_index)]
            for leg in legs[1:]:
                previous = chosen[-1][0]
                pos = bisect_left(leg, (previous, -1))
                match = next((item for item in leg[pos:] if item[1] not in used
                              and item[1] not in {i for _, i in chosen}
                              and 0 <= (item[0] - previous).days <= 2), None)
                if match is None:
                    break
                chosen.append(match)
            if len(chosen) == len(legs):
                used.update(i for _, i in chosen)
                matches.append([day.strftime("%Y-%m-%d") for day, _ in chosen])
        return matches

    examined = 0
    chains = []
    cycles = []
    chain_limited = False
    for a, b in sorted(edges):
        if len(edges[a, b]) < 2:
            continue
        for c in sorted(adjacency[b]):
            examined += 1
            if examined > budget:
                chain_limited = True
                break
            if c == a or len(edges[b, c]) < 2:
                continue
            matches = observations([a, b, c])
            days = sorted({dates[0] for dates in matches})
            if len(days) >= 2:
                chains.append({"gids": [str(a), str(b), str(c)], "occurrences": len(matches),
                               "distinct_days": len(days), "examples": matches[:3]})
        if chain_limited:
            break

    cycle_steps = 0
    cycle_limited = False
    def walk(path):
        nonlocal cycle_steps, cycle_limited
        for nxt in sorted(adjacency[path[-1]]):
            cycle_steps += 1
            if cycle_steps > budget or len(cycles) >= 2000:
                cycle_limited = True
                return
            if nxt == path[0] and len(path) >= 3:
                best_path, best_matches = path, []
                # Each rotation may have a different chronological starting point.
                for offset in range(len(path)):
                    rotated = path[offset:] + path[:offset]
                    matches = observations(rotated + [rotated[0]])
                    if len(matches) > len(best_matches):
                        best_path, best_matches = rotated, matches
                cycles.append({"gids": [str(gid) for gid in best_path + [best_path[0]]],
                               "occurrences": len(best_matches), "examples": best_matches[:3]})
            elif len(path) < 4 and nxt > path[0] and nxt not in path:
                walk(path + [nxt])
            if cycle_limited:
                return
    for gid in sorted(adjacency):
        walk([gid])
        if cycle_limited:
            break
    chains.sort(key=lambda r: (-r["distinct_days"], -r["occurrences"], r["gids"]))
    cycles.sort(key=lambda r: (-r["occurrences"], len(r["gids"]), r["gids"]))
    return {"chains": chains[:50], "cycles": cycles[:50], "chain_count": len(chains),
            "cycle_count": len(cycles), "chain_search_limited": chain_limited,
            "cycle_search_limited": cycle_limited, "max_hop_days": 2,
            "max_cycle_length": 4, "max_results": 50}
