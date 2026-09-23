import { EXPORT_FILES, getAnalysis, type ExportName } from "@/lib/server/analysis-store"
import { sameOrigin } from "@/lib/server/request-guard"
import { checkDemoAccess } from "@/lib/server/demo-access"

export const runtime = "nodejs"
export async function GET(request: Request, context: { params: Promise<{ id: string; file: string }> }) {
  const denied = checkDemoAccess(request)
  if (denied) return denied
  if (!sameOrigin(request)) return Response.json({error:"Запрос с другого сайта запрещён."},{status:403})
  const {id,file} = await context.params
  if (!EXPORT_FILES.includes(file as ExportName)) return Response.json({error:"Неизвестный файл."},{status:404})
  const saved = getAnalysis(id)
  if (!saved) return Response.json({error:"Расчёт истёк или сервер был перезапущен. Выполните расчёт заново."},{status:410})
  return new Response(saved.exports[file as ExportName], {headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${file}"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})
}
