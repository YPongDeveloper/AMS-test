"use client";

import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, StatCard } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { Calculator, FileText, CircleDollarSign, Percent, Receipt } from "lucide-react";

export default function TaxPage() {
  const { t } = useI18n();
  return (
    <Page>
      <SectionHeader title={t("taxTitle")} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-govblue-700 mb-3">ข้อมูลนำเข้า</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("taxYear")}>
                <Select defaultValue="2569">
                  <option value="2569">2569 (2026)</option>
                  <option value="2568">2568 (2025)</option>
                </Select>
              </Field>
              <Field label="รหัสทรัพย์สิน">
                <Input defaultValue="BL-2569-0118" />
              </Field>
              <Field label={t("landCode")}>
                <Input defaultValue="LP-2569-0043" />
              </Field>
              <Field label="ผู้รับชำระภาษี">
                <Input defaultValue="การรถไฟแห่งประเทศไทย" />
              </Field>
              <Field label="พื้นที่รวม (ตร.ว.)">
                <Input type="number" defaultValue="850" />
              </Field>
              <Field label="พื้นที่อาคารรวม (ตร.ม.)">
                <Input type="number" defaultValue="920.50" />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-govblue-700 mb-3 flex items-center gap-1.5">
              <Calculator size={14} /> สูตรคำนวณ (พ.ร.บ. ภาษีที่ดินฯ พ.ศ. 2562)
            </h3>
            <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
              ภาษี = มูลค่าฐานภาษี × อัตราภาษี (อัตราก้าวหน้าตามมูลค่า) − รายได้ที่ได้รับยกเว้น
            </div>
            <div className="space-y-2 text-xs">
              <Row label={t("taxLandValue")} value="฿ 12,500,000" />
              <Row label={t("taxBldgValue")} value="฿ 8,200,000" />
              <Row label="อัตราภาษีที่ดิน" value="0.05%" tone="muted" />
              <Row label="อัตราภาษีสิ่งปลูกสร้าง" value="0.30%" tone="muted" />
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <StatCard label={t("taxLandAmt")} value="฿ 6,250" hint="0.05% × 12.5M" tone="blue" />
          <StatCard label={t("taxBldgAmt")} value="฿ 24,600" hint="0.30% × 8.2M" tone="gold" />
          <Card className="p-4 bg-gradient-to-br from-govblue-700 to-govblue-600 text-white">
            <div className="text-xs uppercase opacity-80 flex items-center gap-1">
              <CircleDollarSign size={12} /> {t("taxTotal")}
            </div>
            <div className="text-3xl font-bold mt-1">฿ 30,850</div>
            <div className="text-[11px] opacity-80 mt-1">ต่อปี</div>
            <div className="mt-3 flex flex-col gap-1.5">
              <Btn variant="secondary" className="!bg-govgold-500 !text-govblue-800 !border-0 hover:!bg-govgold-400">
                <Calculator size={14} /> {t("taxCalc")}
              </Btn>
              <Btn className="!bg-white !text-govblue-700 hover:!bg-gray-100">
                <Receipt size={14} /> {t("taxNotice")}
              </Btn>
            </div>
          </Card>
          <Card className="p-3 text-[11px] text-gray-500">
            <div className="flex items-center gap-1 font-semibold text-govblue-700 mb-1">
              <FileText size={12} /> หมายเหตุ
            </div>
            ตัวเลขจำลอง — ไม่ใช่ข้อมูลจริง ใช้สำหรับ demo UI เท่านั้น
          </Card>
        </div>
      </div>
    </Page>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-1.5 last:border-0">
      <span className={tone === "muted" ? "text-gray-400" : "text-gray-700"}>{label}</span>
      <span className={`font-mono font-medium ${tone === "muted" ? "text-gray-500" : "text-govblue-700"}`}>
        {value}
      </span>
    </div>
  );
}
