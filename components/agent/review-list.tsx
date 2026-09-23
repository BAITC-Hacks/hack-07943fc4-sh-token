import { Download, Plus, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AnalysisRun, MoneyGraphData, MoneyNode } from "@/lib/graph-types"
import { buildReviewCsv } from "@/lib/review-list"
import { money, RoleBadge, score } from "./graph-presentation"

export function ReviewButton({ gid, included, onToggle }: { gid: string; included: boolean; onToggle: (gid: string) => void }) {
  return <Button size="sm" variant="outline" aria-pressed={included} aria-label={`${included ? "Убрать" : "Добавить"} ${gid} ${included ? "из списка" : "в список"} проверки`} onClick={() => onToggle(gid)}>
    {included ? <Check /> : <Plus />}{included ? "В списке" : "В список"}
  </Button>
}

export function ReviewList({ nodes, graph, run, onRemove, onNode }: {
  nodes: MoneyNode[]; graph: MoneyGraphData; run: AnalysisRun
  onRemove: (gid: string) => void; onNode: (gid: string) => void
}) {
  function download() {
    const url = URL.createObjectURL(new Blob([buildReviewCsv(nodes, graph, run)], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `review-${run.id}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  return <Card id="review-list" className="scroll-mt-4">
    <CardHeader className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1"><CardDescription className="hud-caps text-primary">05 / Решение аналитика</CardDescription><CardTitle>Мой список проверки / {nodes.length}</CardTitle></div>
      <Button disabled={!nodes.length} onClick={download}><Download />Экспортировать список в CSV</Button>
    </CardHeader>
    <CardContent className="space-y-3">
      <p className="text-xs leading-5 text-muted-foreground">Только выбранные вами узлы, не автоматический топ. Роли и score сохранены без изменений. Список хранится в этой вкладке до перезагрузки или нового расчёта: экспортируйте его перед уходом.</p>
      {!nodes.length ? <p role="status" className="border border-dashed border-border p-6 text-sm text-muted-foreground">Список пуст. Добавьте кандидата из топа или карточки любого GID, затем выгрузите список на углублённую проверку.</p> : <div className="max-h-96 overflow-auto"><Table>
        <TableHeader><TableRow><TableHead>GID</TableHead><TableHead>Роль-гипотеза</TableHead><TableHead>Приоритет</TableHead><TableHead>Вход / выход, ₸</TableHead><TableHead>Числовое обоснование</TableHead><TableHead>Действие</TableHead></TableRow></TableHeader>
        <TableBody>{nodes.map((node) => <TableRow key={node.gid}>
          <TableCell><button className="hud-num text-xs underline underline-offset-4 hover:text-primary" aria-label={`Открыть выбранного ${node.gid}`} onClick={() => onNode(node.gid)}>{node.gid}</button></TableCell>
          <TableCell><RoleBadge role={node.role} /></TableCell><TableCell className="hud-num text-sky">{score(node.priority_score)}</TableCell>
          <TableCell className="hud-num text-xs">{money.format(node.in_kzt)} / {money.format(node.out_kzt)}</TableCell>
          <TableCell className="min-w-52 max-w-sm whitespace-normal text-xs leading-5">{node.evidence}</TableCell>
          <TableCell><Button size="sm" variant="ghost" aria-label={`Удалить ${node.gid} из списка проверки`} onClick={() => onRemove(node.gid)}><Trash2 />Удалить</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
      <p className="text-xs text-warning">CSV содержит полный строковый GID. В Excel импортируйте столбец gid как «Текст», иначе 18 цифр могут потерять точность. Выгрузка — кандидаты для проверки, не обвинение.</p>
    </CardContent>
  </Card>
}
