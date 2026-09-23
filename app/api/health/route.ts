import { access } from "node:fs/promises"
import path from "node:path"
import { demoAccessConfigured, demoAccessRequired } from "@/lib/server/demo-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Public readiness only: no model name, key, paths, data or paid API calls.
export async function GET() {
  let ready = !demoAccessRequired() || demoAccessConfigured()
  try {
    const python = process.env.ORION_PYTHON || path.join(process.cwd(), "pipeline/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
    await Promise.all([python, "pipeline/main.py", "data/nodes.parquet", "data/edges.parquet", "data/transactions.parquet"].map(file => access(file)))
  } catch { ready = false }
  return Response.json({ status: ready ? "ok" : "unavailable" }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } })
}
