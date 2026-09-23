import type { AnalysisRun, MoneyGraphData, MoneyNode } from "./graph-types"

export function toggleReviewGid(current: string[], gid: string) {
  return current.includes(gid) ? current.filter((value) => value !== gid) : [...current, gid]
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
  // Avoid spreadsheet formula injection in text supplied by an input file.
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

/** UTF-8 BOM + RFC 4180 quoting; GIDs never pass through Number. */
export function buildReviewCsv(nodes: MoneyNode[], graph: MoneyGraphData, run: AnalysisRun) {
  const headers = ["gid", "role", "role_score", "priority_score", "cluster_id", "is_seed", "depth", "truncated_by_depth", "in_kzt", "out_kzt", "in_deg", "out_deg", "evidence", "why", "run_id", "calculated_at", "period_start", "period_end", "source"]
  const whyById = new Map(graph.topNodes.map((node) => [node.gid, node.why]))
  const rows = nodes.map((node) => [node.gid, node.role, node.role_score, node.priority_score, node.cluster_id, node.is_seed, node.depth, node.truncated_by_depth, node.in_kzt, node.out_kzt, node.in_deg, node.out_deg, node.evidence, whyById.get(node.gid) ?? node.evidence, run.id, run.completedAt, graph.meta.periodStart, graph.meta.periodEnd, run.source])
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n"
}
