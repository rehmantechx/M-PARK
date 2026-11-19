import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "M-Park Dashboard",
  description: "M-Park backend dashboard: Customer Dashboard and Admin Dashboard, login, and backend APIs for QR sticker orders, scans, calls, and alerts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
