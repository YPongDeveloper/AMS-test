"use client";

import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, Tag } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { Camera, MapPin, Save, X } from "lucide-react";

export default function LandPage() {
  const { t } = useI18n();
  return (
    <Page>
      <SectionHeader title={t("landTitle")} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-govblue-700 mb-3">1. {t("gpsCoord")}</h3>
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded p-4 h-40 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(0deg, transparent 24%, rgba(34,197,94,.3) 25%, rgba(34,197,94,.3) 26%, transparent 27%, transparent 74%, rgba(34,197,94,.3) 75%, rgba(34,197,94,.3) 76%, transparent 77%), linear-gradient(90deg, transparent 24%, rgba(34,197,94,.3) 25%, rgba(34,197,94,.3) 26%, transparent 27%, transparent 74%, rgba(34,197,94,.3) 75%, rgba(34,197,94,.3) 76%, transparent 77%)", backgroundSize: "30px 30px" }} />
              <div className="relative text-center">
                <MapPin className="mx-auto text-rose-500" size={32} />
                <div className="text-xs text-gray-600 mt-1 font-mono">13.7563° N, 100.5018° E</div>
                <Tag tone="green">GPS Lock ✓</Tag>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-govblue-700 mb-3">2. {t("landTitle")}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t("landCode")} required>
                <Input defaultValue="LP-2569-0043" />
              </Field>
              <Field label={t("landDeed")}>
                <Input placeholder="เลขที่โฉนด" />
              </Field>
              <Field label={t("landSrtType")}>
                <Select>
                  <option>— {t("landSrtType")} —</option>
                  <option>ที่ดินเชิงพาณิชย์</option>
                  <option>ที่ดินสถานี</option>
                  <option>ที่ดินทางรถไฟ</option>
                  <option>ที่ดินสาธารณูปโภค</option>
                </Select>
              </Field>
              <Field label={t("landUse")}>
                <Select>
                  <option>— {t("landUse")} —</option>
                  <option>ใช้เพื่อการขนส่ง</option>
                  <option>ใช้เพื่อการพาณิชย์</option>
                  <option>ใช้เพื่อที่อยู่อาศัย</option>
                </Select>
              </Field>
              <Field label={t("landType")}>
                <Select>
                  <option>— {t("landType")} —</option>
                  <option>โฉนด</option>
                  <option>น.ส.3</option>
                  <option>น.ส.3 ก.</option>
                  <option>ส.ป.ก.</option>
                </Select>
              </Field>
              <Field label={t("landDim")} hint="ไร่-งาน-ตารางวา">
                <Input defaultValue="2-1-50" />
              </Field>
              <Field label={t("landWidth")} hint="เมตร">
                <Input type="number" step="0.01" defaultValue="45.50" />
              </Field>
              <Field label={t("landLength")} hint="เมตร">
                <Input type="number" step="0.01" defaultValue="120.00" />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-govblue-700 mb-3">3. {t("bldgPhotoFront")}</h3>
            <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center bg-gray-50">
              <Camera className="mx-auto text-gray-400" size={28} />
              <div className="text-xs text-gray-500 mt-2">แตะเพื่อ {t("takePhoto")}</div>
              <Btn className="mt-2">
                <Camera size={14} /> {t("takePhoto")}
              </Btn>
            </div>
          </Card>

          <div className="flex gap-2 justify-end">
            <Btn variant="secondary">
              <X size={14} /> {t("cancel")}
            </Btn>
            <Btn>
              <Save size={14} /> {t("save")}
            </Btn>
          </div>
        </div>

        <div className="space-y-3">
          <Card className="p-3">
            <h4 className="text-xs font-semibold text-govblue-700 mb-2">สถานะ</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">GPS</span>
                <Tag tone="green">✓ Locked</Tag>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Offline save</span>
                <Tag tone="green">✓ Auto-saved</Tag>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sync queue</span>
                <Tag tone="gold">0 pending</Tag>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <h4 className="text-xs font-semibold text-govblue-700 mb-2">ผู้บันทึก</h4>
            <div className="text-xs space-y-0.5">
              <div className="font-medium">นายสมชาย ใจดี</div>
              <div className="text-gray-500">srt.field.001</div>
              <div className="text-gray-500">สถานีรังสิต</div>
              <div className="text-gray-500">10/09/2569 17:35</div>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
