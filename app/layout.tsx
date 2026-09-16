import "./globals.css";
import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import { RegisterSW } from "@/components/RegisterSW";
import { Analytics } from "@vercel/analytics/react";
import { AppSplashScreen } from "@/components/AppSplashScreen";

export const metadata: Metadata = {
  title: "ระบบจัดการคำนวนภาษี",
  description: "ระบบบริหารจัดการทรัพย์สินที่ดินและสิ่งปลูกสร้าง ระบบจัดการคำนวนภาษี",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ระบบจัดการคำนวนภาษี",
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
          <AppSplashScreen />
          {children}
          <RegisterSW />
          <Analytics />
        </I18nProvider>
      </body>
    </html>
  );
}
