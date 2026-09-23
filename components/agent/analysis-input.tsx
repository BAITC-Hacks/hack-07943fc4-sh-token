import * as React from "react"
import { ArrowRight, Check, Database, LoaderCircle, Upload } from "lucide-react"
import { DecodeText } from "@/components/hud/hud-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MAX_FILE_BYTES, PARQUET_FILES } from "@/lib/analysis-contract"
import type { AnalysisSource } from "@/lib/graph-types"

export function AnalysisInput({ busy, error, reviewCount, onRun, onBack }: {
  busy: boolean; error: string; reviewCount: number
  onRun: (source: AnalysisSource, files?: File[]) => void; onBack?: () => void
}) {
  const [files, setFiles] = React.useState<Record<string, File>>({})
  const [upload, setUpload] = React.useState(false)
  const [issue, setIssue] = React.useState("")
  const [consent, setConsent] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const ready = !issue && PARQUET_FILES.every((name) => files[name])
  const canReplace = !reviewCount || consent
  function accept(list: File[]) {
    const next = { ...files }
    const issues: string[] = []
    for (const file of list) {
      if (!PARQUET_FILES.includes(file.name as typeof PARQUET_FILES[number])) { issues.push("Неизвестный файл: " + file.name); continue }
      if (!file.size || file.size > MAX_FILE_BYTES) { issues.push(file.name + ": нужен непустой файл до 25 МиБ"); continue }
      next[file.name] = file
    }
    setFiles(next); setIssue(issues.join(". "))
  }
  return <section className="mx-auto flex min-h-[85dvh] max-w-4xl flex-col justify-center gap-7 py-6" aria-busy={busy}>
    <header className="space-y-4">
      <div className="flex items-center gap-3"><span className="hud-tag text-sky"><span className="hud-dot" /> FINANCIAL INTELLIGENCE</span><span className="text-xs text-dim">Локальный анализ</span></div>
      <DecodeText as="h1" text="STRATA" className="hud-caps text-6xl md:text-8xl" />
      <p className="max-w-xl text-xl text-foreground">Раскройте структуру денежных потоков.</p>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">От исходных клиентов — к обоснованному списку проверки. Проследите связи, изучите роли и выберите, кого проверять первым.</p>
    </header>
    <Card data-agent={busy ? "working" : error ? "error" : "waiting"}>
      <CardContent className="space-y-5 py-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Источник анализа">
          <Button variant={!upload ? "secondary" : "ghost"} disabled={busy} aria-pressed={!upload} onClick={() => setUpload(false)}><Database />Кейс организаторов</Button>
          <Button variant={upload ? "secondary" : "ghost"} disabled={busy} aria-pressed={upload} onClick={() => setUpload(true)}><Upload />Своя выгрузка</Button>
        </div>
        {upload ? <div className="space-y-3 hud-reveal">
          <input ref={input} type="file" multiple accept=".parquet" aria-label="Выбрать три parquet-файла" className="sr-only" disabled={busy}
            onChange={(event) => { accept(Array.from(event.target.files ?? [])); event.target.value = "" }} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) accept(Array.from(event.dataTransfer.files)) }}
            className={"w-full border border-dashed p-6 text-center transition-colors " + (dragging ? "border-primary bg-primary/5" : "border-line-strong bg-background hover:border-primary")}>
            <Upload className="mx-auto mb-3 size-5 text-primary" /><span className="text-sm">Перетащите три файла сюда или выберите их вместе</span>
          </button>
          <div className="flex flex-wrap gap-2">{PARQUET_FILES.map((name) => <span key={name} className={"hud-tag hud-num " + (files[name] ? "text-sky" : "text-dim")}>{files[name] && <Check className="size-3" />}{name}</span>)}</div>
          <p className="text-xs text-dim">Один комплект · до 25 МиБ на файл · недостающие файлы можно добавить</p>
          {issue && <p role="alert" className="text-xs text-destructive">{issue}</p>}
        </div> : <div className="hud-reveal space-y-2"><h2 className="text-lg">Данные готовы к исследованию</h2><p className="max-w-xl text-sm leading-6 text-muted-foreground">Полная обезличенная выгрузка организаторов уже подключена. Одно действие запускает новый расчёт по исходным файлам.</p></div>}
        {reviewCount > 0 && <label className="flex items-start gap-2 text-xs text-warning"><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />Новый расчёт заменит текущий список ({reviewCount}). Список экспортирован или больше не нужен.</label>}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={busy || !canReplace || (upload && !ready)} data-loading={busy || undefined}
            onClick={() => onRun(upload ? "upload" : "organizers", upload ? PARQUET_FILES.map((name) => files[name]) : [])}>
            {busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <ArrowRight />}{busy ? "Выполняется расчёт" : "Начать исследование"}
          </Button>
          {onBack && !busy && <Button variant="ghost" onClick={onBack}>Вернуться к результату</Button>}
        </div>
        {busy && <p role="status" className="hud-beam py-3 text-sm text-sky">Проверяем данные и рассчитываем сеть. Результат появится после завершения обработки.</p>}
        {error && <div role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">{error}</div>}
      </CardContent>
    </Card>
    <div className="grid gap-4 text-xs text-muted-foreground sm:grid-cols-3">{["01 / Проследить потоки", "02 / Понять приоритеты", "03 / Выбрать и выгрузить"].map((label) => <p key={label} className="hud-caps border-t border-border pt-3">{label}</p>)}</div>
    <p className="text-xs text-dim">Файлы остаются на локальном сервере. Выводы — гипотезы для проверки по наблюдаемой сети.</p>
  </section>
}
