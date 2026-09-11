"use client";

import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, Tag } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { Camera, Save, X, Layers, ImageIcon, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function BuildingPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"info" | "floors" | "photos">("info");
  const [activeFloor, setActiveFloor] = useState(1);

  const floorList = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <Page>
      <SectionHeader title={t("bldgTitle")} />

      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        <TabBtn active={tab === "info"} onClick={() => setTab("info")} icon={<Layers size={14} />}>
          Info
        </TabBtn>
        <TabBtn active={tab === "floors"} onClick={() => setTab("floors")} icon={<Layers size={14} />}>
          Floors
        </TabBtn>
        <TabBtn active={tab === "photos"} onClick={() => setTab("photos")} icon={<ImageIcon size={14} />}>
          Photos
        </TabBtn>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {tab === "info" && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-govblue-700 mb-3">ข้อมูลทั่วไป</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t("bldgCode")} required>
                  <Input defaultValue="BL-2569-0118" />
                </Field>
                <Field label={t("bldgName")} required>
                  <Input defaultValue="อาคารสำนักงานใหญ่ ชั้น 1-3" />
                </Field>
                <Field label={t("bldgType69")}>
                  <Select>
                    <option>— {t("bldgType69")} —</option>
                    <option>101 - บ้านเดี่ยว</option>
                    <option>201 - ตึกแถว</option>
                    <option>301 - อาคารสำนักงาน</option>
                    <option>401 - โรงงาน</option>
                    <option>501 - คลังสินค้า</option>
                  </Select>
                </Field>
                <Field label={t("bldgMaterial")}>
                  <Select>
                    <option>— {t("bldgMaterial")} —</option>
                    <option>คอนกรีตเสริมเหล็ก</option>
                    <option>ไม้</option>
                    <option>เหล็ก</option>
                    <option>ผสม</option>
                  </Select>
                </Field>
                <Field label={t("bldgAge")} hint="ปี">
                  <Input type="number" defaultValue="28" />
                </Field>
                <Field label={t("bldgYear")} hint="พ.ศ.">
                  <Input defaultValue="2541" />
                </Field>
                <Field label={t("bldgFloors")}>
                  <Input type="number" step="0.01" defaultValue="3.00" />
                </Field>
                <Field label={t("bldgCondition")}>
                  <Select>
                    <option>— {t("bldgCondition")} —</option>
                    <option>ดี</option>
                    <option>พอใช้</option>
                    <option>ทรุดโทรม</option>
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {tab === "floors" && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-govblue-700">รายละเอียดต่อชั้น</h3>
                <div className="flex gap-1 flex-wrap">
                  {floorList.map((f) => (
                    <button
                      key={f}
                      onClick={() => setActiveFloor(f)}
                      className={`w-9 h-9 text-xs font-medium rounded ${
                        activeFloor === f
                          ? "bg-govblue-700 text-white"
                          : "bg-white text-govblue-700 border border-govblue-200 hover:bg-govblue-50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-govblue-50 border-l-4 border-govblue-700 px-3 py-2 mb-3">
                <div className="text-xs text-govblue-700">
                  {t("bldgFloor")} <span className="font-bold">{activeFloor}</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t("bldgUseOfFloor")} className="sm:col-span-2">
                  <Select>
                    <option>— {t("bldgUseOfFloor")} —</option>
                    <option>สำนักงาน</option>
                    <option>ที่พักอาศัย</option>
                    <option>ร้านค้า</option>
                    <option>คลังสินค้า</option>
                    <option>ทางเดิน / ส่วนกลาง</option>
                  </Select>
                </Field>
                <Field label={t("bldgDim")} hint="ตร.ม.">
                  <Input type="number" step="0.01" defaultValue={activeFloor === 1 ? "320.50" : "300.00"} />
                </Field>
                <Field label={t("bldgWidth")} hint="ม.">
                  <Input type="number" step="0.01" defaultValue="18.00" />
                </Field>
                <Field label={t("bldgLength")} hint="ม.">
                  <Input type="number" step="0.01" defaultValue="18.00" />
                </Field>
              </div>
            </Card>
          )}

          {tab === "photos" && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-govblue-700 mb-3">ภาพถ่าย 4 ด้าน</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "bldgPhotoFront", label: t("bldgPhotoFront") },
                  { key: "bldgPhotoBack", label: t("bldgPhotoBack") },
                  { key: "bldgPhotoRight", label: t("bldgPhotoRight") },
                  { key: "bldgPhotoLeft", label: t("bldgPhotoLeft") },
                ].map((p, i) => (
                  <div key={p.key} className="border-2 border-dashed border-gray-300 rounded p-4 text-center bg-gray-50">
                    <Camera className="mx-auto text-gray-400 mb-1" size={24} />
                    <div className="text-xs font-medium text-gray-700">{p.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {i < 2 ? "✓ 1 ภาพ" : "ยังไม่ได้ถ่าย"}
                    </div>
                    <Btn className="mt-2 !py-1 !px-2 !text-[11px]">
                      <Camera size={11} /> {t("takePhoto")}
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}

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
            <h4 className="text-xs font-semibold text-govblue-700 mb-2">Progress</h4>
            <div className="space-y-1.5 text-xs">
              <Progress label="Info" done />
              <Progress label={`Floors 1/10`} done={tab === "floors"} />
              <Progress label="Photos" done={tab === "photos"} />
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Completion</span>
                <span className="font-bold text-govblue-700">33%</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-200 rounded overflow-hidden">
                <div className="h-full bg-govgold-500" style={{ width: "33%" }} />
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <h4 className="text-xs font-semibold text-govblue-700 mb-2">ผู้บันทึก</h4>
            <div className="text-xs space-y-0.5">
              <div className="font-medium">นายสมชาย ใจดี</div>
              <div className="text-gray-500">srt.field.001</div>
              <div className="text-gray-500">สถานีรังสิต</div>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition whitespace-nowrap ${
        active
          ? "border-govblue-700 text-govblue-700 font-medium"
          : "border-transparent text-gray-500 hover:text-govblue-600"
      }`}
    >
      {icon}
      {children}
      <ChevronRight size={12} className="opacity-50" />
    </button>
  );
}

function Progress({ label, done }: { label: string; done?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      {done ? <Tag tone="green">✓</Tag> : <Tag tone="gray">⏳</Tag>}
    </div>
  );
}
