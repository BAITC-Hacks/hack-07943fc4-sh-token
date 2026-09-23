import { spawnSync } from "node:child_process"

// No secret values in logs. Refuse an accidentally unprotected public deployment.
if (!process.env.DEMO_AUTH_USER || process.env.DEMO_AUTH_USER.includes(":") || (process.env.DEMO_AUTH_PASSWORD?.length ?? 0) < 16) {
  console.error("Configure DEMO_AUTH_USER (no colon) and DEMO_AUTH_PASSWORD (at least 16 characters) in hosting secrets.")
  process.exit(1)
}
const python = spawnSync(process.env.ORION_PYTHON, ["-c", "import pandas, pyarrow, numpy, scipy, networkx, money_graph"], { stdio: "ignore" })
if (python.status !== 0) {
  console.error("Pipeline runtime preflight failed. Rebuild the container from the committed lockfile.")
  process.exit(1)
}
await import("../server.js")
