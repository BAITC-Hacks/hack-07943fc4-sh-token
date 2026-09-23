import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MoneyGraphData, MoneyNode } from "@/lib/graph-types"
import { networkResilience, reciprocalFlows } from "@/lib/graph-investigation"
import { money, ROLE_LABELS } from "./graph-presentation"

export function AnalysisInsights({data,onNode}:{data:MoneyGraphData;onNode:(gid:string)=>void}) {
  const [count,setCount] = React.useState(5)
  const impact = React.useMemo(()=>networkResilience(data,count),[data,count])
  const reciprocal = React.useMemo(()=>reciprocalFlows(data),[data])
  const spikes = data.nodes.filter(n=>n.signals?.activity_spike).sort((a,b)=>(b.signals?.peak_day_tx??0)-(a.signals?.peak_day_tx??0))
  const synchronous = data.nodes.filter(n=>(n.signals?.synchronous_payers??0)>=3).sort((a,b)=>(b.signals?.synchronous_payers??0)-(a.signals?.synchronous_payers??0))
  const outliers = data.nodes.filter(n=>n.signals?.turnover_outlier).sort((a,b)=>b.priority_score-a.priority_score)
  const repeated = data.edges.filter(e=>e.n_tx>=2).sort((a,b)=>b.n_tx-a.n_tx)
  const truncated = data.nodes.filter(n=>n.truncated_by_depth).length
  const isolatedSeeds = data.nodes.filter(n=>n.is_seed && n.in_deg===0 && n.out_deg===0).length
  const small = data.nodes.filter(n=>(n.signals?.near_threshold_max_daily??0)>=3)
  function list(nodes:MoneyNode[],describe:(node:MoneyNode)=>string) {
    return <div className="max-h-48 divide-y divide-border overflow-auto">{nodes.slice(0,20).map(node=><button className="flex w-full items-start justify-between gap-3 py-2 text-left text-xs hover:text-primary" key={node.gid} onClick={()=>onNode(node.gid)}><span className="hud-num">{node.gid}<span className="mt-1 block font-sans text-dim">{ROLE_LABELS[node.role]}</span></span><span className="text-right text-sky">{describe(node)}</span></button>)}{!nodes.length&&<p className="py-3 text-xs text-muted-foreground">Узлов с этим сигналом нет.</p>}</div>
  }
  return <div className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader><CardTitle className="text-base">Временные сигналы</CardTitle><p className="text-xs text-muted-foreground">Фактические операции по календарным дням. Списки ограничены первыми 20 узлами каждого типа.</p></CardHeader><CardContent className="space-y-4">
      {!data.nodes.some(n=>n.signals)&&<p className="text-warning">Для этой выгрузки сигналы не рассчитаны. Запустите новый расчёт.</p>}
      <details open><summary className="cursor-pointer text-sm">Синхронные входы · {synchronous.length}</summary><p className="mt-2 text-xs text-dim">Не менее трёх разных плательщиков в один день.</p>{list(synchronous,n=>(n.signals?.synchronous_payers??0)+" плательщиков / "+n.signals?.synchronous_day)}</details>
      <details><summary className="cursor-pointer text-sm">Пики активности · {spikes.length}</summary><p className="mt-2 text-xs text-dim">Максимум ≥5 операций и ≥3× среднего за календарный день периода.</p>{list(spikes,n=>n.signals?.peak_day_tx+" операций / "+n.signals?.peak_day)}</details>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Проверка устойчивости сети</CardTitle><p className="text-xs text-muted-foreground">Что изменится в наблюдаемой структуре, если исключить первые N клиентов из топа?</p></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2">{[1,3,5,10].map(n=><Button key={n} size="sm" variant={count===n?"secondary":"outline"} aria-pressed={count===n} onClick={()=>setCount(n)}>Top {n}</Button>)}</div>
      <div className="grid grid-cols-2 gap-3"><Stat label="Компоненты среди оставшихся" value={impact.componentsBefore+" → "+impact.componentsAfter}/><Stat label="Крупнейшая группа" value={impact.largestBefore+" → "+impact.largestAfter}/><Stat label="Пар потеряло связь" value={money.format(impact.disconnectedPairs)}/><Stat label="Доля потерянных связных пар" value={(impact.disconnectedRatio*100).toFixed(1)+"%"}/></div>
      <p className="text-xs leading-5 text-muted-foreground">Сравниваются те же {impact.remaining} оставшихся узлов; направления игнорируются. Это структурный сценарий без моделирования замещающих переводов и поведения клиентов.</p>
      <details><summary className="cursor-pointer text-xs text-sky">Какие узлы исключены</summary><div className="mt-2 flex flex-wrap gap-2">{impact.removed.map(gid=><button key={gid} className="hud-tag hud-num hover:text-primary" onClick={()=>onNode(gid)}>{gid}</button>)}</div></details>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Встречные и повторные переводы</CardTitle><p className="text-xs text-muted-foreground">Двусторонние связи — структурные циклы длины 2; возврат тех же средств не установлен.</p></CardHeader><CardContent className="space-y-3">
      <p className="text-sm">{reciprocal.length} встречных пар · {repeated.length} направлений с повторными переводами</p>
      <div className="max-h-48 overflow-auto">{reciprocal.slice(0,10).map(pair=><div key={pair.forward.src+pair.forward.dst} className="flex flex-wrap items-center gap-2 border-b border-border py-2 text-xs"><button className="hud-num hover:text-primary" onClick={()=>onNode(pair.forward.src)}>…{pair.forward.src.slice(-8)}</button><span className="text-sky">⇄</span><button className="hud-num hover:text-primary" onClick={()=>onNode(pair.forward.dst)}>…{pair.forward.dst.slice(-8)}</button><span className="hud-num ml-auto">{money.format(pair.amount)} ₸</span></div>)}</div>
      <details><summary className="cursor-pointer text-xs text-sky">Повторные направления · первые {Math.min(10,repeated.length)}</summary>{repeated.slice(0,10).map(e=><button key={e.src+e.dst} className="flex w-full justify-between gap-2 border-b border-border py-2 text-xs hover:text-primary" onClick={()=>onNode(e.src)}><span className="hud-num">…{e.src.slice(-6)} → …{e.dst.slice(-6)}</span><span>{e.n_tx} операций</span></button>)}</details>
      <p className="text-xs text-dim">Устойчивость маршрутов A→B→C во времени и циклы большей длины пока не рассчитаны.</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Отклонения и полнота наблюдения</CardTitle></CardHeader><CardContent className="space-y-3">
      <details open><summary className="cursor-pointer text-sm">Оборот выше нормы своего колена · {outliers.length}</summary><p className="mt-2 text-xs text-dim">Порог Q3 + 1,5×IQR для суммы наблюдаемого входа и выхода; минимум 4 узла в группе. Сигнал требует проверки.</p>{list(outliers,n=>money.format(n.in_kzt+n.out_kzt)+" ₸")}</details>
      <details><summary className="cursor-pointer text-sm">Серии операций 5–10 тыс. ₸ · {small.length}</summary><p className="mt-2 text-xs leading-5 text-muted-foreground">Три и более исходящих за один день. Это наблюдаемая серия, не доказательство дробления; операции ниже 5 000 ₸ отсутствуют.</p>{list(small,n=>(n.signals?.near_threshold_max_daily??0)+" / день")}</details>
      <div className="border-t border-border pt-3 text-xs leading-5 text-warning">{truncated} узлов обрезаны глубиной обхода. {isolatedSeeds} исходных клиентов без наблюдаемых связей. Для проверки нужны полные выписки и продолжение маршрутов за границей выгрузки.</div>
    </CardContent></Card>
  </div>
}
function Stat({label,value}:{label:string;value:string}) {return <div className="border border-border p-3"><p className="text-[10px] text-dim">{label}</p><p className="hud-num mt-2 text-lg text-sky">{value}</p></div>}
