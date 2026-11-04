import type { Metadata } from "next";
import "./globals.css";
import { HelpProvider } from "./radar-help";

export const metadata: Metadata = {
  title: "upGrad Radar — Competitor Research",
  description: "A source-linked competitive research brief for learning programs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><HelpProvider>{children}</HelpProvider></body></html>;
}
