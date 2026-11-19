import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";
import { Bricolage_Grotesque } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = { title: "FaceValue", description: "Student tickets that can never be resold above face value.", icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-180.png" }, appleWebApp: { capable: true, title: "FaceValue", statusBarStyle: "black-translucent" } };

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0a12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={display.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(!t)t="light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}` }} /></head>
      <body className="min-h-screen antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
