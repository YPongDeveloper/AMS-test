"use client";

import { useEffect, useState, useMemo } from "react";
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
  Layers,
  Landmark,
  Download,
} from "lucide-react";

export default function TaxPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"individual" | "consolidated">("individual");
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

  const calculateWah = (l: LandParcel): number => {
    if (l.rai !== undefined && l.rai !== null) {
      return (l.rai || 0) * 400 + (l.ngan || 0) * 100 + (l.wa || 0);
    } else if (l.dimension) {
      const parts = l.dimension.split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        return parts[0] * 400 + parts[1] * 100 + parts[2];
      }
    } else if (l.width && l.length) {
      return Math.round((l.width * l.length) / 4);
    }
    return 850;
  };

  const applyLand = (l: LandParcel) => {
    const totalWah = calculateWah(l);
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

  // Consolidated Portfolio Calculation (แบบรวมภาพรวมทั้งหมดสำหรับพนักงานบัญชี)
  const consolidatedStats = useMemo(() => {
    let totalLandVal = 0;
    let totalBldgVal = 0;
    let totalLandTx = 0;
    let totalBldgTx = 0;

    const items = lands.map((l) => {
      const wah = calculateWah(l);
      const val = wah * 25000;
      let rate = 0.003;
      let use = "พาณิชยกรรม / อื่นๆ";
      if (l.land_use?.includes("ที่อยู่อาศัย")) {
        rate = 0.0002;
        use = "ที่อยู่อาศัย";
      } else if (l.land_use?.includes("เกษตร")) {
        rate = 0.0001;
        use = "เกษตรกรรม";
      }
      const tx = Math.round(val * rate);
      totalLandVal += val;
      totalLandTx += tx;
      return {
        landCode: l.land_code,
        srtType: l.srt_land_type || "-",
        useType: use,
        wah,
        val,
        rate,
        tax: tx,
      };
    });

    buildings.forEach((b) => {
      let area = 0;
      if (b.floors && b.floors.length > 0) {
        area = b.floors.reduce((s, f) => s + (f.dim || 0), 0);
      }
      if (area === 0) area = 450;
      const val = area * 12000;
      const tx = Math.round(val * 0.003);
      totalBldgVal += val;
      totalBldgTx += tx;
    });

    return {
      items,
      totalLandVal,
      totalBldgVal,
      totalBase: totalLandVal + totalBldgVal,
      totalLandTx,
      totalBldgTx,
      grandTotalTx: totalLandTx + totalBldgTx,
    };
  }, [lands, buildings]);

  const exportCSV = () => {
    const headers = ["รหัสแปลงที่ดิน,ประเภทการใช้ประโยชน์,ขนาดพื้นที่ (ตร.ว.),ฐานภาษีประเมิน (บาท),อัตราภาษี,ภาษีที่ต้องชำระ (บาท)\n"];
    const rows = consolidatedStats.items.map(
      (it) => `"${it.landCode}","${it.useType}",${it.wah},${it.val},${(it.rate * 100).toFixed(2)}%,${it.tax}\n`
    );
    const blob = new Blob(["\uFEFF" + headers.concat(rows).join("")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-report-consolidated-${taxYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page allowedRoles={["admin", "supervisor", "accountant"]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <SectionHeader title={t("taxTitle")} />
          <p className="text-xs text-gray-500 mt-0.5">
            ระบบคำนวณและประเมินภาษีที่ดินและสิ่งปลูกสร้าง (พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562)
          </p>
        </div>

        {/* Tab Selector: รายแห่ง vs แบบรวม */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("individual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "individual"
                ? "bg-govblue-800 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Calculator size={14} />
            คำนวณรายแห่ง (Individual)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("consolidated")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "consolidated"
                ? "bg-govblue-800 text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Layers size={14} />
            สรุปภาพรวมทั้งพอร์ต (Consolidated)
          </button>
        </div>
      </div>

      {activeTab === "individual" ? (
        /* โหมดคำนวณรายแห่ง (Individual Property Tax) */
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
      ) : (
        /* โหมดรายงานสรุปภาพรวมทั้งพอร์ต (Consolidated Portfolio Tax Report) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="แปลงที่ดินทั้งหมด"
              value={`${lands.length} แปลง`}
              hint={`ฐานประเมินรวม ${fmtCurrency(consolidatedStats.totalLandVal)}`}
              tone="blue"
            />
            <StatCard
              label="สิ่งปลูกสร้างทั้งหมด"
              value={`${buildings.length} หลัง`}
              hint={`ฐานประเมินรวม ${fmtCurrency(consolidatedStats.totalBldgVal)}`}
              tone="green"
            />
            <StatCard
              label="ฐานภาษีรวมทั้งพอร์ต"
              value={fmtCurrency(consolidatedStats.totalBase)}
              hint="ที่ดิน + สิ่งปลูกสร้างทุกแห่ง"
              tone="gold"
            />
            <StatCard
              label="ประมาณการภาษีรวมทั้งสิ้น"
              value={fmtCurrency(consolidatedStats.grandTotalTx)}
              hint={`ที่ดิน ${fmtCurrency(consolidatedStats.totalLandTx)} + อาคาร ${fmtCurrency(consolidatedStats.totalBldgTx)}`}
              tone="blue"
            />
          </div>

          <Card className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-govblue-900 flex items-center gap-2">
                  <Landmark size={16} className="text-govblue-700" />
                  บัญชีรายการภาษีที่ดินและสิ่งปลูกสร้างแยกรายแปลง (Consolidated Portfolio Tax)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  สรุปรายละเอียดการคำนวณภาษีประจำปี {taxYear} สำหรับฝ่ายการเงินและบัญชี รฟท.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Btn
                  variant="secondary"
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={exportCSV}
                >
                  <Download size={13} /> ส่งออก CSV
                </Btn>
                <Btn
                  onClick={() => window.print()}
                  className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Printer size={13} /> พิมพ์รายงานรวม
                </Btn>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-gray-200 text-gray-700 font-semibold">
                    <th className="py-2.5 px-3">ลำดับ</th>
                    <th className="py-2.5 px-3">รหัสแปลงที่ดิน</th>
                    <th className="py-2.5 px-3">ประเภททรัพย์สิน รฟท.</th>
                    <th className="py-2.5 px-3">การใช้ประโยชน์</th>
                    <th className="py-2.5 px-3 text-right">เนื้อที่ (ตร.ว.)</th>
                    <th className="py-2.5 px-3 text-right">ฐานภาษีประเมิน (บาท)</th>
                    <th className="py-2.5 px-3 text-center">อัตราภาษี</th>
                    <th className="py-2.5 px-3 text-right font-bold text-govblue-900">ภาษีประจำปี (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {consolidatedStats.items.map((it, idx) => (
                    <tr key={it.landCode} className="hover:bg-blue-50/40 transition">
                      <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-govblue-800">{it.landCode}</td>
                      <td className="py-2.5 px-3 text-gray-600">{it.srtType}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            it.useType.includes("พาณิชย์")
                              ? "bg-amber-100 text-amber-800"
                              : it.useType.includes("ที่อยู่อาศัย")
                              ? "bg-sky-100 text-sky-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {it.useType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{it.wah.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{fmtCurrency(it.val)}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{(it.rate * 100).toFixed(2)}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                        {fmtCurrency(it.tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-govblue-50/60 border-t-2 border-govblue-200 font-bold text-govblue-950 text-xs">
                    <td colSpan={4} className="py-3 px-3">รวมยอดทั้งพอร์ต ({consolidatedStats.items.length} รายการ)</td>
                    <td className="py-3 px-3 text-right font-mono">
                      {consolidatedStats.items.reduce((s, i) => s + i.wah, 0).toLocaleString()} ตร.ว.
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {fmtCurrency(consolidatedStats.totalLandVal)}
                    </td>
                    <td className="py-3 px-3 text-center">-</td>
                    <td className="py-3 px-3 text-right font-mono text-rose-700 text-sm">
                      {fmtCurrency(consolidatedStats.totalLandTx)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      )}
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
