"use client";

import React, { useState } from "react";
import {
  X,
  Building2,
  Layers,
  FileText,
  Printer,
  AlertCircle,
  ImageIcon,
  CheckCircle2,
  Calendar,
  MapPin,
} from "lucide-react";
import { Building } from "@/lib/api";
import { calculateBuildingTax, formatCurrency, formatFullAddress } from "@/lib/tax";

interface BuildingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: Building | null;
  onOpenTaxInvoice: (bldg: Building) => void;
  onOpenRevisionRequest?: (bldg: Building) => void;
}

export default function BuildingDetailModal({
  isOpen,
  onClose,
  building,
  onOpenTaxInvoice,
  onOpenRevisionRequest,
}: BuildingDetailModalProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!isOpen || !building) return null;

  const tax = calculateBuildingTax(building);

  const photos = [
    { label: "ด้านหน้า (Front)", url: building.picture_f },
    { label: "ด้านหลัง (Back)", url: building.picture_b },
    { label: "ด้านขวา (Right)", url: building.picture_r },
    { label: "ด้านซ้าย (Left)", url: building.picture_l },
  ].filter((p) => Boolean(p.url));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-6 flex flex-col border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-govblue-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-govblue-800 rounded-lg text-govgold-400">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>สิ่งปลูกสร้าง: {building.bldg_code}</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-govblue-800 text-govgold-300 border border-govgold-500/30">
                  {building.num_fl} ชั้น
                </span>
              </h2>
              <p className="text-xs text-govblue-200">
                {building.name} • ตั้งอยู่บนแปลงที่ดิน: {building.land_code || "ไม่ระบุ"}
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
              <span className="text-[11px] text-gray-500 block">จำนวนชั้นและพื้นที่</span>
              <span className="text-base font-bold text-gray-900">
                {building.num_fl} ชั้น
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                พื้นที่ใช้สอย {tax.totalUsableSqm.toLocaleString()} ตร.ม.
              </span>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">โครงสร้างและวัสดุ</span>
              <span className="text-sm font-bold text-gray-900 truncate block mt-0.5">
                {building.material_type || "คอนกรีตเสริมเหล็ก"}
              </span>
              <span className="text-[10px] text-gray-400 block">แบบ 69: {building.bldg_69 || "-"}</span>
            </div>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-[11px] text-gray-500 block">อายุและสภาพอาคาร</span>
              <span className="text-sm font-bold text-gray-900 block mt-0.5">
                สภาพ: {building.bld_condition_type || "ดี"}
              </span>
              <span className="text-[10px] text-gray-400 block">
                อายุ: {building.age ? `${building.age} ปี` : "-"} (สร้าง พ.ศ. {building.be_age || "-"})
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
                <FileText size={15} /> สรุปการประเมินภาษีสิ่งปลูกสร้าง (พ.ร.บ. ภาษีที่ดินฯ 2562)
              </h3>
              <button
                onClick={() => {
                  onClose();
                  onOpenTaxInvoice(building);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-govblue-800 hover:text-govblue-950 underline"
              >
                <Printer size={13} /> ดูใบกำกับภาษีฉบับเต็ม →
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-500">ราคาประเมินสิ่งปลูกสร้าง:</span>
                <p className="font-semibold text-gray-900">
                  ฿{tax.appraisalPerSqm.toLocaleString()} / ตร.ม.
                </p>
              </div>
              <div>
                <span className="text-gray-500">มูลค่าฐานภาษีรวม:</span>
                <p className="font-bold text-govblue-900 font-mono">
                  ฿{tax.formattedBaseValue}
                </p>
              </div>
              <div>
                <span className="text-gray-500">ค่าภาษีอาคารที่ต้องชำระ:</span>
                <p className="font-bold text-emerald-700 font-mono text-sm">
                  ฿{tax.formattedTaxPayable}
                </p>
              </div>
            </div>
          </div>

          {/* Address & Location Card */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <MapPin size={15} className="text-rose-600" /> ที่อยู่และสถานที่ตั้งอาคาร (Address & Location)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">เลขที่/อาคาร/ห้อง</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {building.address_no || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">ตำบล/แขวง</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {building.subdistrict || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">อำเภอ/เขต</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {building.district || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 block">จังหวัด</span>
                <span className="font-semibold text-gray-800 truncate block">
                  {building.province || "-"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-gray-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-gray-400 block">รหัสไปรษณีย์</span>
                <span className="font-bold font-mono text-govblue-900 truncate block">
                  {building.postal_code || "-"}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-gray-600 pt-1 flex items-center gap-1">
              <span className="text-gray-400">ที่อยู่เต็ม:</span>
              <span className="font-medium text-gray-800">{formatFullAddress(building)}</span>
            </div>
          </div>

          {/* Floors Breakdown Table */}
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
              <Layers size={15} className="text-govblue-600" /> รายละเอียดการใช้ประโยชน์รายชั้น (Floors Breakdown)
            </h3>
            {building.floors && building.floors.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                    <tr>
                      <th className="p-2.5 text-center w-14">ชั้นที่</th>
                      <th className="p-2.5">การใช้ประโยชน์ (Usage)</th>
                      <th className="p-2.5 text-right">พื้นที่ (ตร.ม.)</th>
                      <th className="p-2.5 text-right">ขนาด กว้าง × ยาว</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {building.floors.map((fl) => (
                      <tr key={fl.floor_number} className="hover:bg-gray-50">
                        <td className="p-2.5 text-center font-bold text-govblue-800">
                          {fl.floor_number}
                        </td>
                        <td className="p-2.5 text-gray-800 font-medium">
                          {fl.bldg_use || "สำนักงาน / บริการ"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-gray-900">
                          {fl.dim ? `${fl.dim.toLocaleString()} ตร.ม.` : "-"}
                        </td>
                        <td className="p-2.5 text-right text-gray-500 font-mono">
                          {fl.width && fl.length ? `${fl.width} × ${fl.length} ม.` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-center">
                ไม่ได้ระบุรายละเอียดรายชั้นแยกเฉพาะ (คิดพื้นที่รวม {tax.totalUsableSqm.toLocaleString()} ตร.ม.)
              </div>
            )}
          </div>

          {/* Photos Section */}
          {photos.length > 0 && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2 flex items-center gap-1.5">
                <ImageIcon size={15} /> รูปถ่ายสภาพสิ่งปลูกสร้าง (4 ทิศทาง)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPhoto(p.url)}
                    className="border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition bg-gray-50 flex flex-col"
                  >
                    <div className="h-28 bg-gray-200 flex items-center justify-center overflow-hidden">
                      <img
                        src={p.url}
                        alt={p.label}
                        className="w-full h-full object-cover hover:scale-105 transition duration-200"
                      />
                    </div>
                    <span className="p-2 text-[11px] text-gray-700 font-medium text-center truncate">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo Preview Modal if clicked */}
          {selectedPhoto && (
            <div
              className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setSelectedPhoto(null)}
            >
              <div className="relative max-w-2xl max-h-[80vh] bg-white rounded-xl overflow-hidden p-2">
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute top-3 right-3 p-1.5 bg-black/60 text-white rounded-full hover:bg-black"
                >
                  <X size={16} />
                </button>
                <img
                  src={selectedPhoto}
                  alt="รูปขยาย"
                  className="max-h-[75vh] w-auto object-contain rounded-lg mx-auto"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {onOpenRevisionRequest ? (
            <button
              onClick={() => {
                onOpenRevisionRequest(building);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <AlertCircle size={14} /> ทำเรื่องขอแก้ไข / สำรวจใหม่
            </button>
          ) : (
            <div />
          )}

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
                onOpenTaxInvoice(building);
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
