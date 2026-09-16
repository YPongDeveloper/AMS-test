"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Landmark, FileText, CheckCircle2, ShieldCheck, TreePine, Building2 } from "lucide-react";
import { thaiBahtText, formatCurrency } from "@/lib/tax";

export interface ConsolidatedTaxItem {
  id: string;
  type: "land" | "building";
  code: string;
  name: string;
  srtType: string;
  useType: string;
  refInfo: string;
  address: string;
  areaNum: number;
  areaUnit: string;
  areaFormatted: string;
  appraisalPerUnit: number;
  baseValue: number;
  ratePercent: number;
  tax: number;
}

export interface ConsolidatedTaxInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxYear: string;
  items: ConsolidatedTaxItem[];
  totalLandVal: number;
  totalBldgVal: number;
  totalBase: number;
  totalLandTx: number;
  totalBldgTx: number;
  grandTotalTx: number;
}

export default function ConsolidatedTaxInvoiceModal({
  isOpen,
  onClose,
  taxYear,
  items,
  totalLandVal,
  totalBldgVal,
  totalBase,
  totalLandTx,
  totalBldgTx,
  grandTotalTx,
}: ConsolidatedTaxInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("tax-invoice-modal-open");

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = origOverflow;
      document.body.classList.remove("tax-invoice-modal-open");
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const docCode = `SRT-TAX-PORTFOLIO-${taxYear || "2569"}-001`;

  const todayStr = new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const thaiText = thaiBahtText(grandTotalTx);
  const landCount = items.filter((i) => i.type === "land").length;
  const bldgCount = items.filter((i) => i.type === "building").length;

  /**
   * สั่งพิมพ์เอกสารผ่าน Isolated Iframe
   * เพื่อให้พิมพ์เฉพาะตัวเอกสารแบบ ภ.ด.ส. สรุปทั้งพอร์ตจริงๆ เท่านั้น
   * ปราศจากองค์ประกอบหน้าเว็บ เมนู หรือปุ่มต่างๆ
   */
  const handlePrint = () => {
    const printElement = printRef.current;
    if (!printElement) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.name = "consolidated_tax_print_frame";
    iframe.style.position = "fixed";
    iframe.style.top = "-9999px";
    iframe.style.left = "-9999px";
    iframe.style.width = "297mm";
    iframe.style.height = "210mm";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    let stylesHtml = "";
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      stylesHtml += node.outerHTML;
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="utf-8">
          <title>แบบรายงานบัญชีรายการประเมินภาษีที่ดินและสิ่งปลูกสร้าง (แบบรวมทั้งพอร์ต) - ${docCode}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
          ${stylesHtml}
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 12mm 10mm 12mm;
            }
            @media print {
              html, body {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Sarabun', 'TH Sarabun New', sans-serif !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print,
              button {
                display: none !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              th, td {
                border: 1px solid #94a3b8 !important;
              }
              tr {
                page-break-inside: avoid !important;
              }
            }
            body {
              font-family: 'Sarabun', 'TH Sarabun New', sans-serif;
              color: #0f172a;
              background: #ffffff;
              padding: 0;
              margin: 0;
            }
            .document-sheet {
              width: 100%;
              max-width: 100%;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          <div class="document-sheet">
            ${printElement.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 400);
  };

  const modalContent = (
    <div
      id="consolidated-tax-modal-portal"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150 print:p-0 print:bg-white print:static print:block"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col border-0 sm:border border-gray-200 overflow-hidden max-h-[100dvh] sm:max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0 print:rounded-none animate-in zoom-in-95 duration-150">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-govblue-900 text-white shrink-0 sticky top-0 z-20 print:hidden shadow-xs">
          <div className="flex items-center gap-2 min-w-0 mr-2">
            <Landmark size={18} className="text-govgold-400 shrink-0" />
            <span className="font-bold text-xs sm:text-sm truncate">
              ใบประเมินภาษีที่ดินและสิ่งปลูกสร้าง (แบบรวมทั้งพอร์ต)
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

        {/* Scrollable Printable Document Container */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-gray-100 print:p-0 print:bg-white flex-1">
          <div
            ref={printRef}
            className="document-paper mx-auto bg-white p-6 sm:p-10 shadow-md sm:rounded-lg border border-gray-300 print:border-none print:shadow-none print:p-0 text-gray-900"
            style={{ fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif" }}
          >
            {/* Header Block */}
            <div className="flex flex-col sm:flex-row items-start justify-between border-b-2 border-govblue-900 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-govblue-900 text-govgold-400 flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                  <Landmark size={30} />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-govblue-950">
                    สำนักงานบริหารจัดการภาษีและทรัพย์สิน
                  </h1>
                  <p className="text-xs text-gray-700 font-semibold">
                    ฝ่ายการเงินและบัญชี • ระบบบริหารจัดการคำนวณและประเมินภาษี
                  </p>
                  <p className="text-[11px] text-gray-500">
                    เลขที่ 1 ถนนรองเมือง แขวงรองเมือง เขตปทุมวัน กรุงเทพมหานคร 10330
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
                <div className="inline-block bg-govblue-50 border border-govblue-200 px-3 py-1 rounded-lg text-govblue-900 font-bold text-xs uppercase tracking-wider mb-1">
                  แบบ ภ.ด.ส. สรุปภาพรวม
                </div>
                <p className="text-xs font-semibold text-gray-700">ประจำปีภาษี ๒๕๖๙ (2026)</p>
                <p className="text-[11px] text-gray-500">เลขที่เอกสาร: {docCode}</p>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-5">
              <h2 className="text-base sm:text-lg font-black text-govblue-950 uppercase tracking-wide">
                แบบแสดงรายการการคำนวณและประเมินภาษีที่ดินและสิ่งปลูกสร้าง (แบบรวมทั้งพอร์ต)
              </h2>
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                ตามพระราชบัญญัติภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. ๒๕๖๒
              </p>
            </div>

            {/* Meta Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs my-4">
              <div>
                <div className="mb-1">
                  <span className="text-gray-500 font-medium">หน่วยงานผู้ประเมิน:</span>{" "}
                  <span className="font-semibold text-gray-800">สำนักงานบริหารจัดการภาษีและทรัพย์สิน</span>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">วันที่ออกเอกสาร:</span>{" "}
                  <span className="font-semibold text-gray-800">{todayStr}</span>
                </div>
              </div>
              <div>
                <div className="mb-1">
                  <span className="text-gray-500 font-medium">จำนวนแปลงที่ดิน:</span>{" "}
                  <span className="font-bold text-gray-900">{landCount} แปลง</span> (ฐานประเมิน ฿{formatCurrency(totalLandVal)})
                </div>
                <div>
                  <span className="text-gray-500 font-medium">จำนวนสิ่งปลูกสร้าง:</span>{" "}
                  <span className="font-bold text-gray-900">{bldgCount} หลัง</span> (ฐานประเมิน ฿{formatCurrency(totalBldgVal)})
                </div>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-center">
                <div className="text-[11px] font-medium text-blue-700">แปลงที่ดินทั้งหมด</div>
                <div className="text-lg font-bold text-blue-900 mt-0.5">{landCount} แปลง</div>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-center">
                <div className="text-[11px] font-medium text-emerald-700">สิ่งปลูกสร้างทั้งหมด</div>
                <div className="text-lg font-bold text-emerald-900 mt-0.5">{bldgCount} หลัง</div>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-center">
                <div className="text-[11px] font-medium text-amber-700">ฐานภาษีรวมทั้งพอร์ต</div>
                <div className="text-lg font-bold text-amber-900 mt-0.5">฿{formatCurrency(totalBase)}</div>
              </div>
              <div className="p-3 bg-govblue-900 text-white rounded-lg text-center shadow-xs">
                <div className="text-[11px] font-medium text-govgold-300">ภาษีรวมทั้งสิ้น</div>
                <div className="text-lg font-bold text-govgold-400 mt-0.5">฿{formatCurrency(grandTotalTx)}</div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="my-5 overflow-x-auto">
              <table className="w-full text-left text-xs border border-gray-300 border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 font-bold border-b border-gray-300">
                    <th className="p-2 border border-gray-300 text-center w-8">ที่</th>
                    <th className="p-2 border border-gray-300 text-center w-14">ประเภท</th>
                    <th className="p-2 border border-gray-300 w-24">รหัสทรัพย์สิน</th>
                    <th className="p-2 border border-gray-300">ชื่อ / เลขโฉนด / อ้างอิง</th>
                    <th className="p-2 border border-gray-300">ที่ตั้ง / สถานที่</th>
                    <th className="p-2 border border-gray-300 text-right w-20">เนื้อที่</th>
                    <th className="p-2 border border-gray-300">การใช้ประโยชน์</th>
                    <th className="p-2 border border-gray-300 text-right w-28">ฐานประเมิน (บาท)</th>
                    <th className="p-2 border border-gray-300 text-center w-14">อัตรา</th>
                    <th className="p-2 border border-gray-300 text-right w-28">ภาษีที่ต้องชำระ (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 1 ? "bg-gray-50/50" : "bg-white"}>
                      <td className="p-2 border border-gray-300 text-center text-gray-500 font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-2 border border-gray-300 text-center">
                        {item.type === "land" ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <TreePine size={10} /> ที่ดิน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                            <Building2 size={10} /> อาคาร
                          </span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-300 font-mono font-bold text-gray-900">
                        {item.code}
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-800">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-[10px] text-gray-500">{item.refInfo}</div>
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-600 text-[11px]">
                        {item.address || "-"}
                      </td>
                      <td className="p-2 border border-gray-300 text-right font-mono text-gray-800">
                        {item.areaFormatted}
                      </td>
                      <td className="p-2 border border-gray-300 text-[11px] text-gray-700">
                        {item.useType}
                      </td>
                      <td className="p-2 border border-gray-300 text-right font-mono text-gray-800">
                        {formatCurrency(item.baseValue)}
                      </td>
                      <td className="p-2 border border-gray-300 text-center font-mono text-gray-600">
                        {item.ratePercent}%
                      </td>
                      <td className="p-2 border border-gray-300 text-right font-mono font-bold text-govblue-900">
                        {formatCurrency(item.tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-400">
                    <td colSpan={7} className="p-2.5 border border-gray-300 text-right">
                      รวมยอดประเมินทั้งสิ้น ({items.length} รายการ):
                    </td>
                    <td className="p-2.5 border border-gray-300 text-right font-mono text-base">
                      {formatCurrency(totalBase)}
                    </td>
                    <td className="p-2.5 border border-gray-300 text-center">-</td>
                    <td className="p-2.5 border border-gray-300 text-right font-mono text-base text-govblue-900">
                      {formatCurrency(grandTotalTx)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Baht Text Banner */}
            <div className="p-3 bg-govblue-50/60 border border-govblue-200 rounded-lg text-xs flex items-center justify-between my-4">
              <span className="font-semibold text-gray-700">จำนวนเงินภาษีรวมทั้งสิ้น (ตัวอักษร):</span>
              <span className="font-bold text-govblue-900 font-mono text-sm">{thaiText}</span>
            </div>

            {/* Legal Notice */}
            <div className="text-[11px] text-gray-500 my-4 space-y-1 border-t border-gray-200 pt-3">
              <p className="font-semibold text-gray-700">
                หมายเหตุและข้อกำหนดตามกฎหมาย:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                <li>การประเมินภาษีคำนวณตามพระราชบัญญัติภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. ๒๕๖๒ และระเบียบการรถไฟแห่งประเทศไทยว่าด้วยการบริหารจัดการทรัพย์สิน</li>
                <li>ผู้มีหน้าที่เสียภาษีต้องชำระภาษีภายในกำหนดเวลาที่ระเบียบกำหนด มิฉะนั้นจะต้องชำระเบี้ยปรับและเงินเพิ่มตามที่กฎหมายบัญญัติ</li>
              </ul>
            </div>

            {/* Official Signatures (3 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 mt-6 border-t-2 border-dashed border-gray-300 text-center text-xs">
              <div className="space-y-2">
                <p className="text-gray-600 font-medium">เจ้าหน้าที่ผู้ประเมินภาษี</p>
                <div className="h-12 flex items-end justify-center">
                  <span className="border-b border-dotted border-gray-400 w-40 inline-block"></span>
                </div>
                <p className="text-gray-800 font-semibold">(................................................................)</p>
                <p className="text-[11px] text-gray-500">เจ้าหน้าที่สำรวจและประเมินภาษี</p>
                <p className="text-[10px] text-gray-400">วันที่ ......../......../............</p>
              </div>

              <div className="space-y-2">
                <p className="text-gray-600 font-medium">พนักงานบัญชีและการเงินผู้ตรวจสอบ</p>
                <div className="h-12 flex items-end justify-center">
                  <span className="border-b border-dotted border-gray-400 w-40 inline-block"></span>
                </div>
                <p className="text-gray-800 font-semibold">(................................................................)</p>
                <p className="text-[11px] text-gray-500">พนักงานบัญชีและการเงิน</p>
                <p className="text-[10px] text-gray-400">วันที่ ......../......../............</p>
              </div>

              <div className="space-y-2">
                <p className="text-gray-600 font-medium">ผู้มีอำนาจลงนาม / อนุมัติ</p>
                <div className="h-12 flex items-end justify-center">
                  <span className="border-b border-dotted border-gray-400 w-40 inline-block"></span>
                </div>
                <p className="text-gray-800 font-semibold">(................................................................)</p>
                <p className="text-[11px] text-gray-500">หัวหน้าฝ่ายบริหารจัดการทรัพย์สินและสัญญา</p>
                <p className="text-[10px] text-gray-400">วันที่ ......../......../............</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
