import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { AnalysisError, checkParquet, MAX_REQUEST_BYTES, PARQUET_FILES, validateUpload } from "@/lib/analysis-contract"
import { parseMoneyGraph } from "@/lib/graph-data"
import type { AnalysisResult, AnalysisSource } from "@/lib/graph-types"
import { saveAnalysis, EXPORT_FILES, type ExportName } from "./analysis-store"

const execute = promisify(execFile)
const runtimeState = globalThis as typeof globalThis & { orionAnalysisBusy?: boolean }

/** Bound the raw multipart body too, not only the sizes reported by File. */
async function readForm(request: Request): Promise<FormData> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    throw new AnalysisError("Ожидается форма с parquet-файлами.", "Запустите расчёт через форму загрузки.", 415)
  }
  const declared = Number(request.headers.get("content-length"))
  if (declared > MAX_REQUEST_BYTES) throw new AnalysisError("Выгрузка слишком большая.", "Лимит: 25 МиБ на каждый файл.", 413)
  const reader = request.body?.getReader()
  if (!reader) throw new AnalysisError("Пустой запрос.", "Выберите файлы и повторите загрузку.")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new AnalysisError("Выгрузка слишком большая.", "Лимит: 25 МиБ на каждый файл.", 413)
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type")! } }).formData()
  } catch {
    throw new AnalysisError("Не удалось прочитать форму загрузки.", "Выберите файлы заново и повторите отправку.")
  }
}

export async function runAnalysisRequest(request: Request): Promise<AnalysisResult> {
  const origin = request.headers.get("origin")
  let originHost: string | undefined
  try { if (origin) originHost = new URL(origin).host } catch {
    throw new AnalysisError("Некорректный Origin запроса.", "Откройте интерфейс на адресе этого сервера.", 403)
  }
  // The local jury tool is not a cross-origin compute service.
  if ((origin && originHost !== request.headers.get("host")) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AnalysisError("Запуск с другого сайта запрещён.", "Откройте интерфейс на адресе этого сервера.", 403)
  }
  if (runtimeState.orionAnalysisBusy) {
    throw new AnalysisError("На сервере уже выполняется расчёт.", "Дождитесь его завершения и повторите запуск.", 409)
  }
  runtimeState.orionAnalysisBusy = true
  let directory: string | undefined
  try {
    const form = await readForm(request)
    const source = form.get("source") as AnalysisSource
    if (!['upload', 'organizers'].includes(source) || form.getAll("source").length !== 1) {
      throw new AnalysisError("Не указан источник данных.", "Выберите свои файлы или предзагруженный кейс организаторов.")
    }
    const uploads = source === "upload" ? validateUpload(form) : []
    if (source === "organizers" && [...form.keys()].some((key) => key !== "source")) {
      throw new AnalysisError("Нельзя смешивать файлы с предзагруженным кейсом.", "Выберите один источник данных.")
    }
    const root = process.cwd()
    const python = process.env.ORION_PYTHON || path.join(root, "pipeline", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
    try { await stat(python) } catch {
      throw new AnalysisError("Python-окружение пайплайна не подготовлено.", "В терминале выполните uv sync --project pipeline --locked и повторите расчёт. Для другого Python задайте ORION_PYTHON.", 503)
    }
    directory = await mkdtemp(path.join(tmpdir(), "orion-analysis-"))
    const input = path.join(directory, "data")
    const output = path.join(directory, "out")
    const web = path.join(directory, "web")
    await mkdir(input)
    if (source === "upload") {
      for (const { name, file } of uploads) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        checkParquet(bytes, name)
        await writeFile(path.join(input, name), bytes, { mode: 0o600 })
      }
    } else {
      for (const name of PARQUET_FILES) await copyFile(path.join(root, "data", name), path.join(input, name))
    }
    const files = await Promise.all(PARQUET_FILES.map(async (name) => ({ name, size: (await stat(path.join(input, name))).size })))
    try {
      // Fixed executable/arguments, no shell; the existing CLI owns every score and role.
      await execute(python, [path.join(root, "pipeline", "main.py"), "--data", input, "--out", output, "--web", web], {
        cwd: root, timeout: 300_000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024,
        signal: request.signal, env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONPATH: path.join(root, "pipeline", "src"), PYTHONNOUSERSITE: "1" },
      })
    } catch (error) {
      const failure = error as Error & { stderr?: string; killed?: boolean; code?: string }
      if (failure.killed || failure.name === "AbortError") {
        throw new AnalysisError("Расчёт прерван или превысил лимит 5 минут.", "Проверьте объём выгрузки и повторите запуск локально.", 504)
      }
      const reason = failure.stderr?.trim().split("\n").at(-1)?.replaceAll(directory, "[временная папка]").slice(0, 500)
      if (failure.code === "ENOENT" || /ModuleNotFoundError|ImportError/.test(reason ?? "")) {
        throw new AnalysisError(`Не готово окружение Python: ${reason || "исполняемый файл не найден"}`, "Выполните uv sync --project pipeline --locked. Убедитесь, что ORION_PYTHON указывает на подготовленное окружение.", 503)
      }
      throw new AnalysisError(`Пайплайн отклонил данные: ${reason || "процесс завершился с ошибкой"}`, "Проверьте схемы, даты и соответствие сумм/пар переводов в трёх parquet. Используйте один комплект выгрузки.", 422)
    }
    const graph = parseMoneyGraph(JSON.parse(await readFile(path.join(web, "graph.json"), "utf8")))
    const log = JSON.parse(await readFile(path.join(web, "run_log.json"), "utf8"))
    if (log.status !== "done" || !Number.isFinite(log.elapsedSeconds) || !Array.isArray(log.steps)) {
      throw new AnalysisError("Пайплайн не вернул корректный журнал завершения.", "Проверьте установку и запустите npm run analyze в терминале.", 500)
    }
    const result: AnalysisResult = { graph, run: {
      id: randomUUID(), source, completedAt: new Date().toISOString(),
      seedCount: graph.nodes.filter((node) => node.is_seed).length,
      elapsedSeconds: log.elapsedSeconds, steps: log.steps, files,
    } }
    const exports = Object.fromEntries(await Promise.all(EXPORT_FILES.map(async name => [name, await readFile(path.join(output, name), "utf8")]))) as Record<ExportName, string>
    saveAnalysis(result, exports)
    return result
  } finally {
    try {
      // Only this request's mkdtemp directory is removed, never shared case data.
      if (directory) await rm(directory, { recursive: true, force: true })
    } finally { runtimeState.orionAnalysisBusy = false }
  }
}
