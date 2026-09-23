import assert from "node:assert/strict"
import test from "node:test"
import { checkDemoAccess } from "../lib/server/demo-access.ts"
import { createAiBudget } from "../lib/server/ai-budget.ts"

const credentials = { STRATA_PUBLIC_DEMO: "true", DEMO_AUTH_USER: "jury", DEMO_AUTH_PASSWORD: "test-password-not-a-secret" }
const request = (value) => new Request("http://localhost/api/assistant", { headers: value ? { authorization: value } : {} })
const auth = (value) => `Basic ${Buffer.from(value).toString("base64")}`

test("local use stays open; public/misconfigured demos fail closed", () => {
  assert.equal(checkDemoAccess(request(), {}), null)
  for (const env of [{ STRATA_PUBLIC_DEMO: "true" }, { RENDER: "true" }, { DEMO_AUTH_USER: "jury" }, { ...credentials, DEMO_AUTH_PASSWORD: "short" }, { ...credentials, DEMO_AUTH_USER: "bad:name" }]) {
    assert.equal(checkDemoAccess(request(), env).status, 503)
  }
})

test("jury auth rejects invalid credentials and accepts exact configured credentials", () => {
  for (const value of [undefined, "Bearer fake", "Basic %%%", auth("jury:wrong"), auth("other:test-password-not-a-secret")]) {
    const response = checkDemoAccess(request(value), credentials)
    assert.equal(response.status, 401)
    assert.match(response.headers.get("www-authenticate"), /Basic/)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
  }
  assert.equal(checkDemoAccess(request(auth("jury:test-password-not-a-secret")), credentials), null)
})

test("AI budget caps hourly and daily attempts and expires old attempts", () => {
  const hour = 3_600_000, budget = createAiBudget()
  for (let i = 0; i < 30; i++) assert.equal(budget(0), true)
  assert.equal(budget(1), false)
  for (let h = 1; h <= 5; h++) for (let i = 0; i < 30; i++) assert.equal(budget(h * hour), true)
  for (let i = 0; i < 20; i++) assert.equal(budget(6 * hour), true)
  assert.equal(budget(7 * hour), false)
  assert.equal(budget(24 * hour), true)
})
