"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, Download, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { CountUp } from "@/components/hud/hud-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { analyzeMoneyGraph } from "@/lib/api"
import { indexMoneyGraph, isGid, MONEY_ROLES } from "@/lib/graph-data"
import type { AnalysisRun, AnalysisSource, MoneyGraphData, MoneyNode, MoneyRole } from "@/lib/graph-types"
import { buildReviewCsv, toggleReviewGid } from "@/lib/review-list"
import { duration, ease } from "@/lib/motion"
import { AnalysisInput } from "./analysis-input"
import { ReviewList } from "./review-list"
import { FlowExplorer, type GraphMode } from "./flow-explorer"
import { NodeInspector } from "./node-inspector"
import { AnalysisInsights } from "./analysis-insights"
import { money, ROLE_LABELS, RoleBadge, score } from "./graph-presentation"

type Tab = "explore" | "signals" | "review"
export function MoneyGraphDashboard() {
  const reduced = useReducedMotion()
  const [phase,setPhase] = React.useState<"idle"|"loading"|"done"|"error">("idle")
  const [data,setData] = React.useState<MoneyGraphData|null>(null)
  const [run,setRun] = React.useState<AnalysisRun|null>(null)
  const [review,setReview] = React.useState<string[]>([])
  const [gid,setGid] = React.useState("")
  const [history,setHistory] = React.useState<string[]>([])
  const [query,setQuery] = React.useState("")
  const [searchError,setSearchError] = React.useState("")
  const [error,setError] = React.useState("")
  const [tab,setTab] = React.useState<Tab>("explore")
  const [mode,setMode] = React.useState<GraphMode>("flows")
  const [cluster,setCluster] = React.useState<number|null>(null)
  const [role,setRole] = React.useState<MoneyRole|"all">("all")
  const [scope,setScope] = React.useState<"top"|"all">("top")
  const [limit,setLimit] = React.useState(100)
  const {nodesById,membersByCluster} = React.useMemo(()=>data?indexMoneyGraph(data):{nodesById:new Map<string,MoneyNode>(),membersByCluster:new Map<number,MoneyNode[]>()},[data])
  const selected = nodesById.get(gid)
  const calculate = async (source:AnalysisSource,files:File[] = []) => {
    setPhase("loading");setError("")
    try {
      const result=await analyzeMoneyGraph(source,files)
      setData(result.graph);setRun(result.run);setReview([]);setHistory([])
      setGid(result.graph.topNodes[0]?.gid??result.graph.nodes[0]?.gid??"")
      setCluster(null);setRole("all");setScope("top");setQuery("");setSearchError("");setTab("explore");setMode("flows")
      setPhase("done");toast.success("Сеть рассчитана. Можно начать проверку.")
    } catch (failure) {setError(failure instanceof Error?failure.message:"Не удалось завершить расчёт");setPhase("error")}
  }
  function openNode(next:string, targetCluster?:number) {
    const node=nodesById.get(next)
    if(!node)return
    if(targetCluster!==undefined)setCluster(targetCluster)
    else if(cluster!==null&&node.cluster_id!==cluster)setCluster(null)
    if(gid!==next)setHistory(previous=>[...previous,gid].slice(-30))
    setGid(next);setSearchError("");setTab("explore")
    if(mode==="clusters")setMode("flows")
  }
  function search() {
    const next=query.trim()
    if(!isGid(next)){setSearchError("Нужен точный GID из 18 цифр");return}
    if(!nodesById.has(next)){setSearchError("GID не найден в этой выгрузке");return}
    setCluster(null);setRole("all");setScope("all");openNode(next)
  }
  function openCluster(id:number) {
    setCluster(id);setScope("all");setRole("all");setLimit(100);setMode("flows")
    const first=membersByCluster.get(id)?.[0]
    if(first)openNode(first.gid,id)
  }
  function toggle(g:string) {
    const removing=review.includes(g)
    setReview(current=>toggleReviewGid(current,g))
    toast(removing?"Узел убран из списка":"Узел добавлен в список",{description:g,action:{label:"Отменить",onClick:()=>setReview(current=>removing?[...new Set([...current,g])]:current.filter(id=>id!==g))}})
  }
  function download() {
    if(!data||!run||!review.length)return
    const rows=review.map(id=>nodesById.get(id)!).filter(Boolean)
    const url=URL.createObjectURL(new Blob([buildReviewCsv(rows,data,run)],{type:"text/csv;charset=utf-8"}))
    const link=document.createElement("a");link.href=url;link.download="strata-review-"+run.id+".csv";link.click();URL.revokeObjectURL(url)
    toast.success("Выгружено клиентов: "+rows.length)
  }
  const candidates=React.useMemo(()=>{
    if(!data)return []
    const base=scope==="top"?data.topNodes.map(n=>nodesById.get(n.gid)!).filter(Boolean):[...data.nodes].sort((a,b)=>b.priority_score-a.priority_score||a.gid.localeCompare(b.gid))
    return base.filter(n=>(role==="all"||n.role===role)&&(cluster===null||n.cluster_id===cluster))
  },[data,nodesById,scope,role,cluster])
  if(phase!=="done"||!data||!run)return <AnalysisInput busy={phase==="loading"} error={error} reviewCount={review.length} onRun={calculate} onBack={data&&run?()=>setPhase("done"):undefined}/>
  if(!selected)return <div className="hud-panel p-8"><p>В выгрузке нет узлов.</p><Button onClick={()=>setPhase("idle")}>Выбрать данные</Button></div>
  const countItems=[["Узлы",data.nodes.length],["Исходные",run.seedCount],["Переводы",data.meta.transactions],["Кластеры",data.clusters.length]] as const
  return <section className="space-y-3" data-agent="done">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex items-center gap-4"><h1 className="hud-caps text-2xl tracking-widest">STRATA</h1><div className="hidden border-l border-border pl-4 text-xs leading-5 text-muted-foreground sm:block"><p>Исследование денежных потоков</p><p className="hud-num text-[10px]">{data.meta.periodStart} — {data.meta.periodEnd}</p></div></div>
      <form className="relative flex min-w-0 flex-1 gap-1 sm:max-w-sm" onSubmit={e=>{e.preventDefault();search()}}>
        <Input aria-label="Поиск по GID" aria-invalid={!!searchError} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Найти GID · 18 цифр" className="hud-num h-9 text-xs" inputMode="numeric"/>
        <Button size="icon" variant="outline" type="submit" aria-label="Найти узел"><Search/></Button>
        {searchError&&<p role="alert" className="absolute top-full z-20 border border-destructive bg-background p-2 text-xs text-destructive">{searchError}</p>}
      </form>
      <div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{setError("");setPhase("idle")}}>Новый анализ</Button><Button size="sm" disabled={!review.length} onClick={download}><Download/>Экспорт · {review.length}</Button></div>
    </header>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border pb-3 text-xs">
      {countItems.map(([label,value])=><span key={label} className="text-muted-foreground">{label} <CountUp to={value} className="ml-1 text-foreground"/></span>)}
      <span className="text-muted-foreground">Оборот <span className="hud-num ml-1 text-sky">{money.format(data.meta.turnoverKzt)} ₸</span></span>
      <details className="relative ml-auto text-xs"><summary className="cursor-pointer text-dim">Данные и расчёт</summary><div className="absolute right-0 top-full z-30 mt-2 w-72 space-y-2 border border-line-strong bg-background p-4 shadow-glow"><p>{run.source==="organizers"?"Кейс организаторов":"Загруженная выгрузка"}</p><p>{run.elapsedSeconds} с · {new Date(run.completedAt).toLocaleString("ru-RU")}</p><p className="hud-num break-all text-[10px]">{run.id}</p><p className="text-dim">{run.files.map(f=>f.name).join(" · ")}</p><p className="text-warning">Только внутрибанковские переводы от 5 000 ₸. Глубина наблюдения ограничена четырьмя коленами.</p></div></details>
    </div>
    <div className="flex flex-wrap items-center gap-1 border-b border-border" role="tablist" aria-label="Разделы исследования">
      {([["explore","Исследование"],["signals","Сигналы и сценарии"],["review","Список проверки · "+review.length]] as const).map(([id,label])=><Button key={id} role="tab" id={"tab-"+id} aria-selected={tab===id} aria-controls={"panel-"+id} variant="ghost" className={tab===id?"border-b-2 border-primary text-primary":""} onClick={()=>setTab(id)}>{label}</Button>)}
      <span className="ml-auto hidden text-[10px] text-dim lg:inline">Гипотезы по наблюдаемой сети · решение за аналитиком</span>
    </div>
    <AnimatePresence mode="wait">
      <motion.div key={tab} role="tabpanel" id={"panel-"+tab} aria-labelledby={"tab-"+tab} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reduced?0:duration.base,ease}}>
        {tab==="explore"?<div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_310px] xl:grid-cols-[250px_minmax(0,1fr)_310px]">
          <aside className="order-3 flex min-w-0 flex-col border border-border bg-panel lg:col-span-2 xl:order-none xl:col-span-1 xl:h-[calc(100dvh-220px)] xl:min-h-[490px]">
            <div className="space-y-3 border-b border-border p-3">
              <div className="flex items-center justify-between"><h2 className="hud-caps text-xs">Очередь проверки</h2><span className="hud-num text-xs text-sky">{candidates.length}</span></div>
              <div className="flex gap-1"><Button size="sm" variant={scope==="top"?"secondary":"ghost"} onClick={()=>{setScope("top");setLimit(100)}}>Топ {data.topNodes.length}</Button><Button size="sm" variant={scope==="all"?"secondary":"ghost"} onClick={()=>{setScope("all");setLimit(100)}}>Вся сеть</Button></div>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Фильтр по роли" value={role} onChange={e=>{setRole(e.target.value as MoneyRole|"all");setLimit(100)}} className="min-w-0 border border-border bg-background p-2 text-xs"><option value="all">Все роли</option>{MONEY_ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
                <select aria-label="Фильтр по кластеру" value={cluster??"all"} onChange={e=>{if(e.target.value==="all")setCluster(null);else openCluster(Number(e.target.value));setLimit(100)}} className="min-w-0 border border-border bg-background p-2 text-xs"><option value="all">Все кластеры</option>{data.clusters.map(c=><option key={c.cluster_id} value={c.cluster_id}>Кластер {c.cluster_id}</option>)}</select>
              </div>
              <Button size="sm" variant="outline" className="w-full text-[10px]" disabled={!candidates.length} onClick={()=>{const ids=candidates.slice(0,10).map(n=>n.gid);setReview(current=>[...new Set([...current,...ids])]);toast.success("Первые "+ids.length+" кандидатов включены в список")}}><Plus/>Выбрать первые {Math.min(10,candidates.length)}</Button>
            </div>
            <div className="max-h-80 flex-1 overflow-auto xl:max-h-none">
              {!candidates.length&&<p className="p-4 text-xs text-muted-foreground">По выбранным фильтрам кандидатов нет. Попробуйте «Вся сеть» или другой фильтр.</p>}
              {candidates.slice(0,limit).map(node=><div key={node.gid} className={"group flex items-start gap-1 border-b border-border p-3 transition-colors "+(node.gid===gid?"border-l-2 border-l-primary bg-primary/5":"hover:bg-muted/40")}>
                <button className="min-w-0 flex-1 text-left" aria-label={"Открыть кандидата "+node.gid} aria-pressed={node.gid===gid} onClick={()=>openNode(node.gid)}>
                  <p className="hud-num text-[11px]">{node.gid}</p><div className="mt-2 flex items-center justify-between gap-1"><span className="truncate text-[10px] text-muted-foreground">{ROLE_LABELS[node.role]}{node.is_seed?" · seed":""}</span><span className="hud-num text-[11px] text-sky">{score(node.priority_score)}</span></div>
                </button>
                <Button size="icon-sm" variant="ghost" aria-pressed={review.includes(node.gid)} aria-label={(review.includes(node.gid)?"Убрать ":"Добавить ")+node.gid+(review.includes(node.gid)?" из списка проверки":" в список проверки")} onClick={()=>toggle(node.gid)}>{review.includes(node.gid)?<Check className="text-sky"/>:<Plus/>}</Button>
              </div>)}
              {candidates.length>limit&&<Button variant="ghost" className="w-full" onClick={()=>setLimit(limit+100)}>Показать ещё {Math.min(100,candidates.length-limit)}</Button>}
            </div>
          </aside>
          <div className="min-w-0 border border-border bg-panel xl:h-[calc(100dvh-220px)] xl:min-h-[490px]">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs"><span className="hud-caps text-sky">{cluster===null?"Вся сеть":"Кластер "+cluster} / <span className="hud-num text-foreground">…{gid.slice(-8)}</span></span>{cluster!==null&&<Button variant="ghost" size="icon-sm" aria-label="Сбросить кластер" onClick={()=>setCluster(null)}><X/></Button>}<RoleBadge role={selected.role}/></div>
            <div className="h-[calc(100%-45px)]"><FlowExplorer key={gid+mode} data={data} gid={gid} mode={mode} onMode={setMode} onNode={openNode} onCluster={openCluster} cluster={cluster}
              onBack={history.length?()=>{setGid(history.at(-1)!);setHistory(previous=>previous.slice(0,-1))}:undefined}/></div>
          </div>
          <NodeInspector key={gid} node={selected} data={data} included={review.includes(gid)} onToggle={toggle} onPath={()=>setMode("path")}/>
        </div>:tab==="signals"?<AnalysisInsights data={data} onNode={openNode}/>:<ReviewList graph={data} run={run} nodes={review.map(id=>nodesById.get(id)!).filter(Boolean)} onRemove={toggle} onNode={openNode}/>}
      </motion.div>
    </AnimatePresence>
  </section>
}
