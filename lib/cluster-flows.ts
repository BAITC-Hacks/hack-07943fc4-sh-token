import type { MoneyGraphData } from "./graph-types"

export function getClusterFlows(data: MoneyGraphData) {
  const clusterByGid = new Map(data.nodes.map((node) => [node.gid, node.cluster_id]))
  const flows = new Map<string, { src: number; dst: number; sum_kzt: number; n_tx: number }>()
  for (const edge of data.edges) {
    const src = clusterByGid.get(edge.src)
    const dst = clusterByGid.get(edge.dst)
    if (src === undefined || dst === undefined || src === dst) continue
    const key = `${src}:${dst}`
    const flow = flows.get(key) ?? { src, dst, sum_kzt: 0, n_tx: 0 }
    flow.sum_kzt += edge.sum_kzt
    flow.n_tx += edge.n_tx
    flows.set(key, flow)
  }
  return [...flows.values()].sort((a, b) => b.sum_kzt - a.sum_kzt || a.src - b.src || a.dst - b.dst)
}
