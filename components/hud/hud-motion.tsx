"use client"
/* ORION HUD — хуки и компоненты моушна. Кладётся в components/hud/hud-motion.tsx */
import * as React from "react"

const POOL = "АБВГДЕЖЗИКЛМНОПРСТУФХЭЮЯ0123456789<>/#%"
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Расшифровка текста из случайных символов. Меняется text → расшифровывается заново. */
export function useDecode(text: string, { duration = 700, delay = 0 } = {}) {
  const still = reduced()
  const [out, setOut] = React.useState("")
  React.useEffect(() => {
    if (still) return
    let raf = 0
    const t = window.setTimeout(() => {
      const s0 = performance.now(), L = text.length
      const f = (n: number) => {
        const p = Math.min((n - s0) / duration, 1), k = Math.floor(p * L)
        let o = text.slice(0, k)
        for (let i = k; i < Math.min(L, k + 8); i++) o += text[i] === " " ? " " : POOL[(Math.random() * POOL.length) | 0]
        setOut(p < 1 ? o : text)
        if (p < 1) raf = requestAnimationFrame(f)
      }
      raf = requestAnimationFrame(f)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [text, duration, delay, still])
  return still ? text : out
}

type DecodeProps = { text: string; as?: React.ElementType; duration?: number; delay?: number } & React.HTMLAttributes<HTMLElement>
export function DecodeText({ text, as: Tag = "span", duration, delay, ...rest }: DecodeProps) {
  const v = useDecode(text, { duration, delay })
  return <Tag aria-label={text} {...rest}>{v || "\u00a0"}</Tag>
}

/** Накрутка числа с замедлением. Формат ru-RU, запятая для дробей. */
export function useCountUp(to: number, { duration = 1300, decimals = 0, delay = 0 } = {}) {
  const still = reduced()
  const [v, setV] = React.useState(0)
  const from = React.useRef(0)
  React.useEffect(() => {
    if (still) return
    let raf = 0
    const start = from.current
    const t = window.setTimeout(() => {
      const s0 = performance.now()
      const f = (n: number) => {
        const p = Math.min((n - s0) / duration, 1), e = 1 - Math.pow(1 - p, 4)
        const val = start + (to - start) * e
        setV(val); from.current = val
        if (p < 1) raf = requestAnimationFrame(f)
      }
      raf = requestAnimationFrame(f)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [to, duration, delay, still])
  return (still ? to : v).toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function CountUp({ to, decimals = 0, suffix = "", duration, delay, className }: { to: number; decimals?: number; suffix?: string; duration?: number; delay?: number; className?: string }) {
  const v = useCountUp(to, { decimals, duration, delay })
  return <span className={"hud-num " + (className ?? "")}>{v}{suffix}</span>
}

/** Печать строки по символам с кареткой (для журнала агента). */
export function TypeLine({ text, speed = 14, className }: { text: string; speed?: number; className?: string }) {
  const still = reduced()
  const [st, setSt] = React.useState({ t: text, n: 0 })
  const n = still ? text.length : st.t === text ? st.n : 0
  React.useEffect(() => {
    if (still) return
    const iv = window.setInterval(() => setSt(prev => {
      const base = prev.t === text ? prev.n : 0
      const next = Math.min(text.length, base + 2)
      if (next >= text.length) clearInterval(iv)
      return { t: text, n: next }
    }), speed)
    return () => clearInterval(iv)
  }, [text, speed, still])
  return <span className={(n < text.length ? "hud-caret " : "") + (className ?? "")}>{text.slice(0, n)}</span>
}

/** Вспышка при изменении значения: вернёт "hud-flash-up" / "hud-flash-down" на 600 мс. */
export function useFlash(value: number) {
  const prev = React.useRef(value)
  const [cls, setCls] = React.useState("")
  React.useEffect(() => {
    if (value === prev.current) return
    setCls(value > prev.current ? "hud-flash-up" : "hud-flash-down")
    prev.current = value
    const t = window.setTimeout(() => setCls(""), 600)
    return () => clearTimeout(t)
  }, [value])
  return cls
}

/** Порядок в каскаде: <Card style={stagger(2)}> */
export const stagger = (i: number) => ({ "--i": i } as React.CSSProperties)
