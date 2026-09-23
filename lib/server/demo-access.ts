import { createHash, timingSafeEqual } from "node:crypto"

type DemoEnvironment = Record<string, string | undefined>

export function demoAccessConfigured(env: DemoEnvironment = process.env) {
  return !!env.DEMO_AUTH_USER && !env.DEMO_AUTH_USER.includes(":") && (env.DEMO_AUTH_PASSWORD?.length ?? 0) >= 16
}

export function demoAccessRequired(env: DemoEnvironment = process.env) {
  return env.STRATA_PUBLIC_DEMO === "true" || env.RENDER === "true" || !!env.DEMO_AUTH_USER || !!env.DEMO_AUTH_PASSWORD
}

/** Small shared jury gate, not multi-user bank authentication. Never cache protected responses. */
export function checkDemoAccess(request: Request, env: DemoEnvironment = process.env): Response | null {
  if (!demoAccessRequired(env)) return null
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }
  if (!demoAccessConfigured(env)) return Response.json({ error: "Доступ к демо ещё не настроен владельцем сервера." }, { status: 503, headers })
  const authorization = request.headers.get("authorization") ?? ""
  const encoded = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(authorization)?.[1]
  const supplied = encoded && encoded.length <= 4096 ? Buffer.from(encoded, "base64").toString("utf8") : ""
  const digest = (value: string) => createHash("sha256").update(value).digest()
  if (timingSafeEqual(digest(supplied), digest(`${env.DEMO_AUTH_USER}:${env.DEMO_AUTH_PASSWORD}`))) return null
  return Response.json({ error: "Введите логин и пароль демо, выданные командой." }, {
    status: 401, headers: { ...headers, "WWW-Authenticate": 'Basic realm="STRATA jury demo", charset="UTF-8"' },
  })
}
