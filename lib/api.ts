import { parseMoneyGraph } from "@/lib/graph-data"
import type { AnalysisResult, AnalysisSource } from "@/lib/graph-types"

export async function analyzeMoneyGraph(source: AnalysisSource, files: File[] = []): Promise<AnalysisResult> {
  const form = new FormData()
  form.set("source", source)
  if (source === "upload") for (const file of files) form.append(file.name, file)
  const response = await fetch("/api/analysis", { method: "POST", body: form, cache: "no-store" })
  const result = await response.json()
  if (!response.ok) {
    throw new Error(`${result.error || `HTTP ${response.status}`} ${result.action || "Повторите загрузку."}`)
  }
  return { graph: parseMoneyGraph(result.graph), run: result.run }
}
