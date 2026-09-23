"use client"

import * as React from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Network,
  Route,
  Search,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { CountUp, DecodeText, stagger } from "@/components/hud/hud-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { analyzeMoneyGraph } from "@/lib/api"
import { filterTopNodes, indexMoneyGraph, isGid, MONEY_ROLES } from "@/lib/graph-data"
import type { AnalysisRun, AnalysisSource, MoneyGraphData, MoneyNode, MoneyRole } from "@/lib/graph-types"
import { toggleReviewGid } from "@/lib/review-list"
import { AnalysisInput } from "./analysis-input"
import { NetworkOverview } from "./network-overview"
import { ReviewButton, ReviewList } from "./review-list"
import { ClusterOverview } from "./cluster-overview"
import { clusterLabel, money, ROLE_LABELS, RoleBadge, roleBar, roleStroke, score } from "./graph-presentation"

type Phase = "idle" | "loading" | "done" | "error"

export function MoneyGraphDashboard() {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [data, setData] = React.useState<MoneyGraphData | null>(null)
  const [run, setRun] = React.useState<AnalysisRun | null>(null)
  const [reviewGids, setReviewGids] = React.useState<string[]>([])
  const [selectedGid, setSelectedGid] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [searchError, setSearchError] = React.useState("")
  const [loadError, setLoadError] = React.useState("")
  const [selectedCluster, setSelectedCluster] = React.useState<number | null>(null)
  const [roleFilter, setRoleFilter] = React.useState<MoneyRole | "all">("all")
  const [clusterFilter, setClusterFilter] = React.useState<number | "all">("all")

  React.useEffect(() => {
    if (phase === "done") window.scrollTo({ top: 0, behavior: "instant" })
  }, [phase])

  const { nodesById, membersByCluster } = React.useMemo(
    () => data ? indexMoneyGraph(data) : { nodesById: new Map<string, MoneyNode>(), membersByCluster: new Map<number, MoneyNode[]>() },
    [data]
  )
  const selected = nodesById.get(selectedGid) ?? null

  const calculate = React.useCallback(async (source: AnalysisSource, files: File[] = []) => {
    setPhase("loading")
    setSearchError("")
    setLoadError("")
    try {
      const response = await analyzeMoneyGraph(source, files)
      const result = response.graph
      setData(result)
      setRun(response.run)
      setReviewGids([])
      const firstGid = result.topNodes[0]?.gid ?? result.nodes[0]?.gid ?? ""
      setSelectedGid(firstGid)
      setSelectedCluster(result.nodes.find((node) => node.gid === firstGid)?.cluster_id ?? result.clusters[0]?.cluster_id ?? null)
      setRoleFilter("all")
      setClusterFilter("all")
      setQuery("")
      setPhase("done")
      if (result.nodes.length) toast.success("Python-пайплайн завершён. Результат готов к проверке.")
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Не удалось получить файл результатов.")
      setPhase("error")
    }
  }, [])

  const findNode = React.useCallback(
    (gid: string) => {
      const normalized = gid.trim()
      if (!isGid(normalized)) {
        setSearchError("Введите точный GID: 18 цифр без пробелов внутри")
        return false
      }
      if (!nodesById.has(normalized)) {
        setSearchError("GID не найден в наблюдаемой сети")
        return false
      }
      setSelectedGid(normalized)
      setSelectedCluster(nodesById.get(normalized)!.cluster_id)
      setQuery(normalized)
      setSearchError("")
      return true
    },
    [nodesById]
  )

  const openNode = (gid: string) => {
    if (!findNode(gid)) return
    document.getElementById("node-detail")?.focus({ preventScroll: true })
    document.getElementById("network-detail")?.scrollIntoView({ block: "start" })
  }

  const toggleReview = (gid: string) => {
    if (nodesById.has(gid)) setReviewGids((current) => toggleReviewGid(current, gid))
  }
  const openCluster = (id: number) => {
    setSelectedCluster(id)
    document.getElementById("clusters")?.scrollIntoView({ block: "start" })
  }

  if (phase !== "done" || !data || !run) {
    return <AnalysisInput busy={phase === "loading"} error={loadError} onRun={calculate}
      reviewCount={reviewGids.length} onBack={data && run ? () => setPhase("done") : undefined} />
  }

  if (!data.nodes.length) return <Card><CardHeader><CardTitle>В результате нет узлов</CardTitle><CardDescription>Проверьте комплект выгрузки и запустите расчёт заново.</CardDescription></CardHeader><CardContent><Button onClick={() => setPhase("idle")}>Выбрать данные</Button></CardContent></Card>

  return (
    <section className="space-y-4" data-agent="done">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="hud-tag" data-tone="sky"><span className="hud-dot" />Расчёт завершён</span>
            <span className="hud-num text-xs text-dim">{data.meta.periodStart} — {data.meta.periodEnd}</span>
          </div>
          <DecodeText
            as="h1"
            className="hud-caps text-2xl text-foreground md:text-[32px]"
            text="КАРТА ФИНАНСОВОЙ СЕТИ"
          />
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Приоритеты являются гипотезами для углублённой проверки, а не выводами о виновности.
          </p>
        </div>
        <SearchBox
          query={query}
          error={searchError}
          onQuery={setQuery}
          onSearch={() => openNode(query)}
        />
      </header>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <a href="#network-overview" className="hud-tag hover:text-primary">Потоки</a>
        <a href="#clusters" className="hud-tag hover:text-primary">Кластеры / {data.clusters.length}</a>
        <a href="#candidates" className="hud-tag hover:text-primary">Кандидаты / {data.topNodes.length}</a>
        <a href="#review-list" className="hud-tag text-primary">Мой список / {reviewGids.length}</a>
        <Button className="ml-auto" size="sm" variant="outline" onClick={() => { setLoadError(""); setPhase("idle") }}>Новый расчёт / выбрать данные</Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-border bg-panel p-3 text-xs text-muted-foreground">
        <span>{run.source === "organizers" ? "Предзагруженный кейс организаторов" : "Загруженные аналитиком parquet"}</span>
        <span className="hud-num">Seed: {run.seedCount} → сеть: {data.nodes.length} → выбранные: {reviewGids.length}</span>
        <span className="hud-num">Расчёт: {run.elapsedSeconds} с</span>
        <details className="w-full"><summary className="cursor-pointer text-sky">Паспорт расчёта и выполненные этапы</summary><div className="mt-3 space-y-2">
          <p className="hud-num break-all">Запуск {run.id} · {new Date(run.completedAt).toLocaleString("ru-RU")}</p>
          <p>{run.files.map((file) => `${file.name} (${file.size} байт)`).join(" · ")}</p>
          <ul className="list-inside list-disc">{run.steps.map((step) => <li key={step}>{step}</li>)}</ul>
        </div></details>
      </div>

      <KpiGrid data={data} />
      <NetworkOverview key={run.id} data={data} membersByCluster={membersByCluster} onCluster={openCluster} />

      <div id="network-detail" className="grid scroll-mt-4 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <NetworkCard data={data} selected={selected} onSelect={findNode} />
          <RoleSummary data={data} />
        </div>
        <div id="node-detail" tabIndex={-1} aria-label="Карточка выбранного узла" className="min-w-0 space-y-4 outline-none">
          <NodeCard node={selected} included={reviewGids.includes(selectedGid)} onToggle={toggleReview} />
          <ClusterCard data={data} node={selected} />
        </div>
      </div>
      <ClusterOverview
        clusters={data.clusters} membersByCluster={membersByCluster}
        selectedCluster={selectedCluster} selectedGid={selectedGid}
        onCluster={setSelectedCluster} onNode={openNode}
        onCandidates={(id) => {
          setClusterFilter(id)
          setRoleFilter("all")
          document.getElementById("candidates")?.scrollIntoView({ block: "start" })
        }}
      />
      <TopNodesCard data={data} nodesById={nodesById} selectedGid={selectedGid} onSelect={openNode}
        roleFilter={roleFilter} clusterFilter={clusterFilter} onRole={setRoleFilter} onCluster={setClusterFilter}
        reviewGids={reviewGids} onToggle={toggleReview} />
      <ReviewList graph={data} run={run} nodes={reviewGids.map((gid) => nodesById.get(gid)!).filter(Boolean)} onRemove={toggleReview} onNode={openNode} />
    </section>
  )
}

function SearchBox({
  query,
  error,
  onQuery,
  onSearch,
}: {
  query: string
  error: string
  onQuery: (value: string) => void
  onSearch: () => void
}) {
  return (
    <div className="w-full shrink-0 xl:w-[380px]">
      <label htmlFor="gid-search" className="hud-caps mb-2 block text-xs text-sky">Найти GID / 18 цифр</label>
      <div className="hud-beam p-px"><div className="flex gap-2 bg-background p-2">
        <Input
          id="gid-search"
          aria-label="Поиск по GID"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "gid-error" : undefined}
          className="hud-num h-9"
          inputMode="numeric"
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSearch()}
          placeholder="Точный 18-значный GID"
          value={query}
        />
        <Button aria-label="Найти узел" onClick={onSearch} variant="outline">
          <Search /> Найти
        </Button>
      </div></div>
      {error && <p id="gid-error" role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function KpiGrid({ data }: { data: MoneyGraphData }) {
  const metrics = [
    { label: "Узлы сети", value: data.meta.nodes, suffix: "", icon: Users },
    { label: "Исходные seed", value: data.nodes.filter((node) => node.is_seed).length, suffix: "", icon: Users },
    { label: "Направленные рёбра", value: data.meta.edges, suffix: "", icon: Network },
    { label: "Транзакции", value: data.meta.transactions, suffix: "", icon: Route },
    { label: "Оборот", value: data.meta.turnoverKzt / 1_000_000, suffix: " млн ₸", icon: CircleDollarSign, decimals: 1 },
    { label: "Кластеры", value: data.clusters.length, suffix: "", icon: Network },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric, index) => (
        <Card key={metric.label} size="sm" style={stagger(index)}>
          <CardHeader>
            <CardDescription className="hud-caps text-[11px]">{metric.label}</CardDescription>
            <CardAction><metric.icon className="size-4 text-sky" /></CardAction>
            <CardTitle className="text-2xl">
              <CountUp to={metric.value} decimals={metric.decimals} suffix={metric.suffix} />
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

function NetworkCard({
  data,
  selected,
  onSelect,
}: {
  data: MoneyGraphData
  selected: MoneyNode | null
  onSelect: (gid: string) => void
}) {
  return (
    <Card className="min-h-[460px]">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
        <div className="space-y-1">
        <CardDescription className="hud-caps text-sky">Локальная схема потоков</CardDescription>
        <CardTitle className="text-sm">{selected ? `Связи узла ${selected.gid}` : "Выберите узел"}</CardTitle>
        </div>
          <Badge variant="outline" data-tone="sky">Направленный граф</Badge>
      </CardHeader>
      <CardContent className="pt-3">
        {selected ? <EgoGraph data={data} selected={selected} onSelect={onSelect} /> : null}
      </CardContent>
    </Card>
  )
}

function EgoGraph({
  data,
  selected,
  onSelect,
}: {
  data: MoneyGraphData
  selected: MoneyNode
  onSelect: (gid: string) => void
}) {
  const allConnections = data.edges
    .filter((edge) => edge.src === selected.gid || edge.dst === selected.gid)
    .sort((a, b) => b.sum_kzt - a.sum_kzt)
  const connections = allConnections.slice(0, 14)
  const nodesById = new Map(data.nodes.map((node) => [node.gid, node]))
  const neighborGids = [...new Set(connections.map((edge) => edge.src === selected.gid ? edge.dst : edge.src))]
  const placed = neighborGids.map((gid, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(neighborGids.length, 1) - Math.PI / 2
    const radius = connections.length > 10 ? 145 : 132
    return {
      node: nodesById.get(gid),
      gid,
      x: 250 + Math.cos(angle) * radius,
      y: 190 + Math.sin(angle) * radius,
    }
  })
  const positions = new Map(placed.map((node) => [node.gid, node]))
  const markerId = React.useId().replace(/:/g, "")

  return (
    <div className="overflow-hidden hud-blueprint">
      <p className="px-3 pt-2 text-xs text-muted-foreground">
        {allConnections.length ? `Показано ${connections.length} из ${allConnections.length} направленных связей по сумме перевода.` : "В наблюдаемой сети у узла нет связей."}
        {selected.truncated_by_depth && " Четвёртое колено: отсутствие выхода не означает, что деньги осели."}
      </p>
      <svg aria-label="Локальный граф транзакций" className="h-[360px] w-full" role="group" viewBox="0 0 500 390">
        <defs>
          <marker id={markerId} markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
            <path className="fill-muted-foreground" d="M0,0 L0,6 L6,3 z" />
          </marker>
        </defs>
        {connections.map((edge) => {
          const outgoing = edge.src === selected.gid
          const { x, y } = positions.get(outgoing ? edge.dst : edge.src)!
          const distance = Math.hypot(x - 250, y - 190) || 1
          const dx = (x - 250) / distance
          const dy = (y - 190) / distance
          // Offset opposite flows and stop before node borders so arrowheads stay visible.
          const offset = outgoing ? 3 : -3
          const nearX = 250 + dx * 38 - dy * offset
          const nearY = 190 + dy * 38 + dx * offset
          const farX = x - dx * 23 - dy * offset
          const farY = y - dy * 23 + dx * offset
          return (
            <line
              className="stroke-muted-foreground/70"
              key={`${edge.src}-${edge.dst}`}
              markerEnd={`url(#${markerId})`}
              strokeWidth={Math.min(4, 1 + Math.log10(Math.max(edge.sum_kzt, 1)) / 4)}
              x1={outgoing ? nearX : farX}
              x2={outgoing ? farX : nearX}
              y1={outgoing ? nearY : farY}
              y2={outgoing ? farY : nearY}
            ><title>{edge.src} → {edge.dst}: {money.format(edge.sum_kzt)} ₸</title></line>
          )
        })}
        {placed.map(({ gid, node, x, y }) => (
          <g className="cursor-pointer focus-visible:outline-2 focus-visible:outline-primary" key={gid} onClick={() => onSelect(gid)} role="button" tabIndex={0} aria-label={`Открыть связи ${gid}`}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(gid) } }}>
            <title>{gid} / {node ? ROLE_LABELS[node.role] : "Узел"}</title>
            {node?.is_seed && (
              <circle className="fill-none stroke-warning" cx={x} cy={y} r="17" strokeWidth="1" />
            )}
            <circle className={`fill-panel ${roleStroke(node?.role)}`} cx={x} cy={y} r="13" strokeWidth="1" />
            <text className="fill-foreground font-mono text-[9px]" textAnchor="middle" x={x} y={y + 30}>
              …{gid.slice(-6)}
            </text>
          </g>
        ))}
        {selected.is_seed && (
          <circle className="fill-none stroke-warning" cx="250" cy="190" r="35" strokeWidth="1" />
        )}
        <circle className={`fill-panel ${roleStroke(selected.role)}`} cx="250" cy="190" r="30" strokeWidth="2" />
        <circle className={`fill-none ${roleStroke(selected.role)}`} cx="250" cy="190" r="5" strokeWidth="3" />
        <text className="fill-foreground font-mono text-[10px]" textAnchor="middle" x="250" y="236">
          …{selected.gid.slice(-8)}
        </text>
      </svg>
      <div className="flex flex-wrap gap-3 px-3 pb-3 text-[11px] text-muted-foreground">
        <span>→ направление денег</span>
        <span>Контур = роль-гипотеза</span>
        <span className="text-warning">◎ кольцо = seed</span>
      </div>
    </div>
  )
}

function TopNodesCard({
  data,
  nodesById,
  selectedGid,
  onSelect,
  roleFilter, clusterFilter, onRole, onCluster,
  reviewGids, onToggle,
}: {
  data: MoneyGraphData
  nodesById: Map<string, MoneyNode>
  selectedGid: string
  onSelect: (gid: string) => void
  roleFilter: MoneyRole | "all"
  clusterFilter: number | "all"
  onRole: (role: MoneyRole | "all") => void
  onCluster: (id: number | "all") => void
  reviewGids: string[]
  onToggle: (gid: string) => void
}) {
  const candidates = filterTopNodes(data, nodesById, roleFilter, clusterFilter)
  const reset = () => { onRole("all"); onCluster("all") }
  return (
    <Card id="candidates" className="scroll-mt-4">
      <CardHeader>
        <CardDescription className="hud-caps text-primary">Очередь проверки</CardDescription>
        <CardTitle>Топ кандидатов на проверку</CardTitle>
        <CardAction><Badge variant="outline">TOP {data.topNodes.length}</Badge></CardAction>
        <p className="mt-2 text-xs text-muted-foreground">Фильтры действуют только на сохранённый топ, не на всю сеть. Исходные места и priority_score не меняются; score не является вероятностью нарушения.</p>
      </CardHeader>
      <div className="flex flex-wrap items-end gap-3 px-4">
        <div className="space-y-2">
          <label htmlFor="candidate-role" className="hud-caps block text-xs text-dim">Роль-гипотеза</label>
          <Select value={roleFilter} onValueChange={(value) => onRole(value as MoneyRole | "all")}>
            <SelectTrigger id="candidate-role" aria-label="Фильтр кандидатов по роли" className="w-52"><SelectValue>{roleFilter === "all" ? "Все роли" : ROLE_LABELS[roleFilter]}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="all">Все роли</SelectItem>{MONEY_ROLES.map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="candidate-cluster" className="hud-caps block text-xs text-dim">Кластер</label>
          <Select value={String(clusterFilter)} onValueChange={(value) => onCluster(value === "all" || value === null ? "all" : Number(value))}>
            <SelectTrigger id="candidate-cluster" aria-label="Фильтр кандидатов по кластеру" className="w-52"><SelectValue>{clusterFilter === "all" ? "Все кластеры" : clusterLabel(clusterFilter)}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="all">Все кластеры</SelectItem>{data.clusters.map((cluster) => <SelectItem key={cluster.cluster_id} value={String(cluster.cluster_id)}>{clusterLabel(cluster.cluster_id)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="ghost" onClick={reset} disabled={roleFilter === "all" && clusterFilter === "all"}>Сбросить фильтры</Button>
        <p role="status" className="hud-num ml-auto pb-2 text-xs text-sky">Показано {candidates.length} из {data.topNodes.length}</p>
      </div>
      <CardContent className="max-h-[470px] overflow-auto px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">#</TableHead>
              <TableHead>GID</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Кластер</TableHead>
              <TableHead className="text-right">Приоритет</TableHead>
              <TableHead>Вход / выход, ₸</TableHead>
              <TableHead>Почему в очереди</TableHead>
              <TableHead>Проверить</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((node) => (
              <TableRow
                data-state={selectedGid === node.gid ? "selected" : undefined}
                key={node.gid}
              >
                <TableCell className="hud-num pl-4 text-dim">{String(node.rank).padStart(2, "0")}</TableCell>
                <TableCell className="hud-num text-xs"><button type="button" className="underline decoration-border underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onSelect(node.gid)} aria-label={`Разобрать кандидата ${node.gid}`}>{node.gid}</button></TableCell>
                <TableCell><RoleBadge role={node.role} /></TableCell>
                <TableCell className="hud-num text-xs">{String(nodesById.get(node.gid)?.cluster_id ?? "—").padStart(2, "0")}</TableCell>
                <TableCell className="hud-num text-right text-sky">{score(node.priority_score)}</TableCell>
                <TableCell className="hud-num text-xs"><span className="block">↓ {money.format(nodesById.get(node.gid)!.in_kzt)}</span><span className="block">↑ {money.format(nodesById.get(node.gid)!.out_kzt)}</span></TableCell>
                <TableCell className="min-w-52 max-w-md whitespace-normal text-xs leading-5 text-muted-foreground"><p>{node.why}</p>{nodesById.get(node.gid)!.evidence !== node.why && <p className="mt-1">{nodesById.get(node.gid)!.evidence}</p>}</TableCell>
                <TableCell><ReviewButton gid={node.gid} included={reviewGids.includes(node.gid)} onToggle={onToggle} /></TableCell>
              </TableRow>
            ))}
            {!candidates.length && <TableRow><TableCell colSpan={8} className="p-8 text-center whitespace-normal">
              <p className="text-sm">В сохранённом топе нет кандидатов с такими фильтрами.</p>
              <p className="mt-2 text-xs text-muted-foreground">Это не означает, что в сети нет таких узлов. Откройте обзор кластеров или сбросьте фильтры.</p>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function NodeCard({ node, included, onToggle }: { node: MoneyNode | null; included: boolean; onToggle: (gid: string) => void }) {
  if (!node) return null
  return (
    <Card data-agent={node.priority_score > 0.9 ? "waiting" : undefined}>
      <CardHeader className="flex flex-col items-start gap-2">
        <CardDescription className="hud-caps text-primary">Карточка узла</CardDescription>
        <CardTitle className="hud-num break-all text-xl">{node.gid}</CardTitle>
        <RoleBadge role={node.role} />
        <ReviewButton gid={node.gid} included={included} onToggle={onToggle} />
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="border-l border-primary pl-3 text-sm leading-6 text-foreground">
          {node.evidence}
        </p>
        <div className="grid grid-cols-2 gap-px bg-border">
          <Metric label="Приоритет / 0–1" value={score(node.priority_score)} />
          <Metric label="Оценка роли / 0–1" value={score(node.role_score)} />
          <Metric label="Входящий поток" value={`${money.format(node.in_kzt)} ₸`} icon="in" />
          <Metric label="Исходящий поток" value={`${money.format(node.out_kzt)} ₸`} icon="out" />
          <Metric label="Отправители" value={String(node.in_deg)} />
          <Metric label="Получатели" value={String(node.out_deg)} />
        </div>
        {node.truncated_by_depth && <p className="text-xs leading-5 text-warning">Обрыв обхода на четвёртом колене. Отсутствие исходящих переводов не доказывает, что деньги осели.</p>}
        {node.is_seed && <p className="text-xs leading-5 text-warning">Seed: входящий поток наблюдается не полностью. Граф собран по исходящим переводам.</p>}
        <div className="flex flex-wrap gap-2">
          <span className="hud-tag hud-num">CLUSTER {String(node.cluster_id).padStart(2, "0")}</span>
          <span className="hud-tag hud-num">DEPTH {node.depth}</span>
          {node.is_seed && <span className="hud-tag" data-tone="warning">SEED</span>}
          {node.truncated_by_depth && <span className="hud-tag" data-tone="warning">ГРАНИЦА НАБЛЮДЕНИЯ</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: "in" | "out" }) {
  return (
    <div className="bg-panel p-3">
      <p className="flex items-center gap-1 text-[10px] text-dim">
        {icon === "in" && <ArrowDownLeft className="size-3 text-sky" />}
        {icon === "out" && <ArrowUpRight className="size-3 text-primary" />}
        {label}
      </p>
      <p className="hud-num mt-1 text-sm text-foreground">{value}</p>
    </div>
  )
}

function RoleSummary({ data }: { data: MoneyGraphData }) {
  const entries = MONEY_ROLES.map((role): [MoneyRole, number] => [role, data.meta.roleCounts[role] ?? 0])
    .sort((a, b) => b[1] - a[1])
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="hud-caps text-sm">Ролевой профиль сети</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([role, count]) => (
          <div className="grid grid-cols-[120px_1fr_42px] items-center gap-2" key={role}>
            <span className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</span>
            <div className="h-1 bg-muted">
              <div
                className={`h-full ${roleBar[role]}`}
                style={{ width: `${(count / data.meta.nodes) * 100}%` }}
              />
            </div>
            <span className="hud-num text-right text-xs">{count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ClusterCard({ data, node }: { data: MoneyGraphData; node: MoneyNode | null }) {
  const cluster = data.clusters.find((item) => item.cluster_id === node?.cluster_id)
  if (!cluster) return null
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="hud-caps text-sky">Кластер {String(cluster.cluster_id).padStart(2, "0")}</CardDescription>
        <CardTitle className="text-sm">{cluster.hypothesis}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Узлов" value={String(cluster.n_nodes)} />
        <Metric label="Seed" value={String(cluster.n_seed)} />
        <Metric label="Внутри, ₸" value={money.format(cluster.sum_kzt_internal)} />
      </CardContent>
    </Card>
  )
}
