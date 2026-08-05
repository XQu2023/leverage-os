import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leverage OS — 每天只做最高杠杆的事",
  description: "从一年目标到每日复盘，把今天的行动变成长期复利。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
