import "./globals.css";
import type { Metadata, Viewport } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = { title: "FaceValue", description: "Student tickets that can never be resold above face value.", appleWebApp: { capable: true, title: "FaceValue", statusBarStyle: "black-translucent" } };

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0a12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
