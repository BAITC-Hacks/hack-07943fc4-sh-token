import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { answerGraphQuery, validateAssistantPlan } from '../lib/graph-investigation.ts'
import { parseMoneyGraph } from '../lib/graph-data.ts'
import { saveAnalysis, getAnalysis } from '../lib/server/analysis-store.ts'
import { sameOrigin, boundedJson } from '../lib/server/request-guard.ts'
const graph=JSON.parse(readFileSync(new URL('../public/data/graph.json',import.meta.url)))
test('assistant answers preserve source values and citations for every supported intent',()=>{
  const gid=graph.topNodes[0].gid,known=new Set(graph.nodes.map(n=>n.gid))
  for(const intent of ['node_summary','incoming','outgoing','trace_path','priorities','completeness','patterns','unsupported']){
    const answer=answerGraphQuery(graph,{intent,gids:[gid]})
    assert.ok(answer.summary)
    assert.ok(answer.facts.every(f=>f.gids.every(g=>known.has(g))))
    assert.ok(answer.limitations.length)
  }
  assert.equal(answerGraphQuery(graph,{intent:'node_summary',gids:[gid]}).summary,graph.nodes.find(n=>n.gid===gid).evidence)
  assert.throws(()=>validateAssistantPlan({intent:'node_summary',gids:['unknown']},[gid]))
  assert.throws(()=>validateAssistantPlan({intent:'assign_role',gids:[gid]},[gid]))
  assert.throws(()=>answerGraphQuery(graph,{intent:'node_summary',gids:['unknown']}))
})
test('common recipients requires intersection, not union, and totals only requested sources',()=>{
  const target=graph.nodes.find(n=>graph.edges.filter(e=>e.dst===n.gid&&e.src!==e.dst).length>=2)
  const sources=graph.edges.filter(e=>e.dst===target.gid&&e.src!==e.dst).slice(0,2).map(e=>e.src)
  const answer=answerGraphQuery(graph,{intent:'common_recipients',gids:sources})
  assert.ok(answer.facts.length)
  for(const f of answer.facts)assert.ok(sources.every(src=>graph.edges.some(e=>e.src===src&&e.dst===f.gids[0])))
  assert.equal(answerGraphQuery(graph,{intent:'common_recipients',gids:[sources[0]]}).facts.length,0)
})
test('optional routes are validated, including referenced GID and dates',()=>{
  assert.equal(parseMoneyGraph(graph),graph)
  const bad=structuredClone(graph);bad.patterns.chains[0].gids[0]='invalid';assert.throws(()=>parseMoneyGraph(bad))
  const dates=structuredClone(graph);dates.patterns.chains[0].examples[0]=['2026-07-01'];assert.throws(()=>parseMoneyGraph(dates))
})
test('run store expires, evicts old runs and keeps matching CSVs',()=>{
  const csv={'nodes_roles.csv':'nodes','clusters.csv':'clusters','top_nodes.csv':'top'}
  for(let i=0;i<5;i++)saveAnalysis({graph,run:{id:'test-'+i}},csv,1000)
  assert.equal(getAnalysis('test-0',1001),undefined)
  assert.equal(getAnalysis('test-4',1001).exports['top_nodes.csv'],'top')
  assert.equal(getAnalysis('test-4',3601001),undefined)
})
test('same-origin guard and streaming body cap',async()=>{
  assert.ok(sameOrigin(new Request('http://localhost:3000',{headers:{host:'localhost:3000',origin:'http://localhost:3000'}})))
  assert.equal(sameOrigin(new Request('http://localhost:3000',{headers:{host:'localhost:3000',origin:'https://evil.invalid'}})),false)
  assert.equal(sameOrigin(new Request('http://localhost:3000',{headers:{'sec-fetch-site':'cross-site'}})),false)
  assert.deepEqual(await boundedJson(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:'{"ok":true}'})),{ok:true})
  await assert.rejects(()=>boundedJson(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(200)}),100))
})
