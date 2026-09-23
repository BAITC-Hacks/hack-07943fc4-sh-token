import type { AnalysisResult } from "../graph-types"

export const EXPORT_FILES = ["nodes_roles.csv", "clusters.csv", "top_nodes.csv"] as const
export type ExportName = typeof EXPORT_FILES[number]
type SavedRun = { result: AnalysisResult; exports: Record<ExportName, string>; expires: number; bytes: number }
const state = globalThis as typeof globalThis & { strataRuns?: Map<string, SavedRun> }
const runs: Map<string, SavedRun> = state.strataRuns ??= new Map<string, SavedRun>()
const TTL = 60 * 60 * 1000
const MAX_BYTES = 32 * 1024 * 1024
function prune(now: number) { for (const [id, run] of runs) if (run.expires <= now) runs.delete(id) }

/** Random run id is a local capability. No raw parquet and no disk persistence. */
export function saveAnalysis(result: AnalysisResult, exports: Record<ExportName, string>, now = Date.now()) {
  prune(now)
  const bytes = Buffer.byteLength(JSON.stringify(result)) + Object.values(exports).reduce((n, csv) => n + Buffer.byteLength(csv), 0)
  if (bytes > MAX_BYTES) throw new Error("Результат превышает лимит локального хранилища 32 МиБ.")
  while (runs.size >= 4 || [...runs.values()].reduce((n, run) => n + run.bytes, 0) + bytes > MAX_BYTES) runs.delete(runs.keys().next().value!)
  runs.set(result.run.id, { result, exports, bytes, expires: now + TTL })
}
export function getAnalysis(id: string, now = Date.now()) { prune(now); return runs.get(id) }
