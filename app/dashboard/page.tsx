"use client";

import { useEffect, useState } from "react";
import { Page } from "@/components/Page";
import { Card, Tag } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { api, API_CONFIGURED, getAccessToken } from "@/lib/api";
import {
  MapPin, Building2, CircleDollarSign, Database,
  ArrowRight, ArrowUpRight, ArrowDownRight, Plus, FileText,
  Calendar, AlertCircle,
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const { t, lang } = useI18n();

  // เนื้อหาจากหลังบ้าน (mock data) — ถ้าไม่ได้เชื่อม API ใช้ค่าเริ่มต้นด้านล่าง
  const [content, setContent] = useState<any>(null);
  useEffect(() => {
    if (!API_CONFIGURED || !getAccessToken()) return;
    api<any>("/api/dashboard")
      .then((d) => d && Object.keys(d).length > 0 && setContent(d))
      .catch(() => {});
  }, []);

  const fallbackStats = [
    { key: "parcels", value: "1,284", sub: "+12 this month", delta: "+0.94%", up: true, chart: [22, 28, 25, 32, 30, 38, 42] },
    { key: "buildings", value: "3,562", sub: "+47 this month", delta: "+1.34%", up: true, chart: [30, 34, 31, 40, 38, 45, 52] },
    { key: "pending", value: "28", sub: lang === "th" ? "จาก 156 รายการ" : "of 156 items", delta: "-8.5%", up: false, chart: [40, 36, 32, 30, 28, 26, 24] },
    { key: "synced", value: "98.2%", sub: "2,847 / 2,899", delta: "+0.6%", up: true, chart: [88, 90, 92, 93, 95, 96, 98] },
  ];
  const statsMeta: Record<string, { label: string; icon: any; color: string }> = {
    parcels: { label: t("cardParcels"), icon: MapPin, color: "blue" },
    buildings: { label: t("cardBuildings"), icon: Building2, color: "gold" },
    pending: { label: t("cardPending"), icon: AlertCircle, color: "amber" },
    synced: { label: t("cardSynced"), icon: Database, color: "green" },
  };
  const stats = ((content?.stats ?? fallbackStats) as any[]).map((s: any) => ({
    chart: Array.isArray(s.chart) ? s.chart : [20, 24, 22, 28, 26, 30, 32],
    ...s,
    ...(statsMeta[s.key] || statsMeta.parcels),
  }));

  const quickActions = [
    { href: "/land", label: t("navLand"), icon: MapPin, tone: "blue" as const },
    { href: "/building", label: t("navBuilding"), icon: Building2, tone: "gold" as const },
    { href: "/tax", label: t("navTax"), icon: CircleDollarSign, tone: "rose" as const },
    { href: "/dashboard", label: lang === "th" ? "รายงาน" : "Reports", icon: FileText, tone: "emerald" as const },
  ];

  const fallbackRecent = [
    { code: "LP-2569-0042", name: "ที่ดินสถานีรังสิต", type: "land", progress: 78, status: "synced" },
    { code: "BL-2569-0117", name: "อาคารสำนักงานใหญ่", type: "building", progress: 42, status: "pending" },
    { code: "LP-2569-0041", name: "ที่ดินสถานีชุมทางบางซื่อ", type: "land", progress: 100, status: "offline" },
    { code: "BL-2569-0116", name: "โกดังเก็บพัสดุ", type: "building", progress: 95, status: "synced" },
  ];
  const recent = (content?.recent ?? fallbackRecent) as Array<{ code: string; name: string; type: string; progress: number; status: string; }>;


  const fallbackNews = [
    {
      tag: lang === "th" ? "ประกาศ" : "Notice",
      title: lang === "th" ? "กำหนดยื่นแบบแสดงรายการภาษี ปี 2569" : "Tax Filing Deadline 2026",
      date: "25 ก.ย. 2569",
      tone: "gold" as const,
    },
    {
      tag: lang === "th" ? "อบรม" : "Training",
      title: lang === "th" ? "อบรมการใช้งานระบบสำรวจภาคสนาม" : "Field Survey System Training",
      date: "15 ต.ค. 2569",
      tone: "blue" as const,
    },
    {
      tag: lang === "th" ? "ข่าว" : "News",
      title: lang === "th" ? "ปรับปรุงระบบ PWA รองรับ iOS 17" : "PWA Update for iOS 17",
      date: "10 ก.ย. 2569",
      tone: "green" as const,
    },
  ];
  const news = (content?.news ?? fallbackNews) as Array<{ tag: string; title: string; date: string; tone: "gold" | "blue" | "green" }>;


  const fallbackUpcoming = [
    { date: "25 ก.ย.", title: lang === "th" ? "ยื่นแบบภาษีที่ดิน Q3" : "Land Tax Filing Q3", icon: CircleDollarSign, urgent: true },
    { date: "30 ก.ย.", title: lang === "th" ? "ครบกำหนดสำรวจอาคาร สถานีหลัก" : "Main station survey deadline", icon: Building2, urgent: false },
    { date: "5 ต.ค.", title: lang === "th" ? "ประชุมคณะกรรมการทรัพย์สิน" : "Asset committee meeting", icon: Calendar, urgent: false },
  ];
  const upcomingIcon: Record<string, any> = { tax: CircleDollarSign, building: Building2, calendar: Calendar };
  const upcoming = ((content?.upcoming ?? fallbackUpcoming) as Array<{ date: string; title: string; icon: string; urgent: boolean }>).map((u: any) => ({
    ...u,
    icon: upcomingIcon[u.icon] || FileText,
  }));

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600" },
    gold: { bg: "bg-amber-50", icon: "text-amber-600" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
    rose: { bg: "bg-rose-50", icon: "text-rose-600" },
    green: { bg: "bg-emerald-50", icon: "text-emerald-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600" },
  };

  return (
    <Page allowedRoles={["admin", "supervisor", "subordinate", "accountant"]}>
      {/* Welcome header */}
      <div className="mb-5 sm:mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-govblue-800">
          {t("dashWelcome")}, <span className="text-govblue-600">เจ้าหน้าที่</span> 👋
        </h1>
        <button
          aria-label={lang === "th" ? "เริ่มสำรวจใหม่" : "New survey"}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-govblue-700 hover:bg-govblue-600 text-white text-sm font-medium rounded-lg shadow-sm transition"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{lang === "th" ? "เริ่มสำรวจใหม่" : "New survey"}</span>
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${colorMap[s.color].bg}`}>
                  <Icon size={16} className={colorMap[s.color].icon} />
                </div>
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded ${
                    s.up ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                  }`}
                >
                  {s.up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {s.delta}
                </span>
              </div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-500 leading-tight">
                {s.label}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-govblue-800 leading-tight mt-1">
                {s.value}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{s.sub}</div>

              {/* Mini sparkline */}
              <div className="mt-2 sm:mt-3 flex items-end gap-0.5 h-6 sm:h-8">
                {s.chart.map((h: number, i: number) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${s.up ? "bg-emerald-200" : "bg-rose-200"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions — mobile only */}
      <div className="md:hidden mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2.5">{t("quickActions")}</h3>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="flex flex-col items-center gap-1.5 p-2.5 bg-white border border-gray-200 rounded-xl hover:border-govblue-300 hover:shadow-sm transition"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[a.tone].bg}`}>
                  <Icon size={18} className={colorMap[a.tone].icon} />
                </div>
                <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                  {a.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main grid: Recent + News */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
        {/* Recent surveys */}
        <div className="lg:col-span-2">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-govblue-800 text-base">{t("recentTitle")}</h3>
              <button aria-label={t("viewAll")} className="text-govblue-600 hover:text-govblue-800 p-1">
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {recent.map((r) => (
                <div key={r.code} className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      r.type === "land" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {r.type === "land" ? <MapPin size={16} /> : <Building2 size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] text-govblue-700 font-semibold">{r.code}</span>
                      <span className="text-sm text-gray-800 truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.progress >= 80 ? "bg-emerald-500" : r.progress >= 50 ? "bg-govblue-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${r.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 tabular-nums">{r.progress}%</span>
                    </div>
                  </div>
                  {r.status === "synced" && <Tag tone="green">✓</Tag>}
                  {r.status === "pending" && <Tag tone="gold">⏳</Tag>}
                  {r.status === "offline" && <Tag tone="gray">☁️</Tag>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* News */}
        <div>
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-govblue-800 text-base">{t("newsTitle")}</h3>
              <button aria-label={t("viewAll")} className="text-govblue-600 hover:text-govblue-800 p-1">
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {news.map((n, i) => (
                <div key={i} className="flex gap-3 group cursor-pointer">
                  <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-govblue-400 to-govgold-400 group-hover:from-govblue-600 group-hover:to-govgold-500 transition" />
                  <div className="flex-1 min-w-0">
                    <Tag tone={n.tone}>{n.tag}</Tag>
                    <div className="text-sm text-gray-800 mt-1.5 leading-snug">{n.title}</div>
                    <div className="text-[11px] text-gray-500 mt-1">{n.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Upcoming */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-govblue-800 text-base">{t("upcomingTitle")}</h3>
          <button aria-label={t("viewAll")} className="text-govblue-600 hover:text-govblue-800 p-1">
            <ArrowRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {upcoming.map((u, i) => {
            const Icon = u.icon;
            return (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  u.urgent ? "border-rose-200 bg-rose-50/50" : "border-gray-200 bg-white"
                } hover:shadow-sm transition`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      u.urgent ? "bg-rose-100 text-rose-600" : "bg-govblue-50 text-govblue-600"
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-gray-500 mb-0.5">{u.date}</div>
                    <div className="text-sm font-medium text-gray-800 leading-snug">{u.title}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}
