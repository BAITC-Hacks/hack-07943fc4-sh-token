import type { Metadata } from "next";
import { Martian_Mono, Tektur } from "next/font/google";
import { Toaster } from "sonner";
import { HudBackground } from "@/components/hud/hud-background";
import "./globals.css";

const tektur = Tektur({
  variable: "--font-tektur",
  subsets: ["latin", "cyrillic"],
});

const martian = Martian_Mono({
  variable: "--font-martian-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "STRATA — Financial Intelligence",
  description: "Объяснимый анализ транзакционной сети для AML-аналитика",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`dark ${tektur.variable} ${martian.variable} h-full`}>
      <body className="min-h-full">
        <HudBackground />
        <div className="relative z-10 min-h-full">{children}</div>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
