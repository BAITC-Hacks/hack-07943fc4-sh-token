import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { filterTopNodes, indexMoneyGraph, isGid, MONEY_ROLES, parseMoneyGraph } from "../lib/graph-data.ts"

const source = JSON.parse(readFileSync(new URL("../public/data/graph.json", import.meta.url), "utf8"))

test("real pipeline export validates without changing values or GID strings", () => {
  const before = JSON.stringify(source)
  const data = parseMoneyGraph(source)
  assert.equal(data, source)
  assert.equal(JSON.stringify(data), before)
  assert.ok(data.nodes.every((node) => isGid(node.gid)))
  assert.ok(data.nodes.length > 0)
})

test("GID matching accepts exactly 18 digits, never numbers or substrings", () => {
  assert.ok(isGid(source.nodes[0].gid))
  assert.equal(isGid(Number(source.nodes[0].gid)), false)
  assert.equal(isGid(source.nodes[0].gid.slice(1)), false)
  assert.equal(isGid(` ${source.nodes[0].gid}`), false)
})

test("index covers every cluster, orders members by saved priority, does not mutate data", () => {
  const before = JSON.stringify(source)
  const { nodesById, membersByCluster } = indexMoneyGraph(source)
  assert.equal(nodesById.size, source.nodes.length)
  for (const cluster of source.clusters) {
    const members = membersByCluster.get(cluster.cluster_id)
    assert.equal(members.length, cluster.n_nodes)
    assert.equal(members.filter((node) => node.is_seed).length, cluster.n_seed)
    assert.ok(members.every((node, index) => !index || node.priority_score <= members[index - 1].priority_score))
  }
  assert.equal(JSON.stringify(source), before)
})

test("role + cluster filters intersect across the full top, preserving ranks and scores", () => {
  const { nodesById } = indexMoneyGraph(source)
  assert.deepEqual(filterTopNodes(source, nodesById, "all", "all"), source.topNodes)
  for (const role of MONEY_ROLES) {
    for (const cluster of source.clusters) {
      const actual = filterTopNodes(source, nodesById, role, cluster.cluster_id)
      assert.deepEqual(actual, source.topNodes.filter((node) => node.role === role && nodesById.get(node.gid).cluster_id === cluster.cluster_id))
      actual.forEach((node) => assert.equal(node, source.topNodes.find((saved) => saved.gid === node.gid)))
    }
  }
  const late = source.topNodes.at(-1)
  assert.ok(filterTopNodes(source, nodesById, late.role, "all").includes(late))
  assert.deepEqual(filterTopNodes(source, nodesById, "all", -1), [])
})

test("valid empty results stay empty and never become demo data", () => {
  const data = { meta: { ...source.meta, nodes: 0, edges: 0, transactions: 0, turnoverKzt: 0, roleCounts: Object.fromEntries(MONEY_ROLES.map((role) => [role, 0])) }, nodes: [], edges: [], clusters: [], topNodes: [] }
  assert.equal(parseMoneyGraph(data), data)
  assert.equal(indexMoneyGraph(data).nodesById.size, 0)
})

test("malformed results fail with a useful recovery command", () => {
  for (const value of [null, {}, { ...source, nodes: null }, { ...source, meta: {} }]) {
    assert.throws(() => parseMoneyGraph(value), /npm run analyze/)
  }
  for (const mutate of [
    (data) => { data.nodes[0].gid = Number(data.nodes[0].gid) },
    (data) => { data.nodes[0].role = "invented" },
    (data) => { data.nodes[0].priority_score = 2 },
    (data) => { data.edges[0].src = "missing" },
    (data) => { data.nodes[0].cluster_id = -1 },
    (data) => { data.nodes[0].signals = { activity_spike: "yes" } },
  ]) {
    const data = structuredClone(source)
    mutate(data)
    assert.throws(() => parseMoneyGraph(data), /npm run analyze/)
  }
})
