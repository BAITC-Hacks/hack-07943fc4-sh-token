import type { MoneyGraphData, MoneyNode, MoneyRole } from "./graph-types"

export const MONEY_ROLES: MoneyRole[] = [
  "coordinator", "consolidator", "distributor", "transit", "terminal", "peripheral",
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
const isCount = (value: unknown): value is number => isNumber(value) && Number.isInteger(value)
const isScore = (value: unknown) => isNumber(value) && value <= 1
export const isGid = (value: unknown): value is string =>
  typeof value === "string" && /^\d{18}$/.test(value)
const isRole = (value: unknown) => MONEY_ROLES.includes(value as MoneyRole)
const isDateOrNull = (value: unknown) => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
const isSignals = (value: unknown) => value === undefined || (isRecord(value)
  && [value.peak_day_tx, value.synchronous_payers, value.near_threshold_max_daily, value.depth_peer_count].every(isCount)
  && [value.daily_average_tx, value.depth_turnover_upper_fence].every(isNumber)
  && typeof value.activity_spike === "boolean" && typeof value.turnover_outlier === "boolean"
  && isDateOrNull(value.peak_day) && isDateOrNull(value.synchronous_day))

/** Reject broken exports instead of silently presenting mock data as a real result. */
export function parseMoneyGraph(value: unknown): MoneyGraphData {
  const fail = (): never => { throw new Error("Формат graph.json не соответствует контракту. Выполните npm run analyze.") }
  if (!isRecord(value) || !isRecord(value.meta)) return fail()
  const { meta, nodes, edges, clusters, topNodes } = value
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(clusters) || !Array.isArray(topNodes)) return fail()
  if (![meta.nodes, meta.edges, meta.transactions].every(isCount) || !isNumber(meta.turnoverKzt)
    || typeof meta.periodStart !== "string" || typeof meta.periodEnd !== "string"
    || !isRecord(meta.roleCounts) || !Object.entries(meta.roleCounts).every(([role, count]) => isRole(role) && isCount(count))) return fail()
  if (!nodes.every((node) => isRecord(node) && isGid(node.gid) && isRole(node.role)
    && isScore(node.role_score) && isScore(node.priority_score) && typeof node.evidence === "string"
    && [node.cluster_id, node.depth, node.in_deg, node.out_deg, node.seed_reach].every(isCount)
    && [node.in_kzt, node.out_kzt, node.quick_forward_ratio].every(isNumber)
    && typeof node.is_seed === "boolean" && typeof node.truncated_by_depth === "boolean"
    && isSignals(node.signals))) return fail()
  const gids = new Set(nodes.map((node) => node.gid))
  if (gids.size !== nodes.length || meta.nodes !== nodes.length || meta.edges !== edges.length) return fail()
  if (!edges.every((edge) => isRecord(edge) && gids.has(edge.src) && gids.has(edge.dst)
    && isNumber(edge.sum_kzt) && isCount(edge.n_tx) && isCount(edge.depth))) return fail()
  if (!clusters.every((cluster) => isRecord(cluster) && isCount(cluster.cluster_id)
    && isCount(cluster.n_nodes) && isCount(cluster.n_seed) && isNumber(cluster.sum_kzt_internal)
    && typeof cluster.hypothesis === "string" && Array.isArray(cluster.top_gids)
    && cluster.top_gids.every((gid: unknown) => gids.has(gid)))) return fail()
  const clusterIds = new Set(clusters.map((cluster) => cluster.cluster_id))
  if (clusterIds.size !== clusters.length || !nodes.every((node) => clusterIds.has(node.cluster_id))) return fail()
  if (!topNodes.every((node) => isRecord(node) && isCount(node.rank) && gids.has(node.gid)
    && isRole(node.role) && isScore(node.priority_score) && typeof node.why === "string")) return fail()
  return value as MoneyGraphData
}

export function indexMoneyGraph(data: MoneyGraphData) {
  const nodesById = new Map(data.nodes.map((node) => [node.gid, node]))
  const membersByCluster = new Map<number, MoneyNode[]>()
  for (const node of data.nodes) {
    const members = membersByCluster.get(node.cluster_id) ?? []
    members.push(node)
    membersByCluster.set(node.cluster_id, members)
  }
  for (const members of membersByCluster.values()) {
    members.sort((a, b) => b.priority_score - a.priority_score || a.gid.localeCompare(b.gid))
  }
  return { nodesById, membersByCluster }
}

export function filterTopNodes(
  data: MoneyGraphData,
  nodesById: Map<string, MoneyNode>,
  role: MoneyRole | "all",
  cluster: number | "all",
) {
  // Filter the entire exported list; preserve original ranks and scores.
  return data.topNodes.filter((node) =>
    (role === "all" || node.role === role)
    && (cluster === "all" || nodesById.get(node.gid)?.cluster_id === cluster)
  )
}
