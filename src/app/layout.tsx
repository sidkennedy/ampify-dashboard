import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ampify – Eligibility Dashboard",
  description: "AI-powered insurance eligibility verification for audiology practices",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
