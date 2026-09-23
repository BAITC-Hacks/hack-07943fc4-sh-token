import type { MoneyGraphData, MoneyEdge } from "./graph-types"

/** One shortest observed directed path from any seed. It is not money attribution. */
export function seedPath(graph: MoneyGraphData, target: string): string[] {
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.edges) outgoing.set(edge.src, [...(outgoing.get(edge.src) ?? []), edge.dst])
  const queue = graph.nodes.filter((node) => node.is_seed).map((node) => node.gid).sort()
  const parent = new Map<string, string | null>(queue.map((gid) => [gid, null]))
  for (let index = 0; index < queue.length; index++) {
    const gid = queue[index]
    if (gid === target) {
      const path = [gid]
      let previous = parent.get(gid)
      while (previous) { path.unshift(previous); previous = parent.get(previous) }
      return path
    }
    for (const next of outgoing.get(gid) ?? []) {
      if (!parent.has(next)) { parent.set(next, gid); queue.push(next) }
    }
  }
  return []
}

export function reciprocalFlows(graph: MoneyGraphData) {
  const edges = new Map(graph.edges.map((edge) => [`${edge.src}:${edge.dst}`, edge]))
  return graph.edges.flatMap((edge) => {
    const reverse = edges.get(`${edge.dst}:${edge.src}`)
    return reverse && edge.src < edge.dst ? [{ forward: edge, reverse, amount: edge.sum_kzt + reverse.sum_kzt }] : []
  }).sort((a, b) => b.amount - a.amount)
}

function components(gids: string[], edges: MoneyEdge[]) {
  const allowed = new Set(gids)
  const adjacency = new Map(gids.map((gid) => [gid, new Set<string>()]))
  for (const edge of edges) {
    if (allowed.has(edge.src) && allowed.has(edge.dst)) {
      adjacency.get(edge.src)!.add(edge.dst); adjacency.get(edge.dst)!.add(edge.src)
    }
  }
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const gid of gids) {
    if (seen.has(gid)) continue
    const queue = [gid]; seen.add(gid)
    for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i]) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next) }
    }
    groups.push(queue)
  }
  return groups
}

/** Structural what-if only. Baseline counts the same remaining vertices in original components. */
export function networkResilience(graph: MoneyGraphData, count: number) {
  const removed = graph.topNodes.slice(0, count).map((node) => node.gid)
  const removedSet = new Set(removed)
  const remaining = graph.nodes.filter((node) => !removedSet.has(node.gid)).map((node) => node.gid)
  const before = components(graph.nodes.map((node) => node.gid), graph.edges)
    .map((group) => group.filter((gid) => !removedSet.has(gid))).filter((group) => group.length)
  const after = components(remaining, graph.edges)
  const pairs = (groups: string[][]) => groups.reduce((sum, group) => sum + group.length * (group.length - 1) / 2, 0)
  const beforePairs = pairs(before), afterPairs = pairs(after)
  return {
    removed, remaining: remaining.length,
    componentsBefore: before.length, componentsAfter: after.length,
    largestBefore: Math.max(0, ...before.map((group) => group.length)),
    largestAfter: Math.max(0, ...after.map((group) => group.length)),
    disconnectedPairs: beforePairs - afterPairs,
    disconnectedRatio: beforePairs ? (beforePairs - afterPairs) / beforePairs : 0,
  }
}

export function completenessNotes(node: MoneyGraphData["nodes"][number]) {
  const notes = [{ title: "Полный оборот неизвестен", detail: "В выборке только внутрибанковские переводы от 5 000 ₸ за период. Для проверки нужны полные входящие и исходящие операции." }]
  if (node.truncated_by_depth) notes.unshift({ title: "Граница четвёртого колена", detail: "Продолжение маршрута не выгружено. Запросить исходящие переводы следующего колена; отсутствие выхода не означает остаток на счёте." })
  if (node.is_seed) notes.unshift({ title: "Входящие у исходного клиента неполны", detail: "Запросить полную выписку клиента. Соотношение входа и выхода здесь не отражает баланс счёта." })
  if (!node.in_deg && !node.out_deg) notes.unshift({ title: "Нет наблюдаемых связей", detail: "Проверить период, порог и наличие переводов за пределы банка; отсутствие рёбер не исключает активности." })
  return notes
}

export const ASSISTANT_INTENTS = ["node_summary", "common_recipients", "incoming", "outgoing", "trace_path", "priorities", "completeness", "patterns", "unsupported"] as const
export type AssistantPlan = { intent: typeof ASSISTANT_INTENTS[number]; gids: string[] }
export type AssistantAnswer = { title: string; summary: string; facts: { text: string; gids: string[] }[]; limitations: string[] }
export function validateAssistantPlan(value: unknown, allowed: string[]): AssistantPlan {
  const p = value as AssistantPlan | null
  if (!p || !ASSISTANT_INTENTS.includes(p.intent) || !Array.isArray(p.gids) || p.gids.length > 10 || !p.gids.every(g=>allowed.includes(g))) throw new Error("Модель вернула неподдерживаемый запрос. Уточните вопрос.")
  return { intent: p.intent, gids: [...new Set(p.gids)] }
}

/** All facts are computed locally from this run; model output never becomes financial evidence. */
export function answerGraphQuery(graph: MoneyGraphData, plan: AssistantPlan): AssistantAnswer {
  const nodes = new Map(graph.nodes.map(n=>[n.gid,n]))
  if(plan.gids.some(g=>!nodes.has(g))) throw new Error("Узел отсутствует в текущем расчёте.")
  const node = nodes.get(plan.gids[0])
  const fmt = (n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n)
  const answer: AssistantAnswer = { title:"Ответ по текущей сети", summary:"", facts:[], limitations:["Роли и сигналы — гипотезы для проверки, не доказательство нарушения. Видны только переводы от 5 000 ₸ в пределах выгрузки."] }
  if(plan.intent==="unsupported") { answer.summary="Этот вопрос пока не поддерживается. Спросите о справке узла, входах/выходах, общих получателях, приоритетах, пути от seed, маршрутах или недостающих данных."; return answer }
  if(["node_summary","incoming","outgoing","trace_path","completeness"].includes(plan.intent) && (!node || plan.gids.length!==1)) { answer.summary="Для этого вопроса укажите одного клиента или откройте его на графе.";return answer }
  if(plan.intent==="node_summary" && node) {
    answer.title="Справка по клиенту"; answer.summary=node.evidence
    answer.facts=[{text:`Наблюдаемый вход: ${fmt(node.in_kzt)} ₸ от ${node.in_deg} отправителей. Выход: ${fmt(node.out_kzt)} ₸ к ${node.out_deg} получателям.`,gids:[node.gid]},{text:`Роль: ${node.role}. Показатель роли ${node.role_score.toFixed(3)}; приоритет ${node.priority_score.toFixed(3)}. Связан с ${node.seed_reach} исходными клиентами.`,gids:[node.gid]}]
    answer.limitations.push(...completenessNotes(node).map(n=>n.detail))
  } else if(plan.intent==="common_recipients") {
    if(plan.gids.length<2){answer.summary="Укажите от 2 до 10 GID, чтобы найти их общих прямых получателей.";return answer}
    const matches=graph.nodes.flatMap(n=>{ const edges=plan.gids.map(g=>graph.edges.find(e=>e.src===g&&e.dst===n.gid&&e.src!==e.dst));return edges.every(Boolean)?[{gid:n.gid,amount:edges.reduce((s,e)=>s+e!.sum_kzt,0),count:edges.reduce((s,e)=>s+e!.n_tx,0)}]:[] }).sort((a,b)=>b.amount-a.amount)
    answer.title="Общие прямые получатели";answer.summary=`Найдено ${matches.length} получателей переводов от всех ${plan.gids.length} указанных клиентов. Показаны первые ${Math.min(10,matches.length)} по сумме.`
    answer.facts=matches.slice(0,10).map(n=>({text:`От выбранных отправителей: ${fmt(n.amount)} ₸, ${n.count} операций.`,gids:[n.gid,...plan.gids]}))
  } else if((plan.intent==="incoming"||plan.intent==="outgoing")&&node){
    const incoming=plan.intent==="incoming",edges=graph.edges.filter(e=>incoming?e.dst===node.gid:e.src===node.gid).sort((a,b)=>b.sum_kzt-a.sum_kzt)
    answer.title=incoming?"От кого получает":"Кому переводит";answer.summary=`Выгрузка содержит ${edges.length} направлений; первые ${Math.min(10,edges.length)} по сумме. Самопереводы, если есть, включены.`
    answer.facts=edges.slice(0,10).map(e=>({text:`${e.src} → ${e.dst}: ${fmt(e.sum_kzt)} ₸; ${e.n_tx} операций.`,gids:[...new Set([e.src,e.dst])]}))
  } else if(plan.intent==="trace_path"&&node){
    const path=seedPath(graph,node.gid);answer.title="Путь от исходного клиента";answer.summary=path.length===1?"Выбранный клиент сам является исходным.":path.length?`Один кратчайший наблюдаемый путь: ${path.length-1} переходов.`:"Направленный путь от исходных клиентов не найден."
    answer.facts=path.map((gid,i)=>({text:`Шаг ${i}: ${gid}`,gids:[gid]}));answer.limitations.push("Связность не доказывает прохождение одних и тех же денег; хронология этого пути не проверяется.")
  } else if(plan.intent==="priorities"){
    answer.title="Приоритеты проверки";answer.summary="Первые 10 из рассчитанного топ-листа. Ранжирование не менялось моделью."
    answer.facts=graph.topNodes.slice(0,10).map(n=>({text:`№${n.rank} · ${n.priority_score.toFixed(3)} — ${n.why}`,gids:[n.gid]}))
  } else if(plan.intent==="completeness"&&node){
    answer.title="Что запросить дальше";answer.summary="Рекомендации основаны на ограничениях наблюдения выбранного клиента."
    answer.facts=completenessNotes(node).map(n=>({text:n.title+". "+n.detail,gids:[node.gid]}))
  } else if(plan.intent==="patterns"){
    const p=graph.patterns;answer.title="Повторяющиеся маршруты и циклы"
    if(!p){answer.summary="Маршруты не рассчитаны. Запустите новый анализ.";return answer}
    const chains=p.chains.filter(c=>!plan.gids.length||plan.gids.some(g=>c.gids.includes(g))), cycles=p.cycles.filter(c=>!plan.gids.length||plan.gids.some(g=>c.gids.includes(g)))
    answer.summary=`В сохранённых результатах: ${chains.length} цепочек и ${cycles.length} циклов${plan.gids.length?" с указанными клиентами":""}. Показаны первые 5 каждого типа.`
    answer.facts=[...chains.slice(0,5).map(c=>({text:`Цепочка ${c.gids.join(" → ")}: ${c.occurrences} совпадений, ${c.distinct_days} разных дней начала.`,gids:c.gids})),...cycles.slice(0,5).map(c=>({text:`Цикл ${c.gids.join(" → ")}: ${c.occurrences} хронологических совпадений.`,gids:[...new Set(c.gids)]}))]
    answer.limitations.push(`Между шагами до ${p.max_hop_days} дней. Циклы длиной до ${p.max_cycle_length}. Сохранено до ${p.max_results} результатов каждого типа; поиск ограничен вычислительным бюджетом. Совпадение средств не установлено.`)
  }
  return answer
}
