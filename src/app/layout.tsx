import type { Metadata } from "next";
import { Crimson_Pro, Inter } from "next/font/google";

import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chronicle",
  description: "TTRPG session review portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
