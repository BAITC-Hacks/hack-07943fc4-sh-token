import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MONEY_ROLES } from "@/lib/graph-data"
import { getClusterFlows } from "@/lib/cluster-flows"
import type { MoneyGraphData, MoneyNode } from "@/lib/graph-types"
import { clusterLabel, money, RoleBadge, roleStroke } from "./graph-presentation"

const CLUSTERS_PER_PAGE = 12
const FLOW_LIMIT = 24

export function NetworkOverview({ data, membersByCluster, onCluster }: {
  data: MoneyGraphData; membersByCluster: Map<number, MoneyNode[]>; onCluster: (id: number) => void
}) {
  const [page, setPage] = React.useState(0)
  const marker = React.useId().replaceAll(":", "")
  const ordered = [...data.clusters].sort((a, b) => b.n_nodes - a.n_nodes || a.cluster_id - b.cluster_id)
  const visible = ordered.slice(page * CLUSTERS_PER_PAGE, (page + 1) * CLUSTERS_PER_PAGE)
  const ids = new Set(visible.map((cluster) => cluster.cluster_id))
  const flows = React.useMemo(() => getClusterFlows(data), [data])
  const betweenVisible = flows.filter((flow) => ids.has(flow.src) && ids.has(flow.dst))
  const shownFlows = betweenVisible.slice(0, FLOW_LIMIT)
  const positions = new Map(visible.map((cluster, index) => {
    const angle = index * Math.PI * 2 / visible.length - Math.PI / 2
    return [cluster.cluster_id, { x: 400 + Math.cos(angle) * 290, y: 215 + Math.sin(angle) * 160 }]
  }))
  return <Card id="network-overview" className="scroll-mt-4">
    <CardHeader><CardDescription className="hud-caps text-sky">02 / Обзор направленных потоков</CardDescription><CardTitle>Сеть на уровне кластеров</CardTitle>
      <p className="text-xs leading-5 text-muted-foreground">Круг — кластер, цветные дуги — состав ролей, внешнее кольцо — наличие seed. Стрелки показывают агрегированные переводы между кластерами. Нажмите круг: кластер → участник → конкретный GID.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="hud-num text-xs text-sky">Кластеры {visible.length ? page * CLUSTERS_PER_PAGE + 1 : 0}–{Math.min((page + 1) * CLUSTERS_PER_PAGE, ordered.length)} из {ordered.length}; стрелки {shownFlows.length} из {betweenVisible.length} между ними.</p>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Предыдущие кластеры</Button><Button size="sm" variant="outline" disabled={(page + 1) * CLUSTERS_PER_PAGE >= ordered.length} onClick={() => setPage(page + 1)}>Следующие кластеры</Button></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <div className="hud-blueprint min-w-0">
          <svg viewBox="0 0 800 440" className="w-full" role="group" aria-label="Направленные потоки между кластерами">
            <defs><marker id={marker} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" className="fill-sky" /></marker></defs>
            {shownFlows.map((flow) => {
              const from = positions.get(flow.src)!, to = positions.get(flow.dst)!
              const length = Math.hypot(to.x - from.x, to.y - from.y)
              const dx = (to.x - from.x) / length, dy = (to.y - from.y) / length
              return <line key={`${flow.src}:${flow.dst}`} className="stroke-sky/45" strokeWidth="1.5" markerEnd={`url(#${marker})`}
                x1={from.x + dx * 32 - dy * 4} y1={from.y + dy * 32 + dx * 4} x2={to.x - dx * 36 - dy * 4} y2={to.y - dy * 36 + dx * 4}>
                <title>{clusterLabel(flow.src)} → {clusterLabel(flow.dst)}: {money.format(flow.sum_kzt)} ₸ / {flow.n_tx} транзакций</title>
              </line>
            })}
            {visible.map((cluster) => {
              const { x, y } = positions.get(cluster.cluster_id)!
              const members = membersByCluster.get(cluster.cluster_id) ?? []
              let offset = 0
              return <g key={cluster.cluster_id} role="button" tabIndex={0} aria-label={`Исследовать кластер ${cluster.cluster_id}`} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => onCluster(cluster.cluster_id)} onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); onCluster(cluster.cluster_id) } }}>
                <title>{clusterLabel(cluster.cluster_id)}: {cluster.n_nodes} узлов, {cluster.n_seed} seed</title>
                <circle cx={x} cy={y} r="25" className="fill-panel stroke-border" />
                {MONEY_ROLES.map((role) => {
                  const percent = members.filter((node) => node.role === role).length / Math.max(1, members.length) * 100
                  const start = offset; offset += percent
                  return <circle key={role} cx={x} cy={y} r="25" pathLength="100" className={`fill-none ${roleStroke(role)}`} strokeWidth="4" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-start} transform={`rotate(-90 ${x} ${y})`} />
                })}
                {cluster.n_seed > 0 && <circle cx={x} cy={y} r="32" className="fill-none stroke-warning" />}
                <text x={x} y={y + 4} textAnchor="middle" className="fill-foreground font-mono text-xs">{cluster.cluster_id}</text>
                <text x={x} y={y + 48} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">{cluster.n_nodes} узлов</text>
              </g>
            })}
          </svg>
        </div>
        <div className="space-y-3 border border-border p-4">
          <h3 className="hud-caps text-xs text-sky">Крупнейшие межкластерные потоки</h3>
          <p className="text-xs text-dim">Показано {Math.min(6, flows.length)} из {flows.length} направлений во всей сети. Внутренние переводы — в карточках кластеров.</p>
          {flows.slice(0, 6).map((flow) => <div key={`${flow.src}:${flow.dst}`} className="border-b border-border pb-2">
            <div className="flex items-center gap-2 text-xs"><button className="underline underline-offset-4 hover:text-primary" onClick={() => onCluster(flow.src)}>{clusterLabel(flow.src)}</button><span className="text-sky">→</span><button className="underline underline-offset-4 hover:text-primary" onClick={() => onCluster(flow.dst)}>{clusterLabel(flow.dst)}</button></div>
            <p className="hud-num mt-1 text-xs text-foreground">{money.format(flow.sum_kzt)} ₸ <span className="text-dim">/ {flow.n_tx} переводов</span></p>
          </div>)}
          {!flows.length && <p className="text-xs text-muted-foreground">Между кластерами нет наблюдаемых переводов.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Легенда шести ролей">{MONEY_ROLES.map((role) => <RoleBadge key={role} role={role} />)}<span className="hud-tag text-warning">◎ seed</span></div>
      <p className="text-xs text-dim">Порядок кластеров — по размеру. На карте ограничена выборка стрелок по сумме; все кластеры доступны постранично и в списке ниже. Отсутствие стрелки на этой странице не означает отсутствие связи в данных.</p>
    </CardContent>
  </Card>
}
