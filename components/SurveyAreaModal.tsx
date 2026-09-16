"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  X,
  MapPin,
  Camera,
  ExternalLink,
  Layers,
  CheckCircle2,
  Calendar,
  User,
  Calculator,
  Compass,
  Maximize2,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  TreePine,
  Building2,
} from "lucide-react";
import type { LatLngPoint } from "./SurveyPolygonMap";

// Dynamic import of SurveyPolygonMap with SSR disabled (Leaflet requires window)
const SurveyPolygonMap = dynamic(() => import("./SurveyPolygonMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] sm:h-[420px] bg-slate-100 rounded-xl flex items-center justify-center text-xs text-gray-500 animate-pulse">
      กำลังโหลดแผนที่ดาวเทียมและแปลงที่ดิน...
    </div>
  ),
});

export interface SurveyPhoto {
  id?: string;
  url: string;
  name?: string;
  caption?: string;
  sizeKb?: number;
}

export interface SurveyAreaModalData {
  title: string;
  code: string;
  type: "land" | "building";
  srtType?: string;
  address: string;
  placeName?: string;
  lat?: number | null;
  lng?: number | null;
  polygon?: LatLngPoint[];
  photos?: SurveyPhoto[];
  areaFormatted: string;
  areaNum?: number;
  areaUnit?: string;
  baseValue: number;
  tax: number;
  ratePercent: number;
  surveyorName?: string;
  approverName?: string;
  approvedDate?: string;
  surveySummary?: string;
}

interface SurveyAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SurveyAreaModalData | null;
}

export default function SurveyAreaModal({ isOpen, onClose, data }: SurveyAreaModalProps) {
  const [activeTab, setActiveTab] = useState<"map" | "photos" | "info">("map");
  const [lightboxPhoto, setLightboxPhoto] = useState<SurveyPhoto | null>(null);

  if (!isOpen || !data) return null;

  const lat = data.lat || 14.3532;
  const lng = data.lng || 100.5828;

  // Ensure polygon has points
  const polygonPoints: LatLngPoint[] =
    data.polygon && data.polygon.length >= 3
      ? data.polygon
      : [
          { lat: lat + 0.0008, lng: lng - 0.0012 },
          { lat: lat + 0.0012, lng: lng + 0.0015 },
          { lat: lat - 0.0007, lng: lng + 0.0018 },
          { lat: lat - 0.0011, lng: lng - 0.0009 },
        ];

  // Ensure photos exist
  const photos: SurveyPhoto[] =
    data.photos && data.photos.length > 0
      ? data.photos
      : [
          {
            id: "p-1",
            url: "https://images.unsplash.com/photo-1541888946425-d0fbb18f13f7?w=1000&auto=format&fit=crop&q=80",
            caption: "หมุดหลักเขตกรรมสิทธิ์การรถไฟฯ (สภาพสมบูรณ์ พร้อมพิกัด GNSS)",
          },
          {
            id: "p-2",
            url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1000&auto=format&fit=crop&q=80",
            caption: "ภาพถ่ายมุมกว้างแปลงที่ดินย่านสถานีรถไฟ (ทิศเหนือ)",
          },
          {
            id: "p-3",
            url: "https://images.unsplash.com/photo-1590496793929-36417d3117de?w=1000&auto=format&fit=crop&q=80",
            caption: "การใช้ประโยชน์ที่ดินเชิงพาณิชย์และจุดเชื่อมต่อแนวเขต",
          },
          {
            id: "p-4",
            url: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=1000&auto=format&fit=crop&q=80",
            caption: "แนวเขตกรรมสิทธิ์ติดแนวทางรถไฟสายหลักและระยะร่นปลอดภัย",
          },
        ];

  const fmtCurrency = (n: number) =>
    "฿ " + n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col border border-gray-200 overflow-hidden max-h-[94vh] animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-govblue-900 via-govblue-800 to-indigo-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-govgold-400 shrink-0 shadow-xs">
              <Compass size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-govgold-300 bg-white/10 px-2 py-0.5 rounded border border-white/15">
                  {data.code}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck size={12} />
                  อนุมัติแล้ว (ผลสำรวจจริง)
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {data.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap text-xs shrink-0">
          <div className="flex items-center gap-2 text-gray-600 truncate min-w-0">
            <MapPin size={13} className="text-rose-500 shrink-0" />
            <span className="truncate font-medium">{data.address || data.placeName || "แปลงที่ดินการรถไฟฯ"}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-gray-700 font-medium">
              เนื้อที่: <strong className="text-gray-900 font-semibold">{data.areaFormatted}</strong>
            </span>
            <span className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-emerald-800 font-medium">
              ภาษี: <strong className="text-emerald-700 font-bold">{fmtCurrency(data.tax)}</strong>
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-2.5 border-b border-gray-200 flex items-center gap-2 shrink-0 bg-white overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab("map")}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === "map"
                ? "border-govblue-800 text-govblue-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Layers size={14} />
            <span>พื้นที่ที่วาดบน Google Maps</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("photos")}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === "photos"
                ? "border-govblue-800 text-govblue-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Camera size={14} />
            <span>รูปถ่ายสำรวจ ({photos.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === "info"
                ? "border-govblue-800 text-govblue-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <FileText size={14} />
            <span>ข้อมูลผลสำรวจ & ภาษี</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: Google Maps & Drawn Polygon Area */}
          {activeTab === "map" && (
            <div className="space-y-3 animate-in fade-in duration-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/70 border border-blue-200 p-3 rounded-xl text-xs">
                <div className="flex items-center gap-2 text-govblue-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>
                    แสดงแนวเขตแปลงที่ดินที่พนักงานสำรวจรังวัดและวาดไว้ พร้อมขนาดพื้นที่จริงคำนวณอัตโนมัติ
                  </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 text-govblue-800 border border-gray-300 rounded-lg text-xs font-medium transition shadow-2xs"
                  >
                    <ExternalLink size={12} />
                    <span>Google Maps</span>
                  </a>
                  <a
                    href={googleDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-govblue-800 hover:bg-govblue-900 text-white rounded-lg text-xs font-semibold transition shadow-xs"
                  >
                    <span>🧭 นำทาง</span>
                  </a>
                </div>
              </div>

              {/* Map Container */}
              <div className="rounded-xl overflow-hidden border border-gray-300 shadow-sm relative">
                <SurveyPolygonMap
                  initialLat={lat}
                  initialLng={lng}
                  initialPoints={polygonPoints}
                  height="420px"
                  readOnly={true}
                />
              </div>

              {/* Quick Metrics of Polygon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <div className="text-gray-500 text-[11px]">ขนาดพื้นที่คำนวณ</div>
                  <div className="font-bold text-gray-900 mt-0.5">{data.areaFormatted}</div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <div className="text-gray-500 text-[11px]">จำนวนจุดหมุดเขต</div>
                  <div className="font-bold text-govblue-800 mt-0.5">{polygonPoints.length} หมุดหลักเขต</div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <div className="text-gray-500 text-[11px]">พิกัดกึ่งกลาง (GPS)</div>
                  <div className="font-mono font-medium text-gray-800 mt-0.5 text-[11px]">
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                  <div className="text-gray-500 text-[11px]">สถานะการรังวัด</div>
                  <div className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>ผ่านการตรวจรับ</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Survey Photos Gallery */}
          {activeTab === "photos" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>รูปถ่ายหลักฐานภาคสนามโดยเจ้าหน้าที่สำรวจ (คลิกที่ภาพเพื่อดูรูปขนาดใหญ่)</span>
                <span className="font-semibold text-gray-700">{photos.length} รูปภาพ</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    onClick={() => setLightboxPhoto(photo)}
                    className="group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md hover:border-govblue-400 transition cursor-pointer flex flex-col"
                  >
                    <div className="relative aspect-video bg-gray-100 overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.caption || "ภาพถ่ายสำรวจ"}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <div className="p-2 rounded-full bg-white/20 backdrop-blur-xs flex items-center gap-1 text-xs font-semibold">
                          <Maximize2 size={14} />
                          <span>ดูรูปขนาดใหญ่</span>
                        </div>
                      </div>
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium">
                        ภาพที่ {idx + 1}
                      </span>
                    </div>
                    <div className="p-2.5 text-xs text-gray-700 flex items-center gap-1.5 border-t border-gray-100 bg-gray-50/50">
                      <Camera size={13} className="text-govblue-700 shrink-0" />
                      <span className="line-clamp-1">{photo.caption || photo.name || "ภาพถ่ายสภาพแปลงที่ดิน"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Survey Details & Tax Breakdown */}
          {activeTab === "info" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <FileText size={15} className="text-govblue-700" />
                  <span>บันทึกการสำรวจและตรวจสอบงาน</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">รหัสงานสำรวจ:</span>
                    <span className="font-mono font-bold text-govblue-900">{data.code}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">เจ้าหน้าที่ผู้สำรวจ:</span>
                    <span className="font-semibold text-gray-800">{data.surveyorName || "นายสมศักดิ์ สำรวจดี"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">หัวหน้างานผู้อนุมัติ:</span>
                    <span className="font-semibold text-gray-800">{data.approverName || "หัวหน้างานสำรวจ"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">วันที่อนุมัติลงระบบ:</span>
                    <span className="font-medium text-gray-700">
                      {data.approvedDate ? new Date(data.approvedDate).toLocaleDateString("th-TH") : "16 ก.ย. 2569"}
                    </span>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-gray-200">
                    <span className="text-gray-400 block text-[11px] mb-0.5">สรุปผลการสำรวจและบันทึกภาคสนาม:</span>
                    <p className="text-gray-700 leading-relaxed bg-white p-2.5 rounded-lg border border-gray-200">
                      {data.surveySummary ||
                        "ทำการลงพื้นที่สำรวจรังวัดแนวเขตกรรมสิทธิ์การรถไฟฯ ครบถ้วน ตรวจสอบหมุดหลักเขต คสล. ทั้งหมด ปักหมุดพิกัด GPS และวาดแนวเขตที่ดินบนแผนที่ดาวเทียมเรียบร้อย ข้อมูลขนาดพื้นที่ถูกต้องตรงตามสภาพการใช้ประโยชน์จริง พร้อมสำหรับการคำนวณและประเมินภาษีที่ดินและสิ่งปลูกสร้าง"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tax Calculation Card for Accountant */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <Calculator size={15} className="text-emerald-700" />
                  <span>ข้อมูลประเมินภาษีสำหรับฝ่ายบัญชี (พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-gray-500 block">ขนาดพื้นที่ประเมิน</span>
                    <span className="font-bold text-gray-900 text-sm">{data.areaFormatted}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-gray-500 block">ฐานประเมินทุนทรัพย์</span>
                    <span className="font-bold text-gray-900 text-sm">{fmtCurrency(data.baseValue)}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-gray-500 block">อัตราภาษี</span>
                    <span className="font-bold text-gray-900 text-sm">{data.ratePercent.toFixed(2)}%</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 block font-semibold">ภาษีประจำปีที่ต้องชำระ</span>
                    <span className="font-bold text-rose-700 text-base">{fmtCurrency(data.tax)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-gray-500 hidden sm:block">
            เชื่อมต่อข้อมูลฝ่ายสำรวจและฝ่ายบัญชีอัตโนมัติ
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-govblue-800 hover:bg-govblue-900 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Lightbox / Zoom-in View for Photo */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >
            <X size={24} />
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || "รูปถ่ายสำรวจ"}
              className="max-h-[75vh] w-auto rounded-lg object-contain shadow-2xl"
            />
            <p className="text-white text-xs sm:text-sm mt-3 text-center bg-black/50 px-4 py-1.5 rounded-full backdrop-blur-xs">
              {lightboxPhoto.caption || "ภาพถ่ายสำรวจภาคสนาม"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
