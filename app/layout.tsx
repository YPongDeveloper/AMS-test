import "./globals.css";
import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "SRT Asset Management",
  description: "ระบบบริหารจัดการทรัพย์สินที่ดินและสิ่งปลูกสร้าง การรถไฟแห่งประเทศไทย",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SRT Asset",
  },
  icons: {
    icon: [{ url: "/icon-192.png" }, { url: "/icon-512.png" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f2052",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen antialiased">
        <I18nProvider>
          {children}
          <RegisterSW />
        </I18nProvider>
      </body>
    </html>
  );
}
