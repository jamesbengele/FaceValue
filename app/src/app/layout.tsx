import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import { Inter, Inter_Tight } from "next/font/google";

// One family: Inter for text, Inter Tight for headings.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = { title: "FaceValue", description: "Student tickets that can never be resold above face value.", icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-180.png" }, appleWebApp: { capable: true, title: "FaceValue", statusBarStyle: "black-translucent" } };

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(!t)t="light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}` }} /></head>
      <body className="min-h-screen antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
