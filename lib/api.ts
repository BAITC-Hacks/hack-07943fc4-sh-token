import { parseMoneyGraph } from "@/lib/graph-data"
import type { AnalysisResult, AnalysisSource } from "@/lib/graph-types"
import type { AssistantAnswer } from "@/lib/graph-investigation"

export async function askGraphAssistant(body:{runId:string;question:string;focusGid:string;selectedGids:string[]}):Promise<{answer:AssistantAnswer;intent:string;model:string}>{
  const response=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||"Ассистент недоступен. Повторите запрос.")
  return result
}

export async function downloadAnalysisCsv(runId:string,name:string){
  const response=await fetch(`/api/analysis/${encodeURIComponent(runId)}/${encodeURIComponent(name)}`,{cache:"no-store"})
  if(!response.ok){const result=await response.json();throw new Error(result.error||"Не удалось скачать файл. Повторите анализ.")}
  const url=URL.createObjectURL(await response.blob()),link=document.createElement("a")
  link.href=url;link.download=name;link.click();URL.revokeObjectURL(url)
}

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
