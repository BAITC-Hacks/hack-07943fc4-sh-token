const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export function createAiBudget() {
  let attempts: number[] = []
  return (now = Date.now()) => {
    attempts = attempts.filter(time => now - time < DAY)
    if (attempts.length >= 200 || attempts.filter(time => now - time < HOUR).length >= 30) return false
    attempts.push(now)
    return true
  }
}

// One process / one demo instance. Restarts reset this guard, not provider billing.
const state = globalThis as typeof globalThis & { strataAiBudget?: ReturnType<typeof createAiBudget> }
export const takeAiBudget = state.strataAiBudget ??= createAiBudget()
