"use client"

import * as React from "react"
import { ArrowUpRight, ChevronDown, Send, X } from "lucide-react"
import { BotAvatar } from "bot-avatars"
import { Button } from "@/components/ui/button"
import { askGraphAssistant } from "@/lib/api"
import type { AssistantAnswer } from "@/lib/graph-investigation"

type Message = { question: string; answer: AssistantAnswer; model: string }

function AnalystAvatar({ busy, size = 40 }: { busy: boolean; size?: number }) {
  const [color, setColor] = React.useState<string>()
  // Canvas needs the resolved token, not a CSS var() expression.
  const bind = React.useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas) setColor(getComputedStyle(canvas).getPropertyValue(busy ? "--primary" : "--sky").trim())
  }, [busy])
  return <BotAvatar ref={bind} type="mech" state={busy ? "working" : "default"} color={color} size={size}
    shading="crisp" theme="dark" saturation={1} seed={0.4} jumpEvery={0} interactive={false}
    aria-label={busy ? "AI-аналитик работает" : "AI-аналитик готов"} />
}

/** Mounted independently of workspace tabs: closing the panel retains the conversation. */
export function GraphAssistant({ runId, gid, review, onNode, onOpen }: {
  runId?: string; gid: string; review: string[]; onNode: (gid: string) => void; onOpen?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [question, setQuestion] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [messages, setMessages] = React.useState<Message[]>([])
  const [config, setConfig] = React.useState<{ configured: boolean; model: string | null } | null>(null)
  const bottom = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLTextAreaElement>(null)
  const launcher = React.useRef<HTMLButtonElement>(null)
  const available = !!runId && !!gid

  React.useEffect(() => {
    let active = true
    fetch("/api/assistant").then(r => r.json()).then(c => { if (active) setConfig(c) })
      .catch(() => { if (active) setError("Не удалось проверить подключение ассистента.") })
    return () => { active = false }
  }, [])
  React.useEffect(() => { if (open) input.current?.focus() }, [open])
  React.useEffect(() => { if (open && messages.length) bottom.current?.scrollIntoView({ block: "nearest" }) }, [messages.length, open])
  function close() { setOpen(false); launcher.current?.focus() }
  function inspect(g: string) { onNode(g); close() }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !available || !question.trim()) return
    setBusy(true); setError("")
    const asked = question.trim()
    try {
      const result = await askGraphAssistant({ runId: runId!, question: asked, focusGid: gid, selectedGids: review.slice(0, 10) })
      setMessages(m => [...m, { question: asked, answer: result.answer, model: result.model }]); setQuestion("")
    } catch (e) { setError(e instanceof Error ? e.message : "Ассистент недоступен.") }
    finally { setBusy(false) }
  }

  return <div className="analyst-workspace">
    <section id="assistant-dock" hidden={!open} aria-label="AI-ассистент аналитика"
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close() } }}
      className="fixed right-4 bottom-24 z-60 flex h-[min(740px,calc(100dvh-116px))] w-[min(480px,calc(100vw-32px))] flex-col border border-line-strong bg-background shadow-glow data-[closed=true]:hidden"
      data-closed={!open}>
      <div className="flex shrink-0 items-center gap-3 border-b border-border p-4">
        {open && <AnalystAvatar busy={busy} />}
        <div className="min-w-0 flex-1"><h2 className="text-base">AI-ассистент</h2><p className="hud-num mt-1 text-[10px] text-sky">{busy ? "РАБОТАЮ С ЗАПРОСОМ" : config?.model || "ПРОВЕРКА ПОДКЛЮЧЕНИЯ"}</p></div>
        <Button size="icon-sm" variant="ghost" aria-label="Свернуть AI-ассистента" onClick={close}><X /></Button>
      </div>
      {available && <details className="shrink-0 border-b border-border px-4 py-3 text-xs"><summary className="cursor-pointer text-muted-foreground">Контекст: <span className="hud-num text-sky">{gid}</span> · список {Math.min(10, review.length)}</summary><div className="mt-3 space-y-2 leading-5 text-muted-foreground"><p>Открытый клиент и первые десять из списка проверки. Другие GID можно указать в вопросе. Каждый вопрос независим от предыдущих реплик.</p><Button variant="outline" size="sm" disabled={review.length < 2} onClick={() => { setQuestion("Кто общий прямой получатель у клиентов из списка проверки?"); input.current?.focus() }}>Найти общих получателей</Button></div></details>}
      <div className="min-h-0 flex-1 space-y-5 overflow-auto overscroll-contain p-4" role="log" aria-label="Ответы ассистента">
        {!available ? <div className="space-y-3 py-5"><h3 className="text-lg">Готов исследовать сеть вместе с вами</h3><p className="text-sm leading-6 text-muted-foreground">Сначала запустите анализ. Затем я помогу найти получателей, объяснить связи и собрать справку по выбранному клиенту.</p><p className="text-xs leading-6 text-sky">1. Начните исследование.<br />2. Выберите клиента на графе.<br />3. Задайте вопрос здесь — без перехода на другой экран.</p></div> : !messages.length && <div className="space-y-3 py-2"><h3 className="text-lg">Что проверим в этой сети?</h3><p className="text-xs leading-6 text-muted-foreground">Вопрос — модели. Суммы, роли и ссылки — из текущего расчёта.</p><div className="grid gap-2">{["Составь справку по выбранному клиенту", "Кому он переводит?", "Каких данных не хватает?", "Покажи повторяющиеся маршруты"].map(q => <Button key={q} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => { setQuestion(q); input.current?.focus() }}>{q}</Button>)}</div></div>}
        {messages.map((m, i) => <article key={i} className="space-y-4 border-b border-border pb-5">
          <p className="border-l-2 border-primary pl-3 text-sm leading-6">{m.question}</p>
          <div className="space-y-3"><h3 className="text-base text-sky">{m.answer.title}</h3><p className="text-xs leading-6">{m.answer.summary}</p>
            {m.answer.facts.map((f, j) => <div key={j} className="space-y-2 border border-border p-3"><p className="text-xs leading-6">{f.text}</p><div className="flex flex-wrap gap-2">{f.gids.map(g => <button key={g} className="hud-num inline-flex items-center gap-1 border border-sky/30 px-2 py-1 text-[11px] text-sky hover:bg-sky/10" onClick={() => inspect(g)} aria-label={"Открыть из ответа " + g}>{g}<ArrowUpRight className="size-3" /></button>)}</div></div>)}
            <details><summary className="cursor-pointer text-xs text-warning">Ограничения ответа</summary><ul className="mt-2 list-disc space-y-2 pl-4 text-xs leading-5 text-muted-foreground">{m.answer.limitations.map((l, j) => <li key={j}>{l}</li>)}</ul></details>
            <p className="text-[10px] text-dim">{m.model} · Факты текущего расчёта STRATA</p>
          </div>
        </article>)}
        {busy && <div role="status" data-agent="working" className="space-y-2 p-4"><p className="text-sm text-primary">Разбираю вопрос и проверяю факты…</p><p className="text-xs text-muted-foreground">Можно свернуть чат — запрос продолжится.</p></div>}
        <div ref={bottom} />
      </div>
      <form className="shrink-0 space-y-3 border-t border-border p-4" onSubmit={submit}>
        {config && !config.configured && <p role="alert" className="text-xs text-warning">Настройте OPENAI_API_KEY и OPENAI_MODEL в .env.local и перезапустите сервер.</p>}
        {error && <p role="alert" className="max-h-24 overflow-auto border border-destructive/40 p-2 text-xs leading-5 text-destructive">{error}</p>}
        <textarea ref={input} aria-label="Вопрос ассистенту" value={question} onChange={e => setQuestion(e.target.value)} maxLength={1200} rows={2} disabled={!available}
          placeholder={available ? "Спросите о клиенте или денежных связях…" : "Сначала выполните анализ"}
          className="w-full resize-none border border-border bg-panel p-3 text-sm leading-6 focus:outline-sky disabled:opacity-50" />
        <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-dim">{question.length} / 1 200</span><Button type="submit" disabled={busy || !available || !question.trim() || !config?.configured}><Send className="size-4" />Спросить по графу</Button></div>
        <p className="text-[10px] leading-4 text-muted-foreground">Вопрос отправляется в OpenAI; GID заменяются псевдонимами. Граф и суммы не отправляются. Не вводите конфиденциальные данные.</p>
      </form>
    </section>
    <button ref={launcher} aria-label={open ? "Свернуть AI-ассистента" : "Открыть AI-ассистента"} aria-expanded={open} aria-controls="assistant-dock"
      onClick={() => { if (!open) onOpen?.(); setOpen(v => !v) }} className="fixed right-4 bottom-5 z-60 flex items-center gap-3 border border-line-strong bg-background px-4 py-3 text-left shadow-glow transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
      {!open && <AnalystAvatar busy={busy} />}
      <span><span className="block text-sm">AI-ассистент</span><span className="mt-1 block text-[10px] text-sky">{busy ? "Проверяю запрос…" : open ? "Свернуть панель" : "Спросить по графу"}</span></span>
      {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <span className="size-1.5 rounded-full bg-sky" />}
    </button>
  </div>
}
