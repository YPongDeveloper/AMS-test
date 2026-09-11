"use client";

import { Page } from "@/components/Page";
import { Card, SectionHeader, StatCard, Tag } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { MapPin, Building2, Clock, CircleDollarSign, Database, CloudOff, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { t } = useI18n();
  const recent = [
    { code: "LP-2569-0042", name: "ที่ดินสถานีรังสิต", type: "land", time: "2h ago", status: "synced" },
    { code: "BL-2569-0117", name: "อาคารสำนักงานใหญ่", type: "building", time: "3h ago", status: "pending" },
    { code: "LP-2569-0041", name: "ที่ดินสถานีชุมทางบางซื่อ", type: "land", time: "5h ago", status: "offline" },
    { code: "BL-2569-0116", name: "โกดังเก็บพัสดุ", type: "building", time: "yesterday", status: "synced" },
  ];
  return (
    <Page>
      <SectionHeader title={t("dashTitle")} sub={t("dashSub")} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        <StatCard label={t("cardParcels")} value="1,284" hint="+12 this month" tone="blue" />
        <StatCard label={t("cardBuildings")} value="3,562" hint="+47 this month" tone="gold" />
        <StatCard label={t("cardPending")} value="28" hint="รอตรวจสอบ" tone="amber" />
        <StatCard label={t("cardTax")} value="฿ 42.8M" hint="ปีภาษี 2569" tone="red" />
        <StatCard label={t("cardSynced")} value="98.2%" hint="สำเร็จ 2,847 / 2,899" tone="green" />
        <StatCard label={t("cardOffline")} value="14" hint="คิวรอส่ง" tone="blue" />
      </div>

      <div className="mt-4 sm:mt-6">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-govblue-700 text-sm sm:text-base">{t("recentTitle")}</h3>
            <button className="text-xs text-govblue-600 hover:underline inline-flex items-center gap-1">
              {t("viewAll")} <ArrowRight size={12} />
            </button>
          </div>
          <div className="overflow-x-auto -mx-3 sm:-mx-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-gray-500 border-b">
                  <th className="px-3 sm:px-4 py-2">Code</th>
                  <th className="px-3 sm:px-4 py-2">Name</th>
                  <th className="px-3 sm:px-4 py-2 hidden sm:table-cell">Type</th>
                  <th className="px-3 sm:px-4 py-2 hidden md:table-cell">Time</th>
                  <th className="px-3 sm:px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.code} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 sm:px-4 py-2 font-mono text-xs text-govblue-700 whitespace-nowrap">{r.code}</td>
                    <td className="px-3 sm:px-4 py-2">{r.name}</td>
                    <td className="px-3 sm:px-4 py-2 hidden sm:table-cell">
                      {r.type === "land" ? (
                        <Tag tone="green">
                          <MapPin size={10} className="mr-1" /> {t("navLand")}
                        </Tag>
                      ) : (
                        <Tag tone="gold">
                          <Building2 size={10} className="mr-1" /> {t("navBuilding")}
                        </Tag>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-2 text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                      <Clock size={10} className="inline mr-1" />
                      {r.time}
                    </td>
                    <td className="px-3 sm:px-4 py-2">
                      {r.status === "synced" && <Tag tone="green">✓ Synced</Tag>}
                      {r.status === "pending" && <Tag tone="gold">⏳ Pending</Tag>}
                      {r.status === "offline" && (
                        <Tag tone="gray">
                          <CloudOff size={10} className="mr-1" /> Offline
                        </Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Page>
  );
}
