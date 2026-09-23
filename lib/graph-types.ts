export type MoneyRole =
  | "consolidator"
  | "transit"
  | "distributor"
  | "terminal"
  | "coordinator"
  | "peripheral"

export type MoneyNode = {
  signals?: {
    peak_day: string | null
    peak_day_tx: number
    daily_average_tx: number
    activity_spike: boolean
    synchronous_payers: number
    synchronous_day: string | null
    near_threshold_max_daily: number
    turnover_outlier: boolean
    depth_turnover_upper_fence: number
    depth_peer_count: number
  }
  gid: string
  role: MoneyRole
  role_score: number
  cluster_id: number
  priority_score: number
  evidence: string
  depth: number
  is_seed: boolean
  in_deg: number
  out_deg: number
  in_kzt: number
  out_kzt: number
  seed_reach: number
  quick_forward_ratio: number
  truncated_by_depth: boolean
}

export type MoneyEdge = {
  src: string
  dst: string
  sum_kzt: number
  n_tx: number
  depth: number
}

export type ClusterSummary = {
  cluster_id: number
  n_nodes: number
  n_seed: number
  sum_kzt_internal: number
  top_gids: string[]
  hypothesis: string
}

export type TopNode = {
  rank: number
  gid: string
  role: MoneyRole
  priority_score: number
  why: string
}

export type MoneyGraphMeta = {
  nodes: number
  edges: number
  transactions: number
  turnoverKzt: number
  periodStart: string
  periodEnd: string
  roleCounts: Partial<Record<MoneyRole, number>>
}

export type MoneyGraphData = {
  patterns?: {
    chains: { gids: string[]; occurrences: number; distinct_days: number; examples: string[][] }[]
    cycles: { gids: string[]; occurrences: number; examples: string[][] }[]
    chain_count: number; cycle_count: number; chain_search_limited: boolean; cycle_search_limited: boolean
    max_hop_days: number; max_cycle_length: number; max_results: number
  }
  meta: MoneyGraphMeta
  nodes: MoneyNode[]
  edges: MoneyEdge[]
  clusters: ClusterSummary[]
  topNodes: TopNode[]
}

export type AnalysisSource = "upload" | "organizers"

export type AnalysisRun = {
  id: string
  source: AnalysisSource
  completedAt: string
  seedCount: number
  elapsedSeconds: number
  steps: string[]
  files: { name: string; size: number }[]
}

export type AnalysisResult = { graph: MoneyGraphData; run: AnalysisRun }
