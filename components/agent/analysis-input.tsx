import * as React from "react"
import { Database, LoaderCircle, Upload } from "lucide-react"
import { DecodeText } from "@/components/hud/hud-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MAX_FILE_BYTES, PARQUET_FILES } from "@/lib/analysis-contract"
import type { AnalysisSource } from "@/lib/graph-types"

export function AnalysisInput({ busy, error, reviewCount, onRun, onBack }: {
  busy: boolean
  error: string
  reviewCount: number
  onRun: (source: AnalysisSource, files?: File[]) => void
  onBack?: () => void
}) {
  const [files, setFiles] = React.useState<Record<string, File>>({})
  const [consent, setConsent] = React.useState(false)
  const issues = PARQUET_FILES.flatMap((name) => {
    const file = files[name]
    if (!file) return []
    if (file.name !== name) return [`Для ${name} выбран ${file.name}. Выберите правильный файл.`]
    if (file.size === 0 || file.size > MAX_FILE_BYTES) return [`${name}: нужен непустой файл до 25 МиБ.`]
    return []
  })
  const ready = PARQUET_FILES.every((name) => files[name]) && !issues.length
  const canReplace = !reviewCount || consent
  return <section className="mx-auto max-w-5xl space-y-4 py-6" aria-busy={busy}>
    <header className="space-y-3">
      <p className="hud-caps text-xs text-sky">AML / от исходных GID к списку проверки</p>
      <DecodeText as="h1" text="ГРАФ ДЕНЕГ" className="hud-caps text-[32px] md:text-5xl" />
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Исходные GID от правоохранительных органов отмечены признаком seed в nodes.parquet. Загрузите выгрузку исходящих переводов на четыре колена: сервер рассчитает граф, роли-гипотезы и приоритеты.</p>
      <p className="hud-num text-xs text-dim">Parquet → Python → потоки и кластеры → кандидаты → ваш список → CSV</p>
    </header>
    <Card data-agent={busy ? "working" : error ? "error" : undefined}>
      <CardHeader><CardDescription className="hud-caps text-primary">01 / Входные данные</CardDescription><CardTitle>Загрузить выгрузку переводов</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={(event) => { event.preventDefault(); if (ready && canReplace) onRun("upload", PARQUET_FILES.map((name) => files[name])) }} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {PARQUET_FILES.map((name) => <div key={name} className="min-w-0 space-y-2 border border-border bg-background p-3">
              <label className="hud-num block text-xs text-foreground" htmlFor={`file-${name}`}>{name}</label>
              <Input id={`file-${name}`} aria-label={name} type="file" accept=".parquet" disabled={busy}
                className="h-auto w-full min-w-0 py-2 text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setFiles((previous) => { const next = { ...previous }; if (file) next[name] = file; else delete next[name]; return next })
                }} />
              <p className="text-xs text-dim">{files[name] ? `${(files[name].size / 1024).toFixed(1)} КиБ` : "Файл не выбран"}</p>
            </div>)}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">Три файла одного комплекта, до 25 МиБ каждый. Число seed, период, суммы и роли будут прочитаны из ваших данных — не из примера.</p>
          {issues.map((issue) => <p key={issue} role="alert" className="text-xs text-destructive">{issue}</p>)}
          {reviewCount > 0 && <label className="flex items-start gap-3 border border-warning/40 p-3 text-xs text-warning">
            <input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
            При успешном новом расчёте очистить текущий список проверки ({reviewCount}). Если он нужен, сначала вернитесь к результату и экспортируйте CSV.
          </label>}
          <Button type="submit" disabled={!ready || !canReplace || busy}><Upload />Рассчитать загруженные файлы</Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <div className="max-w-xl space-y-1"><p className="text-sm text-foreground">Предзагруженный кейс организаторов</p><p className="text-xs leading-5 text-muted-foreground">Те же реальные data/*.parquet из репозитория. Кнопка запускает новый расчёт Python, а не открывает готовую картинку.</p></div>
          <Button variant="outline" disabled={!canReplace || busy} onClick={() => onRun("organizers")}><Database />Рассчитать предзагруженный кейс</Button>
        </div>
        {busy && <div role="status" className="space-y-3 border border-primary/40 bg-background p-4">
          <p className="flex items-center gap-2 text-primary"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />Передаём данные и ожидаем завершения Python-пайплайна</p>
          <p className="text-xs leading-5 text-muted-foreground">Проверка parquet → признаки → кластеры → роли и приоритеты. Это план расчёта, не индикатор текущего этапа. Проценты готовности неизвестны; результат появится только после завершения процесса. Не закрывайте вкладку.</p>
        </div>}
        {error && <div role="alert" className="space-y-2 border border-destructive/50 p-4"><p className="text-sm text-destructive">{error}</p><p className="text-xs text-muted-foreground">Исправьте причину и снова нажмите кнопку расчёта. Файлы остались выбраны; тестовые результаты не подставляются.</p></div>}
        <p className="text-xs leading-5 text-dim">Файлы обрабатываются локальным сервером и удаляются из временной папки после запроса. Внешние сервисы не используются. На четвёртом колене сеть обрезана; у seed входящий поток неполон. Роль — гипотеза, не обвинение.</p>
        {onBack && !busy && <Button variant="ghost" onClick={onBack}>Вернуться к предыдущему результату</Button>}
      </CardContent>
    </Card>
  </section>
}
