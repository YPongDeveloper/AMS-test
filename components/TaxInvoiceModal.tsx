"use client";

import React, { useRef, useEffect } from "react";
import { X, Printer, Landmark, QrCode, FileText, CheckCircle2 } from "lucide-react";
import { LandParcel, Building } from "@/lib/api";
import {
  calculateLandTax,
  calculateBuildingTax,
  generateTaxDocNumber,
  thaiBahtText,
  formatCurrency,
  formatFullAddress,
} from "@/lib/tax";

interface TaxInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "land" | "building";
  land?: LandParcel | null;
  building?: Building | null;
}

export default function TaxInvoiceModal({
  isOpen,
  onClose,
  targetType,
  land,
  building,
}: TaxInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLand = targetType === "land" && Boolean(land);
  const isBuilding = targetType === "building" && Boolean(building);

  const landResult = isLand && land ? calculateLandTax(land) : null;
  const bldgResult = isBuilding && building ? calculateBuildingTax(building) : null;

  const docCode = isLand && land
    ? generateTaxDocNumber("TAX", land.land_code)
    : isBuilding && building
    ? generateTaxDocNumber("TAX", building.bldg_code)
    : "SRT-TAX-2569-0001";

  const todayStr = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const taxPayable = isLand && landResult ? landResult.taxPayable : bldgResult ? bldgResult.taxPayable : 0;
  const baseValue = isLand && landResult ? landResult.baseValue : bldgResult ? bldgResult.baseValue : 0;
  const ratePercent = isLand && landResult ? landResult.taxRatePercent : bldgResult ? bldgResult.taxRatePercent : 0.3;
  const useType = isLand && landResult ? landResult.useType : bldgResult ? bldgResult.useType : "พาณิชยกรรม / อื่นๆ";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150 print:p-0 print:bg-white print:static print:block"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col border-0 sm:border border-gray-200 overflow-hidden max-h-[100dvh] sm:max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0 print:rounded-none animate-in zoom-in-95 duration-150">
        {/* Modal Toolbar (Hidden during print) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-govblue-900 text-white shrink-0 sticky top-0 z-20 print:hidden shadow-xs">
          <div className="flex items-center gap-2 min-w-0 mr-2">
            <Printer size={18} className="text-govgold-400 shrink-0" />
            <span className="font-bold text-xs sm:text-sm truncate">
              ใบแจ้งการประเมินภาษี / ใบกำกับภาษี
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 sm:px-4 py-1.5 bg-govgold-500 hover:bg-govgold-400 text-govblue-950 font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer size={14} /> <span className="hidden sm:inline">สั่งพิมพ์เอกสาร</span> (Print)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Document Area - Scrollable */}
        <div
          id="tax-invoice-printable"
          ref={printRef}
          className="p-4 sm:p-10 text-gray-900 bg-white leading-relaxed font-sans text-xs sm:text-sm print:p-6 print:text-black overflow-y-auto flex-1 min-h-0"
        >
          {/* Official Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b-2 border-govblue-900 pb-4 sm:pb-5 mb-5 sm:mb-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-govblue-900 text-govgold-400 flex items-center justify-center font-bold text-xl sm:text-2xl shadow-sm border-2 border-govgold-500 shrink-0">
                <Landmark size={26} className="sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-black tracking-tight text-govblue-950">
                  ระบบจัดการคำนวนภาษี
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 font-medium">
                  สำนักงานบริหารจัดการภาษีและทรัพย์สิน
                </p>
                <p className="text-[11px] text-gray-500">
                  ฝ่ายการเงินและบัญชี
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 flex items-center justify-between sm:block">
              <div className="inline-block bg-govblue-50 border border-govblue-200 px-2.5 sm:px-3 py-1 rounded-lg text-govblue-900 font-bold text-[11px] sm:text-xs uppercase tracking-wider mb-0 sm:mb-1">
                แบบ ภ.ด.ส. ๖ / ภ.ด.ส. ๗
              </div>
              <p className="text-[11px] text-gray-500">ปีภาษี ๒๕๖๙ (2026)</p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center my-4">
            <h2 className="text-base sm:text-lg font-bold text-govblue-900 uppercase">
              ใบแจ้งการประเมินภาษีที่ดินและสิ่งปลูกสร้าง / ใบกำกับภาษีอย่างย่อ
            </h2>
            <p className="text-xs text-gray-500">
              ตามพระราชบัญญัติภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. ๒๕๖๒
            </p>
          </div>

          {/* Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-4 sm:my-6 p-3 sm:p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
            <div>
              <div className="mb-1.5">
                <span className="text-gray-500 font-medium">เลขที่เอกสาร (Doc No.):</span>{" "}
                <span className="font-bold text-gray-900 font-mono">{docCode}</span>
              </div>
              <div className="mb-1.5">
                <span className="text-gray-500 font-medium">วันที่ออกหนังสือ (Date):</span>{" "}
                <span className="font-semibold text-gray-800">{todayStr}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">หน่วยงานผู้ประเมิน:</span>{" "}
                <span className="font-semibold text-gray-800">สำนักงานบริหารจัดการภาษีและทรัพย์สิน</span>
              </div>
            </div>
            <div>
              <div className="mb-1.5">
                <span className="text-gray-500 font-medium">ผู้มีหน้าที่เสียภาษี/ผู้เช่า:</span>{" "}
                <span className="font-bold text-gray-900">ผู้ครอบครอง/ผู้เช่าพื้นที่</span>
              </div>
              <div className="mb-1.5">
                <span className="text-gray-500 font-medium">เลขประจำตัวผู้เสียภาษี:</span>{" "}
                <span className="font-mono text-gray-800 font-semibold">0-9940-00158-24-1</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">กำหนดชำระภายใน:</span>{" "}
                <span className="font-bold text-rose-600">30 เมษายน 2569</span>
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2 pt-2 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5">
              <span className="text-gray-500 font-medium shrink-0">สถานที่ตั้งทรัพย์สิน:</span>
              <span className="font-semibold text-gray-900 break-words">
                {formatFullAddress(isLand ? land : building)}
              </span>
            </div>
          </div>

          {/* Property Assessment Details */}
          <div className="mb-6">
            <h3 className="font-bold text-xs uppercase tracking-wider text-govblue-900 mb-2 flex items-center gap-1.5">
              <FileText size={15} /> รายการทรัพย์สินและฐานภาษีที่ดิน/สิ่งปลูกสร้าง
            </h3>
            <div className="border border-gray-300 rounded-lg overflow-x-auto shadow-2xs">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-800 font-bold border-b border-gray-300">
                  <tr>
                    <th className="p-2.5 border-r border-gray-300 text-center w-10">ลำดับ</th>
                    <th className="p-2.5 border-r border-gray-300">รายการทรัพย์สิน</th>
                    <th className="p-2.5 border-r border-gray-300">ประเภทการใช้ประโยชน์</th>
                    <th className="p-2.5 border-r border-gray-300 text-right">ขนาดพื้นที่</th>
                    <th className="p-2.5 border-r border-gray-300 text-right">ราคาประเมิน/หน่วย</th>
                    <th className="p-2.5 border-r border-gray-300 text-right">มูลค่าฐานภาษี (บาท)</th>
                    <th className="p-2.5 border-r border-gray-300 text-center w-16">อัตราภาษี</th>
                    <th className="p-2.5 text-right w-28">ค่าภาษี (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLand && land && landResult && (
                    <tr>
                      <td className="p-2.5 border-r border-gray-200 text-center">1</td>
                      <td className="p-2.5 border-r border-gray-200">
                        <div className="font-bold text-govblue-900">{land.land_code}</div>
                        <div className="text-[11px] text-gray-500">
                          โฉนดเลขที่: {land.deed_no || "-"} • ประเภท: {land.srt_land_type || "แปลงที่ดิน"}
                        </div>
                        {formatFullAddress(land) !== "-" && (
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            ที่ตั้ง: {formatFullAddress(land)}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 border-r border-gray-200">{landResult.useType}</td>
                      <td className="p-2.5 border-r border-gray-200 text-right font-medium">
                        {landResult.totalWah.toLocaleString()} ตร.ว.
                        <div className="text-[10px] text-gray-400">
                          ({land.rai || 0} ไร่ {land.ngan || 0} งาน {land.wa || 0} วา)
                        </div>
                      </td>
                      <td className="p-2.5 border-r border-gray-200 text-right font-mono">
                        ฿{landResult.appraisalPerWah.toLocaleString()}
                      </td>
                      <td className="p-2.5 border-r border-gray-200 text-right font-mono font-medium">
                        ฿{landResult.formattedBaseValue}
                      </td>
                      <td className="p-2.5 border-r border-gray-200 text-center font-mono">
                        {landResult.taxRatePercent}%
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-govblue-900">
                        ฿{landResult.formattedTaxPayable}
                      </td>
                    </tr>
                  )}

                  {isBuilding && building && bldgResult && (
                    <tr>
                      <td className="p-2.5 border-r border-gray-200 text-center">1</td>
                      <td className="p-2.5 border-r border-gray-200">
                        <div className="font-bold text-govblue-900">{building.bldg_code}</div>
                        <div className="text-[11px] text-gray-500">
                          {building.name} ({building.num_fl} ชั้น) • บนแปลง: {building.land_code || "-"}
                        </div>
                        {formatFullAddress(building) !== "-" && (
                          <div className="text-[10px] text-gray-600 mt-0.5">
                            ที่ตั้ง: {formatFullAddress(building)}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 border-r border-gray-200">{bldgResult.useType}</td>
                      <td className="p-2.5 border-r border-gray-200 text-right font-medium">
                        {bldgResult.totalUsableSqm.toLocaleString()} ตร.ม.
                        <div className="text-[10px] text-gray-400">
                          (สภาพ: {building.bld_condition_type || "ดี"})
                        </div>
                      </td>
                      <td className="p-2.5 border-r border-gray-200 text-right font-mono">
                        ฿{bldgResult.appraisalPerSqm.toLocaleString()}
                      </td>
                      <td className="p-2.5 border-r border-gray-200 text-right font-mono font-medium">
                        ฿{bldgResult.formattedBaseValue}
                      </td>
                      <td className="p-2.5 border-r border-gray-200 text-center font-mono">
                        {bldgResult.taxRatePercent}%
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-govblue-900">
                        ฿{bldgResult.formattedTaxPayable}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 font-bold border-t border-gray-300">
                  <tr>
                    <td colSpan={5} className="p-2.5 text-right border-r border-gray-300">
                      รวมมูลค่าฐานภาษีทั้งสิ้น:
                    </td>
                    <td className="p-2.5 text-right border-r border-gray-300 font-mono">
                      ฿{formatCurrency(baseValue)}
                    </td>
                    <td className="p-2.5 text-center border-r border-gray-300">-</td>
                    <td className="p-2.5 text-right font-mono text-emerald-700 font-black text-sm">
                      ฿{formatCurrency(taxPayable)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Grand Total In Words */}
          <div className="p-3 bg-govblue-50/70 border border-govblue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs mb-6">
            <span className="font-semibold text-gray-600">จำนวนเงินภาษีที่ต้องชำระ (ตัวหนังสือ):</span>
            <span className="font-bold text-govblue-900 text-xs sm:text-sm">({thaiBahtText(taxPayable)})</span>
          </div>

          {/* Payment Instructions & QR Mock */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-xl bg-gray-50/60 mb-6 text-xs">
            <div className="sm:col-span-2 space-y-2">
              <h4 className="font-bold text-govblue-900 flex items-center gap-1">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> วิธีการชำระเงินและเงื่อนไข
              </h4>
              <p className="text-gray-600 leading-relaxed">
                1. สามารถชำระเงินได้ที่ <strong>ฝ่ายการเงินและบัญชี สำนักงานบริหารจัดการภาษีและทรัพย์สิน</strong> ทุกวันทำการ
              </p>
              <p className="text-gray-600 leading-relaxed">
                2. ชำระผ่านเคาน์เตอร์ธนาคารกรุงไทย ทุกสาขา หรือ สแกนชำระผ่านระบบ PromptPay Cross-Bank Bill Payment
              </p>
              <p className="text-[11px] text-gray-500 italic">
                * หากพ้นกำหนดระยะเวลาที่ระบุไว้ในหนังสือนี้ จะต้องชำระเบี้ยปรับและเงินเพิ่มตามที่กฎหมายกำหนด
              </p>
            </div>
            <div className="flex flex-col items-center justify-center border-t sm:border-t-0 sm:border-l border-gray-200 pt-3 sm:pt-0 sm:pl-3">
              <div className="w-24 h-24 bg-white border border-gray-300 rounded-lg flex flex-col items-center justify-center p-2 shadow-2xs">
                <QrCode size={56} className="text-gray-800" />
                <span className="text-[9px] font-bold text-govblue-900 mt-1">PromptPay QR</span>
              </div>
              <span className="text-[10px] text-gray-500 mt-1 font-mono">Ref: {docCode.slice(-8)}</span>
            </div>
          </div>

          {/* Signature Block */}
          <div className="grid grid-cols-2 gap-4 sm:gap-8 text-center pt-4 sm:pt-6 mt-4 text-xs">
            <div>
              <div className="h-8 sm:h-10"></div>
              <p className="border-b border-gray-400 w-32 sm:w-44 mx-auto mb-1"></p>
              <p className="font-bold text-gray-800 text-[11px] sm:text-xs">(........................................................)</p>
              <p className="text-[10px] sm:text-[11px] text-gray-500">เจ้าพนักงานประเมินภาษี</p>
            </div>
            <div>
              <div className="h-8 sm:h-10"></div>
              <p className="border-b border-gray-400 w-32 sm:w-44 mx-auto mb-1"></p>
              <p className="font-bold text-gray-800 text-[11px] sm:text-xs">(........................................................)</p>
              <p className="text-[10px] sm:text-[11px] text-gray-500">ผู้อำนวยการฝ่ายบริหารจัดการภาษีและทรัพย์สิน</p>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden during print) */}
        <div className="px-4 sm:px-6 py-3 bg-gray-100 border-t border-gray-200 flex items-center justify-between shrink-0 sticky bottom-0 z-20 print:hidden">
          <span className="text-[11px] sm:text-xs text-gray-500 hidden sm:inline">
            เอกสารนี้จัดพิมพ์โดยระบบจัดการคำนวนภาษี (Tax Management System)
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 bg-white hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg border border-gray-300 transition text-center cursor-pointer shadow-2xs"
            >
              ปิดหน้าต่าง
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-4 sm:px-5 py-2 sm:py-1.5 bg-govblue-800 hover:bg-govblue-900 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Printer size={15} /> สั่งพิมพ์ใบประเมิน / ใบเสร็จ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
