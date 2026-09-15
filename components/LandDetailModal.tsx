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
} from "lucide-react";
import { LandParcel } from "@/lib/api";
import { calculateLandTax, formatCurrency } from "@/lib/tax";
import MapPicker from "@/components/MapPicker";

interface LandDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  land: LandParcel | null;
  onOpenTaxInvoice: (land: LandParcel) => void;
  onOpenRevisionRequest: (land: LandParcel) => void;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-6 flex flex-col border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-govblue-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-govblue-800 rounded-lg text-govgold-400">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>แปลงที่ดิน: {land.land_code}</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-govblue-800 text-govgold-300 border border-govgold-500/30">
                  {land.srt_land_type || "ที่ดิน รฟท."}
                </span>
              </h2>
              <p className="text-xs text-govblue-200">
                เลขที่โฉนด: {land.deed_no || "-"} • ประเภทเอกสารสิทธิ์: {land.land_type || "โฉนด"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh] text-xs sm:text-sm">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">เนื้อที่รวม</span>
              <span className="text-base font-bold text-gray-900">
                {rai} ไร่ {ngan} งาน {wa} วา
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                ({tax.totalWah.toLocaleString()} ตร.ว. / {tax.totalSqm.toLocaleString()} ตร.ม.)
              </span>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">ขนาดกว้าง × ยาว</span>
              <span className="text-base font-bold text-gray-900">
                {land.width && land.length ? `${land.width} × ${land.length} ม.` : "ไม่ระบุ"}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">ระยะหน้ากว้างและลึก</span>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">การใช้ประโยชน์</span>
              <span className="text-sm font-bold text-govblue-900 truncate block mt-0.5">
                {land.land_use || "ทั่วไป"}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium block">
                {tax.useType}
              </span>
            </div>
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <span className="text-[11px] text-emerald-700 block font-medium">ภาษีประเมินปี 69</span>
              <span className="text-base font-black text-emerald-700">
                ฿{tax.formattedTaxPayable}
              </span>
              <span className="text-[10px] text-emerald-600 block">อัตรา {tax.taxRatePercent}%</span>
            </div>
          </div>

          {/* Tax Assessment Summary Box */}
          <div className="p-4 bg-govblue-50/60 border border-govblue-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-govblue-900 flex items-center gap-1.5">
                <FileText size={15} /> สรุปการประเมินภาษีที่ดิน (พ.ร.บ. ภาษีที่ดินฯ 2562)
              </h3>
              <button
                onClick={() => {
                  onClose();
                  onOpenTaxInvoice(land);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-govblue-800 hover:text-govblue-950 underline"
              >
                <Printer size={13} /> ดูใบกำกับภาษีฉบับเต็ม →
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
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

          {/* Location & GPS Map */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
              <MapPin size={15} className="text-rose-500" /> พิกัดและแผนที่ตำแหน่งที่ดิน (Location Map)
            </h3>
            {land.lat && land.lng ? (
              <div className="space-y-2">
                <div className="h-56 rounded-xl overflow-hidden border border-gray-200 shadow-2xs">
                  <MapPicker
                    lat={land.lat}
                    lng={land.lng}
                    readOnly={true}
                    height="224px"
                    showInputs={false}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                  <span>
                    พิกัด GPS: <strong className="font-mono text-gray-700">{land.lat.toFixed(6)}, {land.lng.toFixed(6)}</strong>
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${land.lat},${land.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-govblue-600 hover:underline flex items-center gap-1"
                  >
                    เปิดใน Google Maps ↗
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

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              onOpenRevisionRequest(land);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <AlertCircle size={14} /> สร้างคำร้องขอแก้ไข / ตรวจสอบ
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-medium text-xs rounded-lg transition"
            >
              ปิดหน้าต่าง
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenTaxInvoice(land);
              }}
              className="flex-1 sm:flex-initial px-5 py-2 bg-govblue-800 hover:bg-govblue-900 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <Printer size={15} /> พิมพ์ใบแจ้งการประเมินภาษี
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
