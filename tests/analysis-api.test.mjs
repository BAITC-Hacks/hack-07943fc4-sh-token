import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import test from "node:test"

const base = process.env.ORION_TEST_URL || "http://127.0.0.1:3000"
const names = ["nodes.parquet", "edges.parquet", "transactions.parquet"]
const bytes = Object.fromEntries(names.map((name) => [name, readFileSync(new URL(`../data/${name}`, import.meta.url))]))
const fingerprint = () => names.map((name) => createHash("sha256").update(readFileSync(new URL(`../data/${name}`, import.meta.url))).digest("hex"))
const saved = () => createHash("sha256").update(readFileSync(new URL("../public/data/graph.json", import.meta.url))).digest("hex")
const post = (form, headers) => fetch(`${base}/api/analysis`, { method: "POST", body: form, headers })
function upload() { const form = new FormData(); form.set("source", "upload"); for (const name of names) form.append(name, new File([bytes[name]], name)); return form }

test("real API: organizer case equals uploaded parquet; errors never return a mock result", async () => {
  const before = fingerprint(), previous = saved()
  const preloaded = new FormData(); preloaded.set("source", "organizers")
  const first = await post(preloaded)
  const a = await first.json()
  assert.equal(first.status, 200, JSON.stringify(a))
  const second = await post(upload())
  const b = await second.json()
  assert.equal(second.status, 200, JSON.stringify(b))
  assert.deepEqual(a.graph, b.graph)
  assert.notEqual(a.run.id, b.run.id)
  assert.equal(b.run.source, "upload")
  assert.equal(a.run.seedCount, a.graph.nodes.filter((node) => node.is_seed).length)
  assert.ok(a.run.seedCount > 0)
  assert.ok(a.run.elapsedSeconds > 0)
  assert.ok(a.graph.nodes.every((node) => typeof node.gid === "string" && /^\d{18}$/.test(node.gid)))
  for(const name of ['nodes_roles.csv','clusters.csv','top_nodes.csv']){
    const download=await fetch(`${base}/api/analysis/${a.run.id}/${name}`)
    assert.equal(download.status,200)
    assert.equal(download.headers.get('cache-control'),'no-store')
    assert.equal(await download.text(),readFileSync(new URL(`../out/${name}`,import.meta.url),'utf8'))
  }
  assert.equal((await fetch(`${base}/api/analysis/missing/top_nodes.csv`)).status,410)
  assert.equal((await fetch(`${base}/api/analysis/${a.run.id}/unknown.csv`)).status,404)
  const ask=(body,headers={})=>fetch(`${base}/api/assistant`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})
  const question={runId:a.run.id,question:'Справка',focusGid:a.graph.topNodes[0].gid,selectedGids:[]}
  assert.equal((await ask({...question,question:''})).status,400)
  assert.equal((await ask({...question,runId:'missing'})).status,410)
  assert.equal((await ask({...question,focusGid:'unknown'})).status,400)
  assert.equal((await ask({...question,question:'x'.repeat(1201)})).status,400)
  assert.equal((await ask(question,{Origin:'https://unrelated.invalid'})).status,403)
  const missing = upload(); missing.delete("nodes.parquet")
  assert.equal((await post(missing)).status, 400)
  const invalid = upload(); invalid.set("nodes.parquet", new File(["not parquet"], "nodes.parquet"))
  const badResponse = await post(invalid), bad = await badResponse.json()
  assert.equal(badResponse.status, 400)
  assert.ok(bad.error && bad.action && !bad.graph)
  const wrongSchema = upload(); wrongSchema.set("nodes.parquet", new File([bytes["edges.parquet"]], "nodes.parquet"))
  const rejected = await post(wrongSchema), reason = await rejected.json()
  assert.equal(rejected.status, 422, JSON.stringify(reason))
  assert.match(reason.error, /misses columns/)
  assert.ok(!reason.graph)
  assert.equal((await post(upload(), { Origin: "https://unrelated.invalid" })).status, 403)
  assert.equal((await post(upload(), { Origin: "null" })).status, 403)
  const concurrent = await Promise.all([post(preloaded), post(preloaded)])
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409])
  assert.deepEqual(fingerprint(), before)
  assert.equal(saved(), previous)
})
