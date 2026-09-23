import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { AnalysisError, checkParquet, MAX_FILE_BYTES, PARQUET_FILES, validateUpload } from "../lib/analysis-contract.ts"
import { buildReviewCsv, toggleReviewGid } from "../lib/review-list.ts"
import { getClusterFlows } from "../lib/cluster-flows.ts"

const graph = JSON.parse(readFileSync(new URL("../public/data/graph.json", import.meta.url)))
const files = PARQUET_FILES.map((name) => new File([readFileSync(new URL(`../data/${name}`, import.meta.url))], name))

test("accept actual organizer parquet, reject missing/duplicate/misnamed/oversized files", () => {
  const makeForm = () => { const form = new FormData(); form.set("source", "upload"); files.forEach((file) => form.append(file.name, file)); return form }
  assert.equal(validateUpload(makeForm()).length, 3)
  const missing = makeForm(); missing.delete("nodes.parquet")
  assert.throws(() => validateUpload(missing), AnalysisError)
  const duplicate = makeForm(); duplicate.append("nodes.parquet", files[0])
  assert.throws(() => validateUpload(duplicate), AnalysisError)
  const misnamed = makeForm(); misnamed.set("nodes.parquet", files[1])
  assert.throws(() => validateUpload(misnamed), AnalysisError)
  const oversized = makeForm(); oversized.set("nodes.parquet", new File([new Uint8Array(MAX_FILE_BYTES + 1)], "nodes.parquet"))
  assert.throws(() => validateUpload(oversized), (error) => error.status === 413)
  assert.throws(() => checkParquet(new TextEncoder().encode("not a parquet file"), "nodes.parquet"), AnalysisError)
  for (const name of PARQUET_FILES) checkParquet(readFileSync(new URL(`../data/${name}`, import.meta.url)), name)
})

test("review selection adds once and removes without touching graph or scores", () => {
  const before = JSON.stringify(graph)
  const first = graph.nodes[0].gid, second = graph.nodes[1].gid
  let selected = toggleReviewGid([], first)
  selected = toggleReviewGid(selected, second)
  assert.deepEqual(selected, [first, second])
  selected = toggleReviewGid(selected, first)
  assert.deepEqual(selected, [second])
  assert.equal(JSON.stringify(graph), before)
})

test("CSV exports only selected rows, full string GIDs, exact scores, provenance and escaped text", () => {
  const chosen = [graph.nodes[0], graph.nodes.at(-1)]
  const run = { id: "test-run", source: "upload", completedAt: "test-completion" }
  const csv = buildReviewCsv(chosen, graph, run)
  assert.ok(csv.startsWith("\uFEFF\"gid\""))
  assert.equal(csv.trim().split("\r\n").length, chosen.length + 1)
  for (const node of chosen) {
    assert.ok(csv.includes(`"${node.gid}"`))
    assert.ok(csv.includes(`"${node.priority_score}"`))
    assert.ok(csv.includes(`"${node.in_kzt}"`))
  }
  assert.ok(!csv.includes(graph.nodes[1].gid))
  assert.ok(csv.includes('"test-run"'))
  const hostile = { ...chosen[0], evidence: '=SUM(1,2)\n"quote"' }
  assert.ok(buildReviewCsv([hostile], graph, run).includes('"\'=SUM(1,2)\n""quote"""'))
})

test("cluster overview preserves flow direction and reconciles cross-cluster amounts", () => {
  const cluster = new Map(graph.nodes.map((node) => [node.gid, node.cluster_id]))
  const edges = graph.edges.filter((edge) => cluster.get(edge.src) !== cluster.get(edge.dst))
  const flows = getClusterFlows(graph)
  assert.equal(flows.reduce((sum, flow) => sum + flow.n_tx, 0), edges.reduce((sum, edge) => sum + edge.n_tx, 0))
  assert.ok(Math.abs(flows.reduce((sum, flow) => sum + flow.sum_kzt, 0) - edges.reduce((sum, edge) => sum + edge.sum_kzt, 0)) < 0.01)
  for (const flow of flows) {
    const expected = edges.filter((edge) => cluster.get(edge.src) === flow.src && cluster.get(edge.dst) === flow.dst)
    assert.equal(flow.n_tx, expected.reduce((sum, edge) => sum + edge.n_tx, 0))
    assert.ok(Math.abs(flow.sum_kzt - expected.reduce((sum, edge) => sum + edge.sum_kzt, 0)) < 0.01)
  }
})
