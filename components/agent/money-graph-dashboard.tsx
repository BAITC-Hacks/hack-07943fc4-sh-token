"use client"

import * as React from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  Database,
  Network,
  Route,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { CountUp, DecodeText, TypeLine, stagger } from "@/components/hud/hud-motion"
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
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMoneyGraph } from "@/lib/api"
import type { MoneyGraphData, MoneyNode, MoneyRole } from "@/lib/graph-types"

const ROLE_LABELS: Record<MoneyRole, string> = {
  consolidator: "Консолидация",
  transit: "Транзит",
  distributor: "Распределение",
  terminal: "Получатель",
  coordinator: "Координатор",
  peripheral: "Периферия",
}

const STEPS = [
  "Проверка консистентности 4 840 транзакций",
  "Расчёт структурных и временных признаков",
  "Поиск сообществ алгоритмом Louvain",
  "Присвоение объяснимых ролей",
  "Формирование приоритетов для проверки",
]

const EXAMPLE_GIDS = [
  "100000008165763100",
  "100000000331309100",
  "100000002398779100",
]

const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 0,
})

type Phase = "idle" | "running" | "done" | "error"

export function MoneyGraphDashboard() {
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [activeStep, setActiveStep] = React.useState(-1)
  const [data, setData] = React.useState<MoneyGraphData | null>(null)
  const [selectedGid, setSelectedGid] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [searchError, setSearchError] = React.useState("")

  const nodesById = React.useMemo(
    () => new Map(data?.nodes.map((node) => [node.gid, node]) ?? []),
    [data]
  )
  const selected = nodesById.get(selectedGid) ?? null

  const runAnalysis = React.useCallback(async () => {
    setPhase("running")
    setActiveStep(0)
    setSearchError("")
    try {
      const request = getMoneyGraph()
      for (let index = 0; index < STEPS.length; index += 1) {
        setActiveStep(index)
        await new Promise((resolve) => window.setTimeout(resolve, 360))
      }
      const result = await request
      setData(result)
      setSelectedGid(result.topNodes[0]?.gid ?? result.nodes[0]?.gid ?? "")
      setPhase("done")
      toast.success("Анализ транзакционной сети завершён")
    } catch {
      setPhase("error")
    }
  }, [])

  const findNode = React.useCallback(
    (gid: string) => {
      const normalized = gid.trim()
      if (!normalized) return
      if (!nodesById.has(normalized)) {
        setSearchError("GID не найден в наблюдаемой сети")
        return
      }
      setSelectedGid(normalized)
      setQuery(normalized)
      setSearchError("")
    },
    [nodesById]
  )

  if (phase === "idle") {
    return <StartScreen onRun={runAnalysis} onExample={setQuery} query={query} />
  }

  if (phase === "running") {
    return <WorkingScreen activeStep={activeStep} />
  }

  if (phase === "error" || !data) {
    return <ErrorScreen onRetry={runAnalysis} />
  }

  return (
    <section className="space-y-4" data-agent="done">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="hud-tag" data-tone="sky"><span className="hud-dot" />Анализ завершён</span>
            <span className="hud-num text-xs text-dim">01.07–31.07.2026</span>
          </div>
          <DecodeText
            as="h1"
            className="hud-caps text-3xl text-foreground md:text-5xl"
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
          onSearch={() => findNode(query)}
        />
      </header>

      <KpiGrid data={data} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="space-y-4">
          <NetworkCard data={data} selected={selected} onSelect={findNode} />
          <TopNodesCard data={data} selectedGid={selectedGid} onSelect={findNode} />
        </div>
        <div className="space-y-4">
          <NodeCard node={selected} />
          <RoleSummary data={data} />
          <ClusterCard data={data} node={selected} />
        </div>
      </div>
    </section>
  )
}

function StartScreen({
  onRun,
  onExample,
  query,
}: {
  onRun: () => void
  onExample: (value: string) => void
  query: string
}) {
  return (
    <section className="mx-auto flex min-h-[72vh] max-w-5xl items-center justify-center">
      <Card className="w-full" data-agent="waiting">
        <CardHeader className="border-b border-border pb-5 text-center">
          <CardDescription className="hud-caps text-primary">AML // Графовый анализ</CardDescription>
          <CardTitle className="hud-caps text-3xl md:text-5xl">
            <DecodeText text="ВОССТАНОВИТЬ СТРУКТУРУ ПОТОКОВ" />
          </CardTitle>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Система обработает обезличенную сеть переводов, определит роли участников и покажет,
            кого из 2 248 клиентов аналитику стоит проверить первым — с числовым обоснованием.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 py-6">
          <div className="hud-panel relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <Database className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="hud-caps text-xs text-foreground">data/*.parquet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                2 248 узлов · 3 119 рёбер · 4 840 транзакций · 365,9 млн KZT
              </p>
            </div>
            <Button size="lg" onClick={onRun}>
              Проанализировать сеть <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
          <div>
            <p className="mb-3 text-center text-xs text-dim">ПРИМЕРЫ УЗЛОВ ДЛЯ РАЗБОРА</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_GIDS.map((gid) => (
                <button
                  className="hud-tag hud-num transition-colors hover:text-primary"
                  key={gid}
                  onClick={() => onExample(gid)}
                  type="button"
                >
                  {query === gid ? "→ " : ""}{gid}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function WorkingScreen({ activeStep }: { activeStep: number }) {
  return (
    <section className="mx-auto grid min-h-[72vh] max-w-6xl items-center gap-4 lg:grid-cols-[1fr_0.8fr]" data-agent="working">
      <Card>
        <CardHeader>
          <CardDescription className="hud-caps text-primary">ORION // Анализирует сеть</CardDescription>
          <CardTitle className="hud-caps text-2xl">Восстановление структуры потоков</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {STEPS.map((step, index) => {
            const done = index < activeStep
            const active = index === activeStep
            return (
              <div
                className="flex items-center gap-3 border-b border-border py-3 last:border-0"
                key={step}
              >
                <span className={`grid size-6 place-items-center border ${active ? "border-primary text-primary" : done ? "border-sky text-sky" : "border-border text-dim"}`}>
                  {done ? <Check className="size-3.5" /> : <span className="hud-num text-[10px]">0{index + 1}</span>}
                </span>
                <span className={active ? "text-foreground" : done ? "text-muted-foreground" : "text-dim"}>
                  {step}
                </span>
                <span className={`ml-auto hud-caps text-[10px] ${active ? "text-primary" : done ? "text-sky" : "text-dim"}`}>
                  {active ? "В работе" : done ? "Готово" : "Ожидание"}
                </span>
              </div>
            )
          })}
          <Progress value={((activeStep + 1) / STEPS.length) * 100} />
        </CardContent>
      </Card>
      <Card className="min-h-80">
        <CardHeader>
          <CardTitle className="hud-caps text-sm">Журнал расчёта</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs text-muted-foreground">
          {STEPS.slice(0, activeStep + 1).map((step, index) => (
            <p key={step}>
              <span className="mr-3 text-dim">00:0{index + 1}</span>
              <TypeLine text={step} />
            </p>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mx-auto flex min-h-[72vh] max-w-3xl items-center" data-agent="error">
      <Card className="w-full">
        <CardHeader>
          <ShieldAlert className="mb-3 size-8 text-destructive" />
          <CardTitle className="hud-caps">Не удалось загрузить результаты</CardTitle>
          <CardDescription>
            Проверьте наличие `public/data/graph.json` или включите демо-режим.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRetry}>Повторить анализ</Button>
        </CardContent>
      </Card>
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
    <div className="w-full lg:w-[420px]">
      <div className="flex gap-2">
        <Input
          aria-label="Поиск по GID"
          className="hud-num h-9"
          inputMode="numeric"
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSearch()}
          placeholder="Введите GID"
          value={query}
        />
        <Button aria-label="Найти узел" onClick={onSearch} variant="outline">
          <Search /> Найти
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function KpiGrid({ data }: { data: MoneyGraphData }) {
  const metrics = [
    { label: "Узлы сети", value: data.meta.nodes, suffix: "", icon: Users },
    { label: "Транзакции", value: data.meta.transactions, suffix: "", icon: Route },
    { label: "Оборот", value: data.meta.turnoverKzt / 1_000_000, suffix: " млн ₸", icon: CircleDollarSign, decimals: 1 },
    { label: "Кластеры", value: data.clusters.length, suffix: "", icon: Network },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      <CardHeader className="border-b border-border pb-4">
        <CardDescription className="hud-caps text-sky">Локальная схема потоков</CardDescription>
        <CardTitle>{selected ? `Связи узла ${selected.gid}` : "Выберите узел"}</CardTitle>
        <CardAction>
          <Badge variant="outline" data-tone="sky">Направленный граф</Badge>
        </CardAction>
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
  const connections = data.edges
    .filter((edge) => edge.src === selected.gid || edge.dst === selected.gid)
    .sort((a, b) => b.sum_kzt - a.sum_kzt)
    .slice(0, 14)
  const nodesById = new Map(data.nodes.map((node) => [node.gid, node]))
  const placed = connections.map((edge, index) => {
    const gid = edge.src === selected.gid ? edge.dst : edge.src
    const angle = (Math.PI * 2 * index) / Math.max(connections.length, 1) - Math.PI / 2
    const radius = connections.length > 10 ? 145 : 132
    return {
      edge,
      node: nodesById.get(gid),
      gid,
      x: 250 + Math.cos(angle) * radius,
      y: 190 + Math.sin(angle) * radius,
    }
  })

  return (
    <div className="relative overflow-hidden hud-blueprint">
      <svg aria-label="Локальный граф транзакций" className="h-[390px] w-full" role="img" viewBox="0 0 500 380">
        <defs>
          <marker id="flow-arrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
            <path className="fill-muted-foreground" d="M0,0 L0,6 L6,3 z" />
          </marker>
        </defs>
        {placed.map(({ edge, x, y }) => {
          const outgoing = edge.src === selected.gid
          return (
            <line
              className="stroke-muted-foreground/50"
              key={`${edge.src}-${edge.dst}`}
              markerEnd="url(#flow-arrow)"
              strokeWidth={Math.min(4, 1 + Math.log10(Math.max(edge.sum_kzt, 1)) / 4)}
              x1={outgoing ? 250 : x}
              x2={outgoing ? x : 250}
              y1={outgoing ? 190 : y}
              y2={outgoing ? y : 190}
            />
          )
        })}
        {placed.map(({ edge, gid, node, x, y }) => (
          <g className="cursor-pointer" key={gid} onClick={() => onSelect(gid)} role="button">
            {node?.is_seed && (
              <circle className="fill-none stroke-warning" cx={x} cy={y} r="17" strokeWidth="1" />
            )}
            <circle className={`fill-panel ${roleStroke(node?.role)}`} cx={x} cy={y} r="13" strokeWidth="1" />
            <text className="fill-foreground font-mono text-[9px]" textAnchor="middle" x={x} y={y + 30}>
              …{gid.slice(-6)}
            </text>
            <text className="fill-muted-foreground font-mono text-[8px]" textAnchor="middle" x={x} y={y + 41}>
              {money.format(edge.sum_kzt)} ₸
            </text>
          </g>
        ))}
        {selected.is_seed && (
          <circle className="fill-none stroke-warning" cx="250" cy="190" r="35" strokeWidth="1" />
        )}
        <circle className="fill-primary/20 stroke-primary" cx="250" cy="190" r="30" strokeWidth="2" />
        <circle className="fill-primary" cx="250" cy="190" r="5" />
        <text className="fill-foreground font-mono text-[10px]" textAnchor="middle" x="250" y="236">
          …{selected.gid.slice(-8)}
        </text>
      </svg>
      <div className="absolute bottom-3 left-3 flex gap-4 text-[10px] text-dim">
        <span><span className="mr-1 inline-block size-2 bg-primary" />выбранный узел</span>
        <span><span className="mr-1 inline-block size-2 border border-sky" />контрагент</span>
      </div>
    </div>
  )
}

function TopNodesCard({
  data,
  selectedGid,
  onSelect,
}: {
  data: MoneyGraphData
  selectedGid: string
  onSelect: (gid: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="hud-caps text-primary">Очередь проверки</CardDescription>
        <CardTitle>Топ приоритетных узлов</CardTitle>
        <CardAction><Badge variant="outline">TOP 20</Badge></CardAction>
      </CardHeader>
      <CardContent className="max-h-[470px] overflow-auto px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">#</TableHead>
              <TableHead>GID</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead className="text-right">Приоритет</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.topNodes.slice(0, 20).map((node) => (
              <TableRow
                className="cursor-pointer"
                data-state={selectedGid === node.gid ? "selected" : undefined}
                key={node.gid}
                onClick={() => onSelect(node.gid)}
              >
                <TableCell className="hud-num pl-4 text-dim">{String(node.rank).padStart(2, "0")}</TableCell>
                <TableCell className="hud-num">{node.gid}</TableCell>
                <TableCell><RoleBadge role={node.role} /></TableCell>
                <TableCell className="hud-num text-right text-sky">{percent.format(node.priority_score)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function NodeCard({ node }: { node: MoneyNode | null }) {
  if (!node) return null
  return (
    <Card data-agent={node.priority_score > 0.9 ? "waiting" : undefined}>
      <CardHeader>
        <CardDescription className="hud-caps text-primary">Карточка узла</CardDescription>
        <CardTitle className="hud-num break-all text-lg">{node.gid}</CardTitle>
        <CardAction><RoleBadge role={node.role} /></CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="border-l border-primary pl-3 text-sm leading-6 text-foreground">
          {node.evidence}
        </p>
        <div className="grid grid-cols-2 gap-px bg-border">
          <Metric label="Приоритет" value={percent.format(node.priority_score)} />
          <Metric label="Уверенность" value={percent.format(node.role_score)} />
          <Metric label="Входящий поток" value={`${money.format(node.in_kzt)} ₸`} icon="in" />
          <Metric label="Исходящий поток" value={`${money.format(node.out_kzt)} ₸`} icon="out" />
          <Metric label="Отправители" value={String(node.in_deg)} />
          <Metric label="Получатели" value={String(node.out_deg)} />
        </div>
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
  const entries = (Object.entries(data.meta.roleCounts) as [MoneyRole, number][])
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
                className="h-full bg-sky"
                style={{ width: `${Math.max(2, (count / data.meta.nodes) * 100)}%` }}
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
        <Metric label="Внутри" value={`${money.format(cluster.sum_kzt_internal / 1_000_000)} млн ₸`} />
      </CardContent>
    </Card>
  )
}

function RoleBadge({ role }: { role: MoneyRole }) {
  const tone = role === "coordinator"
    ? "danger"
    : role === "distributor"
      ? "warning"
      : role === "transit"
        ? "sky"
        : undefined
  const color = role === "coordinator"
    ? "text-destructive"
    : role === "consolidator"
      ? "text-primary"
      : role === "distributor"
        ? "text-warning"
        : role === "transit"
          ? "text-sky"
          : role === "peripheral"
            ? "text-dim"
            : "text-foreground"
  return <Badge className={color} variant="outline" data-tone={tone}>{ROLE_LABELS[role]}</Badge>
}

function roleStroke(role?: MoneyRole) {
  if (role === "coordinator") return "stroke-destructive"
  if (role === "consolidator") return "stroke-primary"
  if (role === "distributor") return "stroke-warning"
  if (role === "transit") return "stroke-sky"
  if (role === "peripheral") return "stroke-dim"
  return "stroke-foreground"
}
