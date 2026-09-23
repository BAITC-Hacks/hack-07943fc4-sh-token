import * as React from "react"
import { ArrowLeft, ArrowRight, Layers, Pause, Play, Route, Users } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import type { MoneyGraphData, MoneyNode } from "@/lib/graph-types"
import { seedPath } from "@/lib/graph-investigation"
import { getClusterFlows } from "@/lib/cluster-flows"
import { duration } from "@/lib/motion"
import { money, ROLE_LABELS, roleBar, RoleBadge } from "./graph-presentation"

export type GraphMode = "flows" | "path" | "clusters"
type LaneItem = { id: string; label: string; detail: string; amount: number; count: number; node?: MoneyNode }
const PAGE_SIZE = 4

export function FlowExplorer({ data, gid, mode, onMode, onNode, onCluster, onBack, cluster }: {
  data: MoneyGraphData; gid: string; mode: GraphMode; onMode: (mode: GraphMode) => void
  onNode: (gid: string) => void; onCluster: (id: number) => void; onBack?: () => void; cluster: number | null
}) {
  const [animate, setAnimate] = React.useState(true)
  const nodes = React.useMemo(() => new Map(data.nodes.map(n => [n.gid, n])), [data])
  const selected = nodes.get(gid)!
  const incoming = data.edges.filter(e => e.dst === gid && e.src !== gid).map(e => ({ id: e.src, label: e.src, detail: ROLE_LABELS[nodes.get(e.src)!.role], amount: e.sum_kzt, count: e.n_tx, node: nodes.get(e.src) }))
  const outgoing = data.edges.filter(e => e.src === gid && e.dst !== gid).map(e => ({ id: e.dst, label: e.dst, detail: ROLE_LABELS[nodes.get(e.dst)!.role], amount: e.sum_kzt, count: e.n_tx, node: nodes.get(e.dst) }))
  const self = data.edges.find(e => e.src === gid && e.dst === gid)
  return <div className="flow-explorer flex min-w-0 flex-col bg-background/80">
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      {onBack && <Button size="icon-sm" variant="ghost" aria-label="Предыдущий узел" onClick={onBack}><ArrowLeft /></Button>}
      {([["flows", "Денежные потоки"], ["path", "Путь от источника"], ["clusters", "Между кластерами"]] as const).map(([id, label]) =>
        <Button key={id} size="sm" variant={mode === id ? "secondary" : "ghost"} aria-pressed={mode === id} onClick={() => onMode(id)}>{id === "path" ? <Route /> : id === "clusters" ? <Layers /> : <ArrowRight />}{label}</Button>)}
      <Button className="ml-auto" size="icon-sm" variant="ghost" aria-label={animate ? "Остановить анимацию потоков" : "Включить анимацию потоков"} onClick={() => setAnimate(!animate)}>{animate ? <Pause /> : <Play />}</Button>
    </div>
    {mode === "clusters" ? <ClusterMap data={data} initial={cluster ?? selected.cluster_id} onCluster={onCluster} animate={animate} /> : mode === "path" ?
      <PathMap data={data} gid={gid} onNode={onNode} /> : <>
        <FlowBoard key={gid} incoming={incoming} outgoing={outgoing} onSelect={onNode} animate={animate}
          leftTitle="От кого получает" rightTitle="Кому переводит" center={<div className="flow-focus w-full space-y-4 border border-line-strong bg-panel p-5">
            <p className="hud-caps text-[11px] text-sky">Выбранный клиент</p>
            <div><p className="hud-num whitespace-nowrap text-xs tracking-tight">{gid}</p><div className="mt-3 flex flex-wrap gap-2"><RoleBadge role={selected.role} />{selected.is_seed && <span className="hud-tag text-warning">Исходный</span>}</div></div>
            <dl className="space-y-3 border-y border-border py-4"><div><dt className="text-xs text-muted-foreground">Получил за период</dt><dd className="hud-num mt-1 text-lg text-sky">{money.format(selected.in_kzt)} ₸</dd></div><div><dt className="text-xs text-muted-foreground">Перевёл за период</dt><dd className="hud-num mt-1 text-lg">{money.format(selected.out_kzt)} ₸</dd></div></dl>
            <p className="text-xs leading-5 text-muted-foreground">{selected.truncated_by_depth ? "Граница выгрузки: продолжение потока неизвестно." : selected.is_seed ? "У исходного клиента входящие наблюдаются не полностью." : selected.in_kzt ? "Выход / вход: " + (selected.out_kzt / selected.in_kzt * 100).toFixed(1) + "%. Это не остаток на счёте." : "Входящие переводы в выборке не наблюдаются."}</p>
          </div>} />
        {self && <p className="px-5 pb-3 text-xs text-warning">Самопереводы: {money.format(self.sum_kzt)} ₸ · {self.n_tx} операций. В боковых потоках не показаны.</p>}
      </>}
  </div>
}

function FlowBoard({ incoming, outgoing, center, onSelect, animate, leftTitle, rightTitle }: {
  incoming: LaneItem[]; outgoing: LaneItem[]; center: React.ReactNode; onSelect: (id: string) => void; animate: boolean; leftTitle: string; rightTitle: string
}) {
  const [leftPage, setLeftPage] = React.useState(0), [rightPage, setRightPage] = React.useState(0)
  const [active, setActive] = React.useState<string | null>(null)
  const sorted = (items: LaneItem[]) => [...items].sort((a,b) => b.amount-a.amount || a.id.localeCompare(b.id))
  const left = sorted(incoming), right = sorted(outgoing)
  const shownLeft = left.slice(leftPage*PAGE_SIZE, (leftPage+1)*PAGE_SIZE), shownRight = right.slice(rightPage*PAGE_SIZE, (rightPage+1)*PAGE_SIZE)
  const sum = (items: LaneItem[]) => items.reduce((s, item) => s + item.amount, 0)
  const maxAmount = Math.max(1, ...[...left, ...right].map(item => item.amount))
  const height = Math.max(shownLeft.length, shownRight.length, 4) * 104 - 12
  function heading(title: string, items: LaneItem[], page: number, setPage: (page: number) => void) {
    return <div className="h-[72px] space-y-2"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{title}</h3><span className="hud-num text-xs text-sky">{items.length}</span></div>
      <p className="hud-num text-xs text-muted-foreground">{money.format(sum(items))} ₸</p>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{items.length ? `${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,items.length)} из ${items.length}` : "Нет наблюдаемых связей"}</span>
        {items.length > PAGE_SIZE && <div className="flex gap-1"><Button size="icon-xs" variant="ghost" aria-label={"Предыдущие: " + title} disabled={!page} onClick={() => setPage(page-1)}><ArrowLeft /></Button><Button size="icon-xs" variant="ghost" aria-label={"Следующие: " + title} disabled={(page+1)*PAGE_SIZE>=items.length} onClick={() => setPage(page+1)}><ArrowRight /></Button></div>}
      </div></div>
  }
  function cards(items: LaneItem[], all: LaneItem[], side: string) {
    return <div className="space-y-3" style={{height}}>{!items.length && <div className="flex h-full items-center justify-center border border-dashed border-border p-4 text-center text-xs leading-6 text-muted-foreground">В этой выборке переводов нет.<br/>Это не подтверждает отсутствие операций вне неё.</div>}{items.map(item => <button key={item.id}
      className={"flow-counterparty relative flex h-[92px] w-full flex-col justify-between border bg-panel px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary " + (active === side+item.id ? "border-primary" : "border-border hover:border-line-strong")}
      aria-label={"Открыть " + (item.node ? "узел " : "кластер ") + item.id} title={item.label}
      onMouseEnter={() => setActive(side+item.id)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(side+item.id)} onBlur={() => setActive(null)} onClick={() => onSelect(item.id)}>
      <span className={"absolute inset-y-0 left-0 w-0.5 " + (item.node ? roleBar[item.node.role] : "bg-sky")} />
      <span className="flex items-center justify-between gap-2"><span className="hud-num text-[11px]">{item.label}</span><ArrowRight className="size-3 shrink-0 text-muted-foreground" /></span>
      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">{item.detail}{item.node?.is_seed && <span className="text-warning">· seed</span>}</span>
      <span className="flex items-end justify-between gap-2"><span className="hud-num text-sm text-sky">{money.format(item.amount)} ₸</span><span className="hud-num text-[11px] text-muted-foreground">{sum(all) ? (item.amount/sum(all)*100).toFixed(1) : "0"}%</span></span>
      <span className="text-[11px] text-muted-foreground">Переводов за период: {item.count}</span>
    </button>)}</div>
  }
  return <>
    <div className="overflow-x-auto p-5"><div className="flow-board grid min-w-[780px] grid-cols-[minmax(0,1fr)_64px_minmax(190px,0.85fr)_64px_minmax(0,1fr)]">
      <div>{heading(leftTitle,left,leftPage,setLeftPage)}{cards(shownLeft,left,"in")}</div>
      <div className="pt-[72px]"><FlowWires items={shownLeft} height={height} inbound maxAmount={maxAmount} active={active} animate={animate} /></div>
      <div className="flex flex-col"><p className="flex h-[72px] shrink-0 items-start justify-center pt-1 text-[11px] text-muted-foreground">НАПРАВЛЕНИЕ ДЕНЕГ →</p><div className="flex flex-1 items-center">{center}</div></div>
      <div className="pt-[72px]"><FlowWires items={shownRight} height={height} inbound={false} maxAmount={maxAmount} active={active} animate={animate} /></div>
      <div>{heading(rightTitle,right,rightPage,setRightPage)}{cards(shownRight,right,"out")}</div>
    </div></div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-5 py-3 text-[11px] leading-5 text-muted-foreground"><span>Толщина линии — сумма</span><span>% — доля этой стороны потока</span><span>Цвет карточки — роль</span><span>Клик — перейти к клиенту / кластеру</span><span>Движение — направление, не онлайн-операции</span></div>
  </>
}

function FlowWires({items,height,inbound,maxAmount,active,animate}:{items:LaneItem[];height:number;inbound:boolean;maxAmount:number;active:string|null;animate:boolean}) {
  const reduced = useReducedMotion(), marker = React.useId().replaceAll(":", "")
  return <svg width="64" height={height} viewBox={`0 0 64 ${height}`} aria-hidden="true" className="overflow-visible"><defs><marker id={marker} markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" className="fill-sky" /></marker></defs>
    {items.map((item,i) => {
      const row = i*104+46, middle = height/2+(i-(items.length-1)/2)*18
      const from = inbound ? row : middle, to = inbound ? middle : row
      const path = `M0 ${from} C32 ${from} 32 ${to} 61 ${to}`
      const highlight = !active || active === (inbound ? "in" : "out")+item.id
      return <g key={item.id} opacity={highlight ? 1 : 0.15}><path d={path} fill="none" className="stroke-sky/60" strokeWidth={1.5+4*Math.sqrt(item.amount/maxAmount)} markerEnd={`url(#${marker})`} />{animate && !reduced && <circle r="2" className="fill-foreground"><animateMotion path={path} dur={duration.boot*6+"s"} repeatCount="indefinite" /></circle>}</g>
    })}
  </svg>
}

function PathMap({data,gid,onNode}:{data:MoneyGraphData;gid:string;onNode:(gid:string)=>void}) {
  const path = seedPath(data,gid)
  return <div className="p-6"><div className="mb-8 space-y-2"><h3 className="text-lg">Как клиент связан с исходными участниками</h3><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Один кратчайший путь по направлению переводов. Суммы — весь оборот каждого ребра за период, а не доказанная сквозная сумма.</p></div>
    {!path.length ? <p className="border border-dashed border-border p-8 text-muted-foreground">Направленный путь в наблюдаемой сети не найден.</p> : <div className="flex items-center overflow-x-auto pb-6">{path.map((id,i) => {
      const node=data.nodes.find(n=>n.gid===id)!, edge=i?data.edges.find(e=>e.src===path[i-1]&&e.dst===id):null
      return <React.Fragment key={id}>{edge&&<div className="w-36 shrink-0 px-3 text-center"><p className="hud-num text-xs text-sky">{money.format(edge.sum_kzt)} ₸</p><ArrowRight className="my-3 h-5 w-full text-sky"/><p className="text-xs text-muted-foreground">{edge.n_tx} переводов</p></div>}<button className={"w-56 shrink-0 space-y-4 border bg-panel p-5 text-left hover:border-primary " + (id===gid?"border-primary":"border-border")} onClick={()=>onNode(id)}><span className="hud-caps text-[11px] text-sky">{i===0?"Исходный клиент":i===path.length-1?"Выбранный клиент":"Шаг "+i}</span><span className="hud-num block text-xs">{id}</span><RoleBadge role={node.role}/><span className="block text-xs text-muted-foreground">Колено {node.depth} · кластер {node.cluster_id}</span></button></React.Fragment>
    })}</div>}
    {path.length===1&&<p className="text-sm text-warning">Выбранный клиент сам является исходным. Перейдите к его получателю, чтобы увидеть продолжение.</p>}
  </div>
}

function ClusterMap({data,initial,onCluster,animate}:{data:MoneyGraphData;initial:number;onCluster:(id:number)=>void;animate:boolean}) {
  const [focus,setFocus]=React.useState(initial)
  const flows=React.useMemo(()=>getClusterFlows(data),[data])
  const cluster=data.clusters.find(c=>c.cluster_id===focus)!
  const item=(id:number,amount:number,count:number):LaneItem=>({id:String(id),label:"Кластер "+id,detail:(data.clusters.find(c=>c.cluster_id===id)?.n_nodes??0)+" клиентов",amount,count})
  const incoming=flows.filter(f=>f.dst===focus).map(f=>item(f.src,f.sum_kzt,f.n_tx))
  const outgoing=flows.filter(f=>f.src===focus).map(f=>item(f.dst,f.sum_kzt,f.n_tx))
  return <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3"><p className="text-xs text-muted-foreground">Выберите кластер и проследите его обмен с другими</p><select aria-label="Кластер на карте потоков" value={focus} onChange={e=>setFocus(Number(e.target.value))} className="border border-border bg-background p-2 text-xs">{data.clusters.map(c=><option key={c.cluster_id} value={c.cluster_id}>Кластер {c.cluster_id} · {c.n_nodes} клиентов</option>)}</select></div>
    <FlowBoard key={focus} incoming={incoming} outgoing={outgoing} onSelect={id=>setFocus(Number(id))} animate={animate} leftTitle="Деньги из кластеров" rightTitle="Деньги в кластеры" center={<div className="w-full space-y-4 border border-sky/40 bg-panel p-5"><Layers className="size-6 text-sky"/><h3 className="text-xl">Кластер {focus}</h3><p className="text-sm">{cluster.n_nodes} клиентов · {cluster.n_seed} исходных</p><div className="border-y border-border py-3"><p className="text-xs text-muted-foreground">Внутренние переводы</p><p className="hud-num mt-2 text-lg text-sky">{money.format(cluster.sum_kzt_internal)} ₸</p></div><p className="text-xs leading-5 text-muted-foreground">{cluster.hypothesis}</p><Button size="sm" variant="outline" className="w-full" onClick={()=>onCluster(focus)}><Users/>Открыть клиентов</Button></div>}/>
  </>
}
