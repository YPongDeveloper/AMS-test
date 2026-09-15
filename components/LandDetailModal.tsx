"use client";

import React from "react";
import {
  X,
  Layers,
  MapPin,
  FileText,
  Printer,
  AlertCircle,
  Maximize2,
  Calendar,
  Compass,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { LandParcel } from "@/lib/api";
import { calculateLandTax, formatCurrency, formatFullAddress } from "@/lib/tax";
import MapPicker from "@/components/MapPicker";

interface LandDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: LandParcel | null;
  onOpenTaxInvoice: (land: LandParcel) => void;
  onOpenRevisionRequest?: (land: LandParcel) => void;
}

export default function LandDetailModal({
  isOpen,
  onClose,
  land,
  onOpenTaxInvoice,
  onOpenRevisionRequest,
}: LandDetailModalProps) {
  if (!isOpen || !land) return null;

  const tax = calculateLandTax(land);

  const rai = land.rai ?? (land.dimension ? Number(land.dimension.split("-")[0]) : 0);
  const ngan = land.ngan ?? (land.dimension ? Number(land.dimension.split("-")[1]) : 0);
  const wa = land.wa ?? (land.dimension ? Number(land.dimension.split("-")[2]) : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white sm:rounded-2xl shadow-2xl max-w-3xl w-full sm:my-6 flex flex-col border-0 sm:border border-gray-200 overflow-hidden max-h-[100dvh] sm:max-h-[92vh] rounded-t-2xl sm:rounded-b-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-govblue-900 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-govblue-800 rounded-lg text-govgold-400 shrink-0">
              <Layers size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2 flex-wrap">
                <span className="truncate">แปลงที่ดิน: {land.land_code}</span>
                <span className="text-[10px] sm:text-[11px] font-normal px-2 py-0.5 rounded-full bg-govblue-800 text-govgold-300 border border-govgold-500/30 whitespace-nowrap shrink-0">
                  {land.srt_land_type || "แปลงที่ดิน"}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-govblue-200 truncate">
                เลขที่โฉนด: {land.deed_no || "-"} • สิทธิ์: {land.land_type || "โฉนด"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition shrink-0 -mr-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 text-xs sm:text-sm">
          {/* Quick Stats Grid - 1 col on small mobile, 2 on larger mobile, 4 on desktop */}
          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">เนื้อที่รวม</span>
              <span className="text-base font-bold text-gray-900">
                {rai} ไร่ {ngan} งาน {wa} วา
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                ({tax.totalWah.toLocaleString()} ตร.ว. / {tax.totalSqm.toLocaleString()} ตร.ม.)
              </span>
            </div>
            <div className="p-3 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">ขนาดกว้าง × ยาว</span>
              <span className="text-base font-bold text-gray-900">
                {land.width && land.length ? `${land.width} × ${land.length} ม.` : "ไม่ระบุ"}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">ระยะหน้ากว้างและลึก</span>
            </div>
            <div className="p-3 sm:p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">การใช้ประโยชน์</span>
              <span className="text-sm font-bold text-govblue-900 truncate block mt-0.5">
                {land.land_use || "ทั่วไป"}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium block">
                {tax.useType}
              </span>
            </div>
            <div className="p-3 sm:p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <span className="text-[11px] text-emerald-700 block font-medium">ภาษีประเมินปี 69</span>
              <span className="text-base font-black text-emerald-700">
                ฿{tax.formattedTaxPayable}
              </span>
              <span className="text-[10px] text-emerald-600 block">อัตรา {tax.taxRatePercent}%</span>
            </div>
          </div>

          {/* Tax Assessment Summary Box */}
          <div className="p-3 sm:p-4 bg-govblue-50/60 border border-govblue-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1">
              <h3 className="font-bold text-xs uppercase tracking-wider text-govblue-900 flex items-center gap-1.5">
                <FileText size={15} /> สรุปการประเมินภาษีที่ดิน
                <span className="hidden sm:inline">(พ.ร.บ. ภาษีที่ดินฯ 2562)</span>
              </h3>
              <button
                onClick={() => {
                  onClose();
                  onOpenTaxInvoice(land);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-govblue-800 hover:text-govblue-950 underline self-start sm:self-auto"
              >
                <Printer size={13} /> ดูใบกำกับภาษีฉบับเต็ม →
              </button>
            </div>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2 sm:gap-3 text-xs">
              <div>
                <span className="text-gray-500">ราคาประเมินทุนทรัพย์:</span>
                <p className="font-semibold text-gray-900">
                  ฿{tax.appraisalPerWah.toLocaleString()} / ตร.ว.
                </p>
              </div>
              <div>
                <span className="text-gray-500">มูลค่าฐานภาษีรวม:</span>
                <p className="font-bold text-govblue-900 font-mono">
                  ฿{tax.formattedBaseValue}
                </p>
              </div>
              <div>
                <span className="text-gray-500">ค่าภาษีที่ดินที่ต้องชำระ:</span>
                <p className="font-bold text-emerald-700 font-mono text-sm">
                  ฿{tax.formattedTaxPayable}
                </p>
              </div>
            </div>
          </div>

          {/* Address & Location Card */}
          <div className="p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <MapPin size={15} className="text-rose-600" /> ที่อยู่และสถานที่ตั้ง (ADDRESS & LOCATION)
            </h3>
            <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">เลขที่/ถนน/ซอย</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {land.address_no || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">ตำบล/แขวง</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {land.subdistrict || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">อำเภอ/เขต</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {land.district || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">จังหวัด</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {land.province || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200 col-span-2 min-[400px]:col-span-1">
                <span className="text-[10px] text-gray-400 block">รหัสไปรษณีย์</span>
                <span className="font-bold font-mono text-govblue-900 truncate block">
                  {land.postal_code || "-"}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-gray-600 pt-1 flex items-start gap-1">
              <span className="text-gray-400 shrink-0">ที่อยู่เต็ม:</span>
              <span className="font-medium text-gray-800">{formatFullAddress(land)}</span>
            </div>
          </div>

          {/* Location & GPS Map */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
              <MapPin size={15} className="text-rose-500" /> พิกัดและแผนที่ตำแหน่งที่ดิน (Location Map)
            </h3>
            {land.lat && land.lng ? (
              <div className="space-y-2">
                <div className="h-44 sm:h-56 rounded-xl overflow-hidden border border-gray-200 shadow-2xs">
                  <MapPicker
                    lat={land.lat}
                    lng={land.lng}
                    readOnly={true}
                    height="224px"
                    showInputs={false}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 px-1 gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-gray-400 shrink-0">พิกัด GPS:</span>
                    <strong className="font-mono text-gray-800 text-[11px] sm:text-xs truncate">
                      {land.lat.toFixed(6)}, {land.lng.toFixed(6)}
                    </strong>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${land.lat},${land.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs font-semibold text-[11px] transition shrink-0 hover:border-slate-400 hover:text-govblue-900 group"
                    title="เปิดตำแหน่งนี้บน Google Maps"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform">
                      <path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                      <circle cx="12" cy="9" r="2.8" fill="#FFFFFF"/>
                      <circle cx="12" cy="9" r="1.5" fill="#4285F4"/>
                    </svg>
                    <span>Google Maps</span>
                    <ExternalLink size={11} className="text-slate-400" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center text-gray-500">
                ยังไม่มีข้อมูลพิกัด GPS ของแปลงที่ดินนี้
              </div>
            )}
          </div>

          {/* Picture if available */}
          {land.picture_f && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2">
                รูปถ่ายแปลงที่ดินภาคสนาม
              </h3>
              <div className="rounded-xl overflow-hidden border border-gray-200 max-h-64 bg-gray-100 flex items-center justify-center">
                <img
                  src={land.picture_f}
                  alt={`แปลงที่ดิน ${land.land_code}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - Larger touch targets on mobile */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-gray-50 border-t border-gray-200 shrink-0 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
          {onOpenRevisionRequest ? (
            <button
              onClick={() => {
                onOpenRevisionRequest(land);
              }}
              className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 border border-amber-300 font-bold text-sm sm:text-xs rounded-xl sm:rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <AlertCircle size={16} /> ทำเรื่องขอแก้ไข / สำรวจใหม่
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-3 sm:py-2 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-700 border border-gray-300 font-medium text-sm sm:text-xs rounded-xl sm:rounded-lg transition text-center"
            >
              ปิดหน้าต่าง
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenTaxInvoice(land);
              }}
              className="px-4 py-3 sm:py-2 bg-govblue-800 hover:bg-govblue-900 active:bg-govblue-950 text-white font-bold text-sm sm:text-xs rounded-xl sm:rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <Printer size={16} /> พิมพ์ใบแจ้งการ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
