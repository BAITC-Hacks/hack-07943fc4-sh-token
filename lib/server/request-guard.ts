export function sameOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false
  const origin = request.headers.get("origin")
  try { return !origin || new URL(origin).host === request.headers.get("host") } catch { return false }
}
export async function boundedJson(request: Request, limit = 16_384): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Нужен JSON-запрос.")
  const reader = request.body?.getReader()
  if (!reader) throw new Error("Пустой запрос.")
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const {value,done} = await reader.read(); if(done)break
      size += value.byteLength
      if(size>limit){await reader.cancel();throw new Error("Запрос слишком длинный.")}
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}
