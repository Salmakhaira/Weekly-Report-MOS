import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Report Monitoring",
  description: "Weekly sales branch reporting and national monitoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
