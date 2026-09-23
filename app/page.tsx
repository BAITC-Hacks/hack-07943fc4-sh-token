import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-6 text-center">
      <span className="hud-tag"><span className="hud-dot" />Система готова</span>
      <h1 className="hud-caps text-5xl text-foreground sm:text-7xl">ORION</h1>
      <p className="max-w-xl text-muted-foreground">AI-агент для следующего шага.</p>
      <Link className="hud-panel hud-caps px-6 py-3 text-primary transition-colors hover:text-foreground" href="/theme">
        Открыть проверку темы
      </Link>
    </main>
  );
}
