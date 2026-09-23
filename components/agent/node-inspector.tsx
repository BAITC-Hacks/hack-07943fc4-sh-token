import { ArrowDownLeft, ArrowUpRight, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { MoneyGraphData, MoneyNode } from "@/lib/graph-types"
import { completenessNotes } from "@/lib/graph-investigation"
import { money, RoleBadge, score } from "./graph-presentation"
import { ReviewButton } from "./review-list"

export function NodeInspector({ node, data, included, onToggle, onPath }: {
  node: MoneyNode; data: MoneyGraphData; included: boolean; onToggle: (gid: string) => void; onPath: () => void
}) {
  const cluster = data.clusters.find(c => c.cluster_id === node.cluster_id)
  const s = node.signals
  const ratio = node.in_kzt > 0 && !node.is_seed ? node.out_kzt / node.in_kzt : null
  return <aside className="min-w-0 border border-border bg-panel" aria-label="Карточка выбранного узла">
    <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="hud-caps text-[11px] text-sky">Выбранный клиент</span><span className="hud-tag">{node.is_seed ? "Исходный / seed" : "Не seed"}</span></div>
      <div className="flex items-center justify-between gap-3"><h2 className="hud-num text-xs">{node.gid}</h2><Button size="icon-sm" variant="ghost" aria-label="Скопировать GID" onClick={async()=>{try{await navigator.clipboard.writeText(node.gid);toast.success("GID скопирован")}catch{toast.error("Не удалось скопировать GID")}}}><Copy className="size-3" /></Button></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><RoleBadge role={node.role} /><ReviewButton gid={node.gid} included={included} onToggle={onToggle}/></div>
    </div>
    <div className="space-y-4 p-4">
      <div className="border-l-2 border-primary pl-3 text-sm leading-6">{node.evidence}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs text-muted-foreground" title="Приоритет углублённой проверки">Приоритет</p><p className="hud-num mt-2 text-xl text-sky">{score(node.priority_score)}</p></div>
        <div><p className="text-xs text-muted-foreground">Сигнал роли</p><p className="hud-num mt-2 text-xl">{score(node.role_score)}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3 border-y border-border py-3">
        <div className="space-y-2"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownLeft className="size-3 shrink-0 text-sky"/><span>Входящие</span></p><p className="hud-num text-xs">{money.format(node.in_kzt)} ₸</p><p className="text-xs text-muted-foreground">{node.in_deg} отправителей</p></div>
        <div className="space-y-2"><p className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpRight className="size-3 shrink-0 text-primary"/><span>Исходящие</span></p><p className="hud-num text-xs">{money.format(node.out_kzt)} ₸</p><p className="text-xs text-muted-foreground">{node.out_deg} получателей</p></div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="hud-tag">Кластер {node.cluster_id}</span><span className="hud-tag">Колено {node.depth}</span><span className="hud-tag text-sky">Связан с {node.seed_reach} seed</span></div>
      <Button className="w-full" size="sm" variant="outline" onClick={onPath}>Путь от исходных клиентов →</Button>
      {node.truncated_by_depth && <p className="border border-warning/30 p-2 text-xs leading-5 text-warning">Граница выгрузки. Отсутствие выхода не подтверждает оседание денег.</p>}
      <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs text-sky">Потоки и временные сигналы</summary><div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
        <p>Выход / вход: {ratio === null ? "не применимо" : (ratio*100).toFixed(1)+"%"} наблюдаемого потока. Это не баланс счёта.</p>
        <p>{(node.quick_forward_ratio*100).toFixed(1)}% входящих операций имеют последующий выход в пределах двух дней. Совпадение средств не установлено.</p>
        {s && <><p>Максимум {s.synchronous_payers} разных отправителей за день{s.synchronous_day ? " ("+s.synchronous_day+")" : ""}.</p><p>Пик активности: {s.peak_day_tx} операций{s.peak_day ? " за "+s.peak_day : ""}; среднее {s.daily_average_tx} в день.</p>{s.activity_spike && <p className="text-warning">Дневной пик ≥3× среднего и ≥5 операций.</p>}{s.turnover_outlier && <p className="text-warning">Оборот выше Q3 + 1,5×IQR среди {s.depth_peer_count} узлов того же колена.</p>}</>}
      </div></details>
      <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs text-sky">Что запросить для проверки</summary><div className="mt-3 space-y-3">{completenessNotes(node).map(note=><div key={note.title}><p className="text-xs text-warning">{note.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{note.detail}</p></div>)}</div></details>
      {cluster && <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs text-sky">Контекст кластера · {cluster.n_nodes} узлов</summary><p className="mt-3 text-xs leading-5 text-muted-foreground">{cluster.hypothesis} Внутренний оборот: {money.format(cluster.sum_kzt_internal)} ₸.</p></details>}
      <p className="text-[10px] leading-4 text-dim">Score — расчётный показатель, не вероятность нарушения. Решение о проверке принимает аналитик.</p>
    </div>
  </aside>
}
