import "./globals.css";
import type { Metadata } from "next";
import Providers from "@/components/Providers";

export const metadata: Metadata = { title: "FaceValue", description: "Student tickets that can never be resold above face value." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
