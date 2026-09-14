"use client";

import { useEffect, useState } from "react";
import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, StatCard } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  fetchLands,
  fetchBuildings,
  type LandParcel,
  type Building,
} from "@/lib/api";
import {
  Calculator,
  FileText,
  CircleDollarSign,
  Percent,
  Receipt,
  Printer,
  CheckCircle2,
} from "lucide-react";

export default function TaxPage() {
  const { t } = useI18n();
  const [lands, setLands] = useState<LandParcel[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedLandCode, setSelectedLandCode] = useState<string>("");
  const [selectedBldgCode, setSelectedBldgCode] = useState<string>("");

  const [taxYear, setTaxYear] = useState("2569");
  const [appraisalLandPerWah, setAppraisalLandPerWah] = useState<number>(25000); // ราคาประเมินที่ดินต่อ ตร.ว.
  const [appraisalBldgPerSqm, setAppraisalBldgPerSqm] = useState<number>(12000); // ราคาประเมินสิ่งปลูกสร้างต่อ ตร.ม.

  const [landAreaWah, setLandAreaWah] = useState<number>(850);
  const [bldgAreaSqm, setBldgAreaSqm] = useState<number>(900);
  const [landUseType, setLandUseType] = useState<string>("พาณิชยกรรม / อื่นๆ");

  useEffect(() => {
    Promise.all([fetchLands(), fetchBuildings()]).then(([lData, bData]) => {
      setLands(lData);
      setBuildings(bData);
      if (lData.length > 0) {
        setSelectedLandCode(lData[0].land_code);
        applyLand(lData[0]);
      }
      if (bData.length > 0) {
        setSelectedBldgCode(bData[0].bldg_code);
        applyBuilding(bData[0]);
      }
    });
  }, []);

  const applyLand = (l: LandParcel) => {
    // Parse dimension like "2-1-50" (rai-ngan-wah)
    let totalWah = 850;
    if (l.dimension) {
      const parts = l.dimension.split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        totalWah = parts[0] * 400 + parts[1] * 100 + parts[2];
      }
    } else if (l.width && l.length) {
      totalWah = Math.round((l.width * l.length) / 4);
    }
    setLandAreaWah(totalWah);
    if (l.land_use?.includes("พาณิชย์")) setLandUseType("พาณิชยกรรม / อื่นๆ");
    else if (l.land_use?.includes("ที่อยู่อาศัย")) setLandUseType("ที่อยู่อาศัย");
    else if (l.land_use?.includes("เกษตร")) setLandUseType("เกษตรกรรม");
    else setLandUseType("พาณิชยกรรม / อื่นๆ");
  };

  const applyBuilding = (b: Building) => {
    let totalSqm = 0;
    if (b.floors && b.floors.length > 0) {
      totalSqm = b.floors.reduce((sum, fl) => sum + (fl.dim || 0), 0);
    }
    if (totalSqm === 0) totalSqm = 900;
    setBldgAreaSqm(totalSqm);
  };

  const onSelectLand = (code: string) => {
    setSelectedLandCode(code);
    const found = lands.find((l) => l.land_code === code);
    if (found) applyLand(found);
  };

  const onSelectBldg = (code: string) => {
    setSelectedBldgCode(code);
    const found = buildings.find((b) => b.bldg_code === code);
    if (found) applyBuilding(found);
  };

  // Tax calculations according to Thailand Land & Building Tax Act B.E. 2562
  const landValue = landAreaWah * appraisalLandPerWah;
  const bldgValue = bldgAreaSqm * appraisalBldgPerSqm;
  const totalBaseValue = landValue + bldgValue;

  // Rates:
  // Commercial/Other: 0.30%
  // Residential: 0.02%
  // Agricultural: 0.01%
  let landRate = 0.003;
  let bldgRate = 0.003;
  if (landUseType === "ที่อยู่อาศัย") {
    landRate = 0.0002;
    bldgRate = 0.0002;
  } else if (landUseType === "เกษตรกรรม") {
    landRate = 0.0001;
    bldgRate = 0.0001;
  }

  const landTax = Math.round(landValue * landRate);
  const bldgTax = Math.round(bldgValue * bldgRate);
  const totalTax = landTax + bldgTax;

  const fmtCurrency = (n: number) =>
    "฿ " + n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <Page>
      <SectionHeader title={t("taxTitle")} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-govblue-700 mb-3">
              1. เลือกทรัพย์สินที่ดินและสิ่งปลูกสร้างสำหรับการคำนวณ
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="ปีภาษี">
                <Select value={taxYear} onChange={(e) => setTaxYear(e.target.value)}>
                  <option value="2569">2569 (2026)</option>
                  <option value="2568">2568 (2025)</option>
                  <option value="2567">2567 (2024)</option>
                </Select>
              </Field>
              <Field label="ประเภทการใช้ประโยชน์ตาม พ.ร.บ.">
                <Select value={landUseType} onChange={(e) => setLandUseType(e.target.value)}>
                  <option value="พาณิชยกรรม / อื่นๆ">พาณิชยกรรม / อื่นๆ (อัตรา 0.3%)</option>
                  <option value="ที่อยู่อาศัย">ที่อยู่อาศัย (อัตรา 0.02%)</option>
                  <option value="เกษตรกรรม">เกษตรกรรม (อัตรา 0.01%)</option>
                  <option value="ที่ดินรกร้างว่างเปล่า">รกร้างว่างเปล่า (อัตรา 0.3%)</option>
                </Select>
              </Field>
              <Field label="เลือกแปลงที่ดิน (จากระบบสำรวจ)">
                <Select value={selectedLandCode} onChange={(e) => onSelectLand(e.target.value)}>
                  <option value="">— เลือกแปลงที่ดิน —</option>
                  {lands.map((l) => (
                    <option key={l.public_id} value={l.land_code}>
                      {l.land_code} (โฉนด: {l.deed_no || "-"})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="เลือกสิ่งปลูกสร้าง (จากระบบสำรวจ)">
                <Select value={selectedBldgCode} onChange={(e) => onSelectBldg(e.target.value)}>
                  <option value="">— เลือกสิ่งปลูกสร้าง —</option>
                  {buildings.map((b) => (
                    <option key={b.public_id} value={b.bldg_code}>
                      {b.bldg_code} ({b.name})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="ขนาดพื้นที่ดิน (ตร.ว.)" hint="1 ไร่ = 400 ตร.ว.">
                <Input
                  type="number"
                  value={landAreaWah}
                  onChange={(e) => setLandAreaWah(Number(e.target.value))}
                />
              </Field>
              <Field label="ราคาประเมินที่ดิน (บาท/ตร.ว.)">
                <Input
                  type="number"
                  value={appraisalLandPerWah}
                  onChange={(e) => setAppraisalLandPerWah(Number(e.target.value))}
                />
              </Field>
              <Field label="พื้นที่อาคารรวม (ตร.ม.)" hint="รวมทุกชั้น">
                <Input
                  type="number"
                  value={bldgAreaSqm}
                  onChange={(e) => setBldgAreaSqm(Number(e.target.value))}
                />
              </Field>
              <Field label="ราคาประเมินอาคาร (บาท/ตร.ม.)">
                <Input
                  type="number"
                  value={appraisalBldgPerSqm}
                  onChange={(e) => setAppraisalBldgPerSqm(Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-govblue-700 mb-3 flex items-center gap-1.5">
              <Calculator size={16} /> 2. รายละเอียดการประเมินภาษี (พ.ร.บ. ภาษีที่ดินฯ พ.ศ. 2562)
            </h3>
            <div className="text-[11px] text-gray-500 mb-3 leading-relaxed">
              สูตร: ภาษี = ฐานภาษี (ราคาประเมินทุนทรัพย์) × อัตราภาษีตามประเภทการใช้ประโยชน์
            </div>
            <div className="space-y-2 text-xs divide-y divide-gray-100">
              <Row label="มูลค่าฐานภาษีที่ดิน (พื้นที่ × ราคาประเมิน)" value={fmtCurrency(landValue)} />
              <Row label="อัตราภาษีที่ดิน" value={`${(landRate * 100).toFixed(2)}%`} tone="muted" />
              <Row label="ภาษีที่ดินที่ต้องชำระ" value={fmtCurrency(landTax)} />
              <Row
                label="มูลค่าฐานภาษีสิ่งปลูกสร้าง (พื้นที่ × ราคาประเมิน)"
                value={fmtCurrency(bldgValue)}
              />
              <Row
                label="อัตราภาษีสิ่งปลูกสร้าง"
                value={`${(bldgRate * 100).toFixed(2)}%`}
                tone="muted"
              />
              <Row label="ภาษีสิ่งปลูกสร้างที่ต้องชำระ" value={fmtCurrency(bldgTax)} />
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <StatCard
            label="ภาษีที่ดินประจำปี"
            value={fmtCurrency(landTax)}
            hint={`${(landRate * 100).toFixed(2)}% × ${fmtCurrency(landValue)}`}
            tone="blue"
          />
          <StatCard
            label="ภาษีสิ่งปลูกสร้างประจำปี"
            value={fmtCurrency(bldgTax)}
            hint={`${(bldgRate * 100).toFixed(2)}% × ${fmtCurrency(bldgValue)}`}
            tone="gold"
          />

          <Card className="p-4 bg-gradient-to-br from-govblue-800 to-govblue-700 text-white shadow-lg">
            <div className="text-xs uppercase tracking-wider opacity-80 flex items-center gap-1">
              <CircleDollarSign size={14} /> ภาษีรวมทั้งสิ้น (Total Annual Tax)
            </div>
            <div className="text-3xl font-bold mt-2 text-govgold-400 font-mono">
              {fmtCurrency(totalTax)}
            </div>
            <div className="text-[11px] opacity-80 mt-1">ประจำปีภาษี {taxYear}</div>
            <div className="mt-4 flex flex-col gap-2">
              <Btn
                onClick={() => window.print()}
                variant="secondary"
                className="!bg-govgold-500 !text-govblue-900 !border-0 hover:!bg-govgold-400 justify-center font-semibold"
              >
                <Printer size={14} /> พิมพ์ใบแจ้งประเมินภาษี (ภ.ด.ส. 3)
              </Btn>
            </div>
          </Card>

          <Card className="p-3 text-[11px] text-gray-500">
            <div className="flex items-center gap-1 font-semibold text-govblue-700 mb-1">
              <FileText size={12} /> อ้างอิงข้อกำหนด รฟท.
            </div>
            ข้อมูลที่ดินและสิ่งปลูกสร้างเชื่อมโยงจากชั้นข้อมูลสำรวจภาคสนาม รฟท.
            สามารถนำไปใช้ในกระบวนการจัดเก็บรายได้และการยื่นแบบประเมินภาษีต่อไป
          </Card>
        </div>
      </div>
    </Page>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  return (
    <div className="flex justify-between pt-1.5 pb-1">
      <span className={tone === "muted" ? "text-gray-400" : "text-gray-700"}>{label}</span>
      <span
        className={`font-mono font-medium ${
          tone === "muted" ? "text-gray-500" : "text-govblue-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
