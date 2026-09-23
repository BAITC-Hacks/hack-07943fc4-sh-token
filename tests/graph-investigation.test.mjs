import test from 'node:test'
import assert from 'node:assert/strict'
import { seedPath, reciprocalFlows, networkResilience } from '../lib/graph-investigation.ts'

const edge = (src, dst) => ({ src, dst, sum_kzt: 10, n_tx: 2, depth: 1 })
const graph = {
  nodes: ['a', 'b', 'c', 'z'].map(gid => ({ gid, is_seed: gid === 'a' })),
  edges: [edge('a','b'), edge('b','c'), edge('c','b')],
  topNodes: [{ gid: 'b' }],
}
test('seed path follows direction, retains seed and handles disconnected target', () => {
  assert.deepEqual(seedPath(graph, 'c'), ['a','b','c'])
  assert.deepEqual(seedPath(graph, 'a'), ['a'])
  assert.deepEqual(seedPath(graph, 'z'), [])
  assert.deepEqual(seedPath({ ...graph, edges: [edge('b','a')] }, 'b'), [])
})
test('reciprocal pairs counted once and preserve amounts', () => {
  assert.equal(reciprocalFlows(graph).length, 1)
  assert.equal(reciprocalFlows(graph)[0].amount, 20)
})
test('resilience excludes removed vertices from baseline and detects fragmentation', () => {
  const result = networkResilience(graph, 1)
  assert.equal(result.remaining, 3)
  assert.equal(result.componentsBefore, 2)
  assert.equal(result.componentsAfter, 3)
  assert.equal(result.disconnectedPairs, 1)
  assert.equal(result.disconnectedRatio, 1)
  const leaf = networkResilience({ ...graph, topNodes: [{ gid: 'c' }] }, 1)
  assert.equal(leaf.disconnectedPairs, 0)
  assert.equal(networkResilience(graph, 0).disconnectedRatio, 0)
})
