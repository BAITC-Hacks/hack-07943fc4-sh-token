import type { MoneyGraphData, MoneyEdge } from "./graph-types"

/** One shortest observed directed path from any seed. It is not money attribution. */
export function seedPath(graph: MoneyGraphData, target: string): string[] {
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.edges) outgoing.set(edge.src, [...(outgoing.get(edge.src) ?? []), edge.dst])
  const queue = graph.nodes.filter((node) => node.is_seed).map((node) => node.gid).sort()
  const parent = new Map<string, string | null>(queue.map((gid) => [gid, null]))
  for (let index = 0; index < queue.length; index++) {
    const gid = queue[index]
    if (gid === target) {
      const path = [gid]
      let previous = parent.get(gid)
      while (previous) { path.unshift(previous); previous = parent.get(previous) }
      return path
    }
    for (const next of outgoing.get(gid) ?? []) {
      if (!parent.has(next)) { parent.set(next, gid); queue.push(next) }
    }
  }
  return []
}

export function reciprocalFlows(graph: MoneyGraphData) {
  const edges = new Map(graph.edges.map((edge) => [`${edge.src}:${edge.dst}`, edge]))
  return graph.edges.flatMap((edge) => {
    const reverse = edges.get(`${edge.dst}:${edge.src}`)
    return reverse && edge.src < edge.dst ? [{ forward: edge, reverse, amount: edge.sum_kzt + reverse.sum_kzt }] : []
  }).sort((a, b) => b.amount - a.amount)
}

function components(gids: string[], edges: MoneyEdge[]) {
  const allowed = new Set(gids)
  const adjacency = new Map(gids.map((gid) => [gid, new Set<string>()]))
  for (const edge of edges) {
    if (allowed.has(edge.src) && allowed.has(edge.dst)) {
      adjacency.get(edge.src)!.add(edge.dst); adjacency.get(edge.dst)!.add(edge.src)
    }
  }
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const gid of gids) {
    if (seen.has(gid)) continue
    const queue = [gid]; seen.add(gid)
    for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i]) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next) }
    }
    groups.push(queue)
  }
  return groups
}

/** Structural what-if only. Baseline counts the same remaining vertices in original components. */
export function networkResilience(graph: MoneyGraphData, count: number) {
  const removed = graph.topNodes.slice(0, count).map((node) => node.gid)
  const removedSet = new Set(removed)
  const remaining = graph.nodes.filter((node) => !removedSet.has(node.gid)).map((node) => node.gid)
  const before = components(graph.nodes.map((node) => node.gid), graph.edges)
    .map((group) => group.filter((gid) => !removedSet.has(gid))).filter((group) => group.length)
  const after = components(remaining, graph.edges)
  const pairs = (groups: string[][]) => groups.reduce((sum, group) => sum + group.length * (group.length - 1) / 2, 0)
  const beforePairs = pairs(before), afterPairs = pairs(after)
  return {
    removed, remaining: remaining.length,
    componentsBefore: before.length, componentsAfter: after.length,
    largestBefore: Math.max(0, ...before.map((group) => group.length)),
    largestAfter: Math.max(0, ...after.map((group) => group.length)),
    disconnectedPairs: beforePairs - afterPairs,
    disconnectedRatio: beforePairs ? (beforePairs - afterPairs) / beforePairs : 0,
  }
}

export function completenessNotes(node: MoneyGraphData["nodes"][number]) {
  const notes = [{ title: "Полный оборот неизвестен", detail: "В выборке только внутрибанковские переводы от 5 000 ₸ за период. Для проверки нужны полные входящие и исходящие операции." }]
  if (node.truncated_by_depth) notes.unshift({ title: "Граница четвёртого колена", detail: "Продолжение маршрута не выгружено. Запросить исходящие переводы следующего колена; отсутствие выхода не означает остаток на счёте." })
  if (node.is_seed) notes.unshift({ title: "Входящие у исходного клиента неполны", detail: "Запросить полную выписку клиента. Соотношение входа и выхода здесь не отражает баланс счёта." })
  if (!node.in_deg && !node.out_deg) notes.unshift({ title: "Нет наблюдаемых связей", detail: "Проверить период, порог и наличие переводов за пределы банка; отсутствие рёбер не исключает активности." })
  return notes
}
