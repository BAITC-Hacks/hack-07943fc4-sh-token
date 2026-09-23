import { ArrowUpRight, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ClusterSummary, MoneyNode } from "@/lib/graph-types"
import { clusterLabel, money, RoleBadge, score } from "./graph-presentation"

const MEMBER_LIMIT = 20

export function ClusterOverview({
  clusters, membersByCluster, selectedCluster, selectedGid, onCluster, onNode, onCandidates,
}: {
  clusters: ClusterSummary[]
  membersByCluster: Map<number, MoneyNode[]>
  selectedCluster: number | null
  selectedGid: string
  onCluster: (id: number) => void
  onNode: (gid: string) => void
  onCandidates: (id: number) => void
}) {
  const ordered = [...clusters].sort((a, b) => b.n_nodes - a.n_nodes || a.cluster_id - b.cluster_id)
  const selected = clusters.find((cluster) => cluster.cluster_id === selectedCluster)
  const members = selected ? membersByCluster.get(selected.cluster_id) ?? [] : []
  return (
    <section id="clusters" aria-labelledby="clusters-title" className="scroll-mt-4">
      <Card>
        <CardHeader className="border-b border-border">
          <CardDescription className="hud-caps text-sky">От сообщества — к конкретному узлу</CardDescription>
          <CardTitle id="clusters-title">Обзор кластеров <span className="hud-num ml-2 text-dim">/ {clusters.length}</span></CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">По размеру, от больших к малым. Гипотезы взяты из сохранённого расчёта.</p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div aria-label="Список кластеров" className="max-h-[520px] space-y-2 overflow-auto pr-2">
            {ordered.map((cluster) => (
              <button
                type="button"
                key={cluster.cluster_id}
                aria-pressed={selectedCluster === cluster.cluster_id}
                aria-label={`Открыть ${clusterLabel(cluster.cluster_id).toLowerCase()}`}
                onClick={() => onCluster(cluster.cluster_id)}
                className="w-full border border-border bg-background p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary/5"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="hud-caps text-sm">{clusterLabel(cluster.cluster_id)}</span>
                  <span className="hud-num text-xs text-sky">{money.format(cluster.sum_kzt_internal)} ₸</span>
                </span>
                <span className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span><Users className="mr-1 inline size-3" />{cluster.n_nodes} узлов</span>
                  <span className="text-warning">{cluster.n_seed} seed</span>
                  <span className="ml-auto text-dim">внутренний оборот</span>
                </span>
                <span className="mt-3 block text-xs leading-5 text-muted-foreground">{cluster.hypothesis}</span>
              </button>
            ))}
            {!clusters.length && <p className="p-4 text-sm text-muted-foreground">В результате нет кластеров.</p>}
          </div>
          <div className="min-w-0 border border-border bg-background" aria-label="Участники выбранного кластера">
            {selected ? <>
              <div className="space-y-3 border-b border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="hud-caps text-base text-primary">{clusterLabel(selected.cluster_id)} / участники</h3>
                  <Button size="sm" variant="outline" onClick={() => onCandidates(selected.cluster_id)}>Кандидаты кластера <ArrowUpRight /></Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{selected.hypothesis}</p>
                <p role="status" className="hud-num text-xs text-sky">
                  {members.length > MEMBER_LIMIT
                    ? `Ограниченная выборка: ${MEMBER_LIMIT} из ${members.length} узлов с наибольшим priority_score.`
                    : `Показаны все участники: ${members.length}.`}
                </p>
                <p className="text-xs text-dim">{members.length > MEMBER_LIMIT && "Остальные узлы доступны через точный поиск GID. "}Нажмите GID, чтобы открыть карточку и связи.</p>
              </div>
              <div className="max-h-[340px] overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>GID / seed</TableHead><TableHead>Роль-гипотеза</TableHead><TableHead className="text-right">Приоритет</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {members.slice(0, MEMBER_LIMIT).map((node) => (
                      <TableRow key={node.gid} data-state={selectedGid === node.gid ? "selected" : undefined}>
                        <TableCell>
                          <button type="button" className="hud-num text-xs underline decoration-border underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onNode(node.gid)} aria-label={`Открыть карточку ${node.gid}`}>{node.gid}</button>
                          {node.is_seed && <Badge className="ml-2" variant="outline" data-tone="warning">S</Badge>}
                        </TableCell>
                        <TableCell><RoleBadge role={node.role} /></TableCell>
                        <TableCell className="hud-num text-right text-sky">{score(node.priority_score)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </> : <p className="p-6 text-sm text-muted-foreground">Выберите кластер в списке слева.</p>}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
