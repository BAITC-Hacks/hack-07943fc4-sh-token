// Моушн-токены ORION HUD — единственный источник таймингов для Motion (motion/react).
// Совпадают с CSS-переменными --dur-* и --ease-hud в app/globals.css.
export const duration = { fast: 0.15, base: 0.25, slow: 0.45, boot: 0.7 }
export const ease = [0.22, 1, 0.36, 1] as const
export const easeInOut = [0.7, 0, 0.3, 1] as const
export const spring = { type: "spring", stiffness: 380, damping: 32 } as const
export const stagger = 0.09

// Готовые варианты для motion-компонентов
export const bootIn = {
  hidden: { opacity: 0, y: 8, scaleY: 0.97, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, scaleY: 1, filter: "blur(0px)", transition: { duration: duration.boot, ease } },
}
export const staggerParent = { hidden: {}, show: { transition: { staggerChildren: stagger } } }
