"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DecodeText, CountUp, stagger } from "@/components/hud/hud-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const agentStates = ["idle", "working", "waiting", "done", "error"] as const;

export default function ThemePage() {
  const [agentState, setAgentState] = useState<(typeof agentStates)[number]>("working");

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-8 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <span className="hud-tag"><span className="hud-dot" />Тема / диагностика</span>
          <h1 className="hud-caps mt-4 text-4xl text-foreground"><DecodeText text="ORION HUD v2" /></h1>
        </div>
        <span className="hud-num text-sm text-muted-foreground">SYS.2026.09.23</span>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[{ label: "Сигнал", value: 98, suffix: "%" }, { label: "Узлы", value: 24 }, { label: "Задержка", value: 42, suffix: " ms" }].map((metric, i) => (
          <Card key={metric.label} style={stagger(i)}>
            <CardHeader><CardTitle className="hud-caps text-xs text-muted-foreground">{metric.label}</CardTitle></CardHeader>
            <CardContent><div className="hud-num text-4xl text-sky"><CountUp to={metric.value} suffix={metric.suffix} /></div></CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="hud-caps">Компоненты управления</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Button>Действие</Button><Button variant="outline">Контур</Button><Button variant="secondary">Вторичное</Button><Button variant="ghost">Призрак</Button><Button variant="destructive">Ошибка</Button><Button variant="link">Ссылка</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button data-tone="sky">Норма</Button><Button data-loading>Выполняется</Button>
              <Badge>Структура</Badge><Badge data-tone="sky">Норма</Badge><Badge data-tone="warning">Внимание</Badge><Badge data-tone="danger">Критично</Badge>
            </div>
            <Separator />
            <Tabs defaultValue="overview">
              <TabsList variant="line"><TabsTrigger value="overview">Обзор</TabsTrigger><TabsTrigger value="log">Журнал</TabsTrigger></TabsList>
              <TabsContent value="overview" className="pt-4 text-muted-foreground">Система работает штатно.</TabsContent>
              <TabsContent value="log" className="pt-4 font-mono text-xs text-muted-foreground">[09:23:41] handshake complete</TabsContent>
            </Tabs>
            <Progress value={72} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="hud-caps">Агент</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div data-agent={agentState} className="hud-panel p-5">
              <div className="flex items-center justify-between"><span className="hud-caps text-xs">Состояние</span><Badge data-tone={agentState === "error" ? "danger" : agentState === "waiting" ? "warning" : "sky"}>{agentState}</Badge></div>
              <p className="mt-4 text-sm text-muted-foreground">Переключите режим и проверьте визуальный отклик.</p>
            </div>
            <div className="flex flex-wrap gap-2">{agentStates.map((state) => <Button key={state} variant="outline" size="sm" onClick={() => setAgentState(state)}>{state}</Button>)}</div>
            <Dialog>
              <DialogTrigger render={<Button className="w-full" />}>Подтвердить действие</DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Подтвердить действие</DialogTitle><DialogDescription>ORION запустит проверку подключённых узлов.</DialogDescription></DialogHeader>
                <DialogFooter><Button onClick={() => toast.success("Проверка запущена")}>Подтвердить</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="hud-caps">Состояние узлов</CardTitle></CardHeader>
          <CardContent><Table><TableHeader><TableRow><TableHead>Узел</TableHead><TableHead>Статус</TableHead><TableHead>Время</TableHead></TableRow></TableHeader><TableBody>{[["CORE-01", "Норма", "12 ms"], ["DATA-07", "Внимание", "84 ms"], ["EDGE-12", "Норма", "19 ms"]].map(([node, status, time]) => <TableRow key={node}><TableCell className="font-mono">{node}</TableCell><TableCell>{status}</TableCell><TableCell className="font-mono text-muted-foreground">{time}</TableCell></TableRow>)}</TableBody></Table></CardContent>
        </Card>
        <Alert><AlertTitle className="hud-caps">Сигнал системы</AlertTitle><AlertDescription>Все базовые компоненты ORION HUD загружены и готовы к основному сценарию.</AlertDescription></Alert>
      </section>
    </main>
  );
}
