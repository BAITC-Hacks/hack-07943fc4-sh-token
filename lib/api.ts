import { parseMoneyGraph } from "@/lib/graph-data"
import type { MoneyGraphData } from "@/lib/graph-types"

const DASHBOARD_URL = "/data/graph.json"

export async function getMoneyGraph(signal?: AbortSignal): Promise<MoneyGraphData> {
  const response = await fetch(DASHBOARD_URL, {
    signal: signal ?? AbortSignal.timeout(15_000),
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Не удалось загрузить результаты: HTTP ${response.status}`)
  }
  return parseMoneyGraph(await response.json())
}
