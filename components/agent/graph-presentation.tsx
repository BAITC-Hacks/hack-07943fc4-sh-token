import { Badge } from "@/components/ui/badge"
import type { MoneyRole } from "@/lib/graph-types"

export const ROLE_LABELS: Record<MoneyRole, string> = {
  consolidator: "Консолидация",
  transit: "Транзит",
  distributor: "Распределение",
  terminal: "Получатель",
  coordinator: "Координация",
  peripheral: "Периферия",
}

export const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 })
export const score = (value: number) => value.toFixed(3)
export const clusterLabel = (id: number) => `Кластер ${String(id).padStart(2, "0")}`

export function RoleBadge({ role }: { role: MoneyRole }) {
  const tones: Record<MoneyRole, string> = {
    coordinator: "danger", consolidator: "primary", distributor: "warning",
    transit: "sky", terminal: "foreground", peripheral: "dim",
  }
  return <Badge variant="outline" data-tone={tones[role]}>{ROLE_LABELS[role]}</Badge>
}

export function roleStroke(role?: MoneyRole) {
  if (role === "coordinator") return "stroke-destructive"
  if (role === "consolidator") return "stroke-primary"
  if (role === "distributor") return "stroke-warning"
  if (role === "transit") return "stroke-sky"
  if (role === "peripheral") return "stroke-dim"
  return "stroke-foreground"
}

export const roleBar: Record<MoneyRole, string> = {
  coordinator: "bg-destructive", consolidator: "bg-primary", distributor: "bg-warning",
  transit: "bg-sky", terminal: "bg-foreground", peripheral: "bg-dim",
}
