import * as React from "react"
import { ArrowLeft, Layers, Pause, Play, Route } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import type { MoneyGraphData, MoneyEdge } from "@/lib/graph-types"
import { seedPath } from "@/lib/graph-investigation"
import { getClusterFlows } from "@/lib/cluster-flows"
import { duration } from "@/lib/motion"
import { money, ROLE_LABELS, roleStroke } from "./graph-presentation"

export type GraphMode = "flows" | "path" | "clusters"
type Point = { x: number; y: number }

export function FlowExplorer({ data, gid, mode, onMode, onNode, onCluster, onBack, cluster }: {
  data: MoneyGraphData; gid: string; mode: GraphMode; onMode: (mode: GraphMode) => void
  onNode: (gid: string) => void; onCluster: (id: number) => void; onBack?: () => void; cluster: number | null
}) {
  const reduced = useReducedMotion()
  const [animate, setAnimate] = React.useState(true)
  const [edge, setEdge] = React.useState<MoneyEdge | null>(null)
  const marker = React.useId().replaceAll(":", "")
  const nodes = React.useMemo(() => new Map(data.nodes.map(node => [node.gid, node])), [data])
  const path = React.useMemo(() => seedPath(data, gid), [data, gid])
  const selected = nodes.get(gid)
  const incoming = data.edges.filter(e => e.dst === gid && e.src !== gid).sort((a,b) => b.sum_kzt-a.sum_kzt)
  const outgoing = data.edges.filter(e => e.src === gid && e.dst !== gid).sort((a,b) => b.sum_kzt-a.sum_kzt)
  const positions = new Map<string, Point>()
  let shown: MoneyEdge[] = []
  if (mode === "path") {
    path.forEach((id,i) => positions.set(id, { x: path.length === 1 ? 350 : 70 + i * 560 / (path.length - 1), y: 235 }))
    shown = path.slice(1).flatMap((id,i) => data.edges.filter(e => e.src === path[i] && e.dst === id))
  } else {
    positions.set(gid, { x: 350, y: 235 })
    const left = [...new Set(incoming.slice(0,5).map(e => e.src))]
    const right = [...new Set(outgoing.slice(0,5).map(e => e.dst))]
    left.forEach((id,i) => positions.set(id, { x: 95, y: 235 + (i - (left.length-1)/2) * 90 }))
    right.forEach((id,i) => { if (!positions.has(id)) positions.set(id, { x: 605, y: 235 + (i - (right.length-1)/2) * 90 }) })
    shown = [...incoming, ...outgoing].filter(e => positions.has(e.src) && positions.has(e.dst))
  }
  const all = incoming.length + outgoing.length + data.edges.filter(e => e.src === gid && e.dst === gid).length
  const maxAmount = Math.max(1, ...shown.map(e => e.sum_kzt))
  return <div className="flex h-full min-h-[440px] flex-col">
    <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
      {onBack && <Button size="icon-sm" variant="ghost" aria-label="Предыдущий узел" onClick={onBack}><ArrowLeft /></Button>}
      {([["flows","Потоки узла"],["path","Путь от seed"],["clusters","Сеть кластеров"]] as const).map(([id,label]) =>
        <Button key={id} size="sm" variant={mode === id ? "secondary" : "ghost"} aria-pressed={mode === id} onClick={() => onMode(id)}>{id === "path" ? <Route /> : id === "clusters" ? <Layers /> : null}{label}</Button>)}
      <Button className="ml-auto" size="icon-sm" variant="ghost" aria-label={animate ? "Остановить анимацию потоков" : "Включить анимацию потоков"} onClick={() => setAnimate(!animate)}>{animate ? <Pause /> : <Play />}</Button>
    </div>
    {mode === "clusters" ? <ClusterMap data={data} selected={cluster} onCluster={onCluster} /> : <>
      <div className="flex justify-between gap-2 px-4 pt-3 text-[11px] text-muted-foreground">
        <span>{mode === "flows" ? "ВХОДЯЩИЕ → ВЫБРАННЫЙ УЗЕЛ → ИСХОДЯЩИЕ" : "КРАТЧАЙШИЙ НАБЛЮДАЕМЫЙ ПУТЬ"}</span>
        <span className="hud-num">{mode === "flows" ? shown.length + " / " + all + " связей" : path.length ? path.length-1 + " переходов" : "Путь не найден"}</span>
      </div>
      <div className="hud-blueprint relative flex min-h-[260px] flex-1 items-center">
        {mode === "path" && !path.length ? <p className="m-auto max-w-sm p-6 text-sm text-muted-foreground">Направленного пути от исходных клиентов в этой выборке нет. Проверьте полноту данных.</p> :
          <svg viewBox="0 0 700 500" className="absolute inset-0 h-full w-full" role="group" aria-label={mode === "path" ? "Маршрут от исходного клиента" : "Входящие и исходящие денежные потоки"}>
            <defs><marker id={marker} markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L0,10 L10,5 z" className="fill-sky" /></marker></defs>
            {shown.map(e => {
              const from = positions.get(e.src)!, to = positions.get(e.dst)!
              const dx = to.x-from.x, dy = to.y-from.y, length = Math.hypot(dx,dy) || 1
              const offset = shown.some(other => other.src === e.dst && other.dst === e.src) ? 14 : 0
              const x1 = from.x+dx/length*25, y1=from.y+dy/length*25
              const x2=to.x-dx/length*30, y2=to.y-dy/length*30
              const d = "M"+x1+","+y1+" Q"+((x1+x2)/2-dy/length*offset)+","+((y1+y2)/2+dx/length*offset)+" "+x2+","+y2
              const selectedEdge = edge?.src === e.src && edge.dst === e.dst
              return <g key={e.src+":"+e.dst}>
                <path d={d} className={selectedEdge ? "fill-none stroke-primary" : "fill-none stroke-sky/50"} strokeWidth={1+3*Math.sqrt(e.sum_kzt/maxAmount)} markerEnd={"url(#"+marker+")"} />
                {animate && !reduced && <circle r="2.5" className="fill-sky" pointerEvents="none"><animateMotion dur={duration.boot*6+"s"} repeatCount="indefinite" path={d} /></circle>}
                <path d={d} stroke="transparent" strokeWidth="16" fill="none" className="cursor-pointer" tabIndex={0} role="button"
                  aria-label={e.src+" → "+e.dst+": "+money.format(e.sum_kzt)+" тенге"} onClick={() => setEdge(e)}
                  onKeyDown={event => { if (event.key === "Enter") setEdge(e) }}><title>{money.format(e.sum_kzt)} ₸ · {e.n_tx} переводов</title></path>
              </g>
            })}
            {[...positions].map(([id,p]) => {
              const node = nodes.get(id)!
              return <g key={id} role="button" tabIndex={0} aria-label={"Открыть узел "+id} className="cursor-pointer outline-none"
                onClick={() => { setEdge(null); onNode(id) }} onKeyDown={event => { if (["Enter"," "].includes(event.key)) { event.preventDefault(); setEdge(null); onNode(id) } }}>
                <title>{id+" · "+ROLE_LABELS[node.role]}</title>
                <rect x={p.x-44} y={p.y-28} width="88" height="90" fill="transparent" pointerEvents="all" />
                {node.is_seed && <circle cx={p.x} cy={p.y} r={id === gid ? 31 : 23} className="fill-none stroke-warning" />}
                <circle cx={p.x} cy={p.y} r={id === gid ? 25 : 17} className={"fill-panel "+roleStroke(node.role)} strokeWidth={id === gid ? 3 : 2} />
                {id === gid && <circle cx={p.x} cy={p.y} r="5" className="fill-primary" />}
                <text x={p.x} y={p.y+43} textAnchor="middle" className="fill-foreground font-mono text-[11px]">…{id.slice(-7)}</text>
                <text x={p.x} y={p.y+59} textAnchor="middle" className="fill-muted-foreground text-[10px]">{ROLE_LABELS[node.role]}</text>
              </g>
            })}
          </svg>}
      </div>
      <div className="min-h-16 border-t border-border px-4 py-3 text-xs">
        <p className="mb-1 text-[10px] text-dim">Цвет — роль · кольцо — seed · движение — направление, не онлайн-операции</p>
        {edge && shown.some(e => e.src === edge.src && e.dst === edge.dst) ? <><p className="hud-num break-all text-sky">{edge.src} → {edge.dst}</p><p className="mt-1">{money.format(edge.sum_kzt)} ₸ · {edge.n_tx} переводов за период</p></> :
          <p className="leading-5 text-muted-foreground">{mode === "path" ? (selected?.is_seed ? "Это исходный клиент. Выберите связанный узел, чтобы проследить путь." : "Путь подтверждает связи в выборке. Он не доказывает движение одних и тех же средств.") : "Нажмите узел для перехода, стрелку — для суммы. До 5 крупнейших входящих и исходящих контрагентов; встречные потоки показаны отдельно."}</p>}
      </div>
    </>}
  </div>
}

function ClusterMap({data,selected,onCluster}:{data:MoneyGraphData;selected:number|null;onCluster:(id:number)=>void}) {
  const marker = React.useId().replaceAll(":","")
  const [page,setPage] = React.useState(0)
  const ordered = [...data.clusters].sort((a,b)=>b.n_nodes-a.n_nodes)
  const visible = ordered.slice(page*12,page*12+12)
  const positions = new Map(visible.map((c,i)=>[c.cluster_id,{x:350+Math.cos(i*Math.PI*2/visible.length-Math.PI/2)*255,y:195+Math.sin(i*Math.PI*2/visible.length-Math.PI/2)*135}]))
  const allFlows = getClusterFlows(data)
  const pageFlows = allFlows.filter(f=>positions.has(f.src)&&positions.has(f.dst)).sort((a,b)=>b.sum_kzt-a.sum_kzt)
  const flows = pageFlows.slice(0,24)
  return <div className="flex flex-1 flex-col">
    <div className="flex items-center justify-between px-3 pt-3 text-xs"><span className="text-muted-foreground">{visible.length} / {ordered.length} кластеров · {flows.length} / {pageFlows.length} направлений</span><div className="flex gap-1"><Button size="sm" variant="ghost" aria-label="Предыдущие кластеры" disabled={!page} onClick={()=>setPage(page-1)}>←</Button><Button size="sm" variant="ghost" aria-label="Следующие кластеры" disabled={(page+1)*12>=ordered.length} onClick={()=>setPage(page+1)}>→</Button></div></div>
    <svg viewBox="0 0 700 400" className="hud-blueprint my-auto w-full" role="group" aria-label="Карта межкластерных потоков">
      <defs><marker id={marker} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" className="fill-sky"/></marker></defs>
      {flows.map(f=>{const a=positions.get(f.src)!,b=positions.get(f.dst)!,d=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=(b.x-a.x)/d,dy=(b.y-a.y)/d;return <line key={f.src+":"+f.dst} x1={a.x+dx*24-dy*4} y1={a.y+dy*24+dx*4} x2={b.x-dx*30-dy*4} y2={b.y-dy*30+dx*4} className="stroke-sky/40" strokeWidth="1.5" markerEnd={"url(#"+marker+")"}><title>{f.src+" → "+f.dst+": "+money.format(f.sum_kzt)+" ₸"}</title></line>})}
      {visible.map(c=>{const p=positions.get(c.cluster_id)!;return <g key={c.cluster_id} role="button" tabIndex={0} aria-label={"Исследовать кластер "+c.cluster_id} className="cursor-pointer" onClick={()=>onCluster(c.cluster_id)} onKeyDown={e=>{if(e.key==="Enter")onCluster(c.cluster_id)}}>
        {c.n_seed>0&&<circle cx={p.x} cy={p.y} r="28" className="fill-none stroke-warning"/>}
        <circle cx={p.x} cy={p.y} r="22" className={c.cluster_id===selected?"fill-panel stroke-primary":"fill-panel stroke-sky"} strokeWidth="2"/>
        <text x={p.x} y={p.y+4} textAnchor="middle" className="fill-foreground font-mono text-xs">{c.cluster_id}</text><text x={p.x} y={p.y+44} textAnchor="middle" className="fill-muted-foreground text-[11px]">{c.n_nodes} узлов</text>
      </g>})}
    </svg>
    <p className="border-t border-border p-3 text-xs leading-5 text-muted-foreground">Нажмите кластер: откроется его очередь и ведущий узел. Показаны до 24 крупнейших направлений на странице; связи с другими страницами скрыты. Кольцо — есть seed.</p>
  </div>
}
