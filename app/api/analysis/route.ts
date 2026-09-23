import { AnalysisError } from "@/lib/analysis-contract"
import { runAnalysisRequest } from "@/lib/server/run-analysis"
import { checkDemoAccess } from "@/lib/server/demo-access"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const denied = checkDemoAccess(request)
  if (denied) return denied
  try {
    return Response.json(await runAnalysisRequest(request), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const known = error instanceof AnalysisError
    return Response.json({
      error: known ? error.message : "Не удалось выполнить расчёт на сервере.",
      action: known ? error.action : "Проверьте наличие data/*.parquet и окружение pipeline/.venv. Затем повторите запуск.",
    }, { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } })
  }
}
