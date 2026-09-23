import { mockMoneyGraph } from "@/lib/mock/money-graph"
import type { MoneyGraphData } from "@/lib/graph-types"

const DASHBOARD_URL = "/data/graph.json"

export async function getMoneyGraph(signal?: AbortSignal): Promise<MoneyGraphData> {
  try {
    const response = await fetch(DASHBOARD_URL, { signal, cache: "no-store" })
    if (!response.ok) {
      throw new Error(`Не удалось загрузить результаты: HTTP ${response.status}`)
    }
    return (await response.json()) as MoneyGraphData
  } catch (error) {
    if (signal?.aborted) throw error
    if (process.env.NEXT_PUBLIC_DEMO_FALLBACK === "false") throw error
    return mockMoneyGraph
  }
}
