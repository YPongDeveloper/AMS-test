"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, Tag } from "@/components/ui";
import MapPicker from "@/components/MapPicker";
import { useI18n } from "@/lib/i18n";
import {
  fetchLands,
  createLand,
  updateLand,
  deleteLand,
  type LandParcel,
  getCurrentUser,
  createRevisionRequest,
} from "@/lib/api";
import {
  Camera,
  MapPin,
  Save,
  X,
  Plus,
  Search,
  Edit2,
  Trash2,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Printer,
  Receipt,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import LandDetailModal from "@/components/LandDetailModal";
import TaxInvoiceModal from "@/components/TaxInvoiceModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  calculateLandTax,
  calculateLandTotalWah,
  formatCurrency,
  formatShortAddress,
  formatFullAddress,
} from "@/lib/tax";

export default function LandPage() {
  const { t } = useI18n();
  const [view, setView] = useState<"list" | "form">("list");
  const [detailLand, setDetailLand] = useState<LandParcel | null>(null);
  const [taxInvoiceLand, setTaxInvoiceLand] = useState<LandParcel | null>(null);
  const [lands, setLands] = useState<LandParcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "green" | "red" } | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [landCode, setLandCode] = useState("");
  const [srtLandType, setSrtLandType] = useState("");
  const [landUse, setLandUse] = useState("");
  const [landType, setLandType] = useState("");
  const [deedNo, setDeedNo] = useState("");
  const [addressNo, setAddressNo] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [rai, setRai] = useState<number | "">(2);
  const [ngan, setNgan] = useState<number | "">(1);
  const [wa, setWa] = useState<number | "">(50);
  const [width, setWidth] = useState<number | "">("");
  const [length, setLength] = useState<number | "">("");
  const [pictureF, setPictureF] = useState("");
  const [lat, setLat] = useState<number | null>(13.7563);
  const [lng, setLng] = useState<number | null>(100.5018);
  const [gpsLocked, setGpsLocked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = getCurrentUser();

  // Confirmation Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ publicId: string; code: string } | null>(null);

  // Request Modal State (สำหรับพนักงานบัญชีสร้างคำร้องขอแก้ไข / สำรวจใหม่)
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqLandId, setReqLandId] = useState("");
  const [reqLandCode, setReqLandCode] = useState("");
  const [reqType, setReqType] = useState<"revision" | "survey_new">("revision");
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqSending, setReqSending] = useState(false);
  const [reqSearch, setReqSearch] = useState("");

  const openRequestModal = (l?: LandParcel) => {
    if (l) {
      setReqLandId(l.public_id);
      setReqLandCode(l.land_code);
    } else if (lands.length > 0) {
      setReqLandId(lands[0].public_id);
      setReqLandCode(lands[0].land_code);
    } else {
      setReqLandId("");
      setReqLandCode("");
    }
    setReqSearch("");
    setReqType("revision");
    setReqRemarks("");
    setRequestModalOpen(true);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqRemarks.trim()) {
      alert("กรุณาระบุรายละเอียดหรือหมายเหตุคำร้อง");
      return;
    }
    setReqSending(true);
    try {
      await createRevisionRequest({
        target_type: "land",
        target_id: reqLandId || undefined,
        target_code: reqLandCode || undefined,
        request_type: reqType,
        remarks: reqRemarks.trim(),
      });
      setRequestModalOpen(false);
      setDetailLand(null);
      setMsg({
        text: `สร้างคำร้องขอแก้ไข/ตรวจสอบแปลงที่ดิน "${reqLandCode || "ทั่วไป"}" สำเร็จ (ส่งไปยังหัวหน้างานในหน้าสั่งงานแล้ว)`,
        tone: "green",
      });
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการส่งคำร้อง");
    } finally {
      setReqSending(false);
    }
  };

  const loadData = async (q?: string) => {
    setLoading(true);
    try {
      const data = await fetchLands(q);
      setLands(data);
    } catch (e) {
      console.error(e);
      setMsg({ text: "ไม่สามารถดึงข้อมูลแปลงที่ดินได้", tone: "red" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(search);
  }, [search]);

  const landTaxStats = useMemo(() => {
    let totalWah = 0;
    let totalBaseValue = 0;
    let totalTaxPayable = 0;

    lands.forEach((l) => {
      const tx = calculateLandTax(l);
      totalWah += tx.totalWah;
      totalBaseValue += tx.baseValue;
      totalTaxPayable += tx.taxPayable;
    });

    const totalRai = Math.floor(totalWah / 400);
    const remainingAfterRai = totalWah % 400;
    const totalNgan = Math.floor(remainingAfterRai / 100);
    const totalWa = remainingAfterRai % 100;

    return {
      totalWah,
      totalBaseValue,
      totalTaxPayable,
      totalAreaFormatted: `${totalRai} ไร่ ${totalNgan} งาน ${totalWa} วา`,
      formattedBaseValue: formatCurrency(totalBaseValue),
      formattedTaxPayable: formatCurrency(totalTaxPayable),
    };
  }, [lands]);

  const handleExportLandTaxCSV = () => {
    const headers = [
      "รหัสที่ดิน (Land_Code)",
      "เลขที่โฉนด",
      "ประเภทที่ดิน",
      "การใช้ประโยชน์",
      "สถานที่ตั้ง/เลขที่",
      "ตำบล/แขวง",
      "อำเภอ/เขต",
      "จังหวัด",
      "รหัสไปรษณีย์",
      "ที่อยู่เต็ม",
      "เนื้อที่ (ไร่-งาน-วา)",
      "เนื้อที่รวม (ตร.ว.)",
      "ราคาประเมินต่อ ตร.ว. (บาท)",
      "มูลค่าฐานภาษี (บาท)",
      "อัตราภาษี (%)",
      "ภาษีที่ต้องชำระ (บาท)",
    ];
    const rows = lands.map((l) => {
      const tx = calculateLandTax(l);
      const r = l.rai ?? 0;
      const n = l.ngan ?? 0;
      const w = l.wa ?? 0;
      return [
        `"${l.land_code}"`,
        `"${l.deed_no || "-"}"`,
        `"${l.srt_land_type || "-"}"`,
        `"${l.land_use || "-"}"`,
        `"${l.address_no || "-"}"`,
        `"${l.subdistrict || "-"}"`,
        `"${l.district || "-"}"`,
        `"${l.province || "-"}"`,
        `"${l.postal_code || "-"}"`,
        `"${formatFullAddress(l)}"`,
        `"${r}-${n}-${w}"`,
        tx.totalWah,
        tx.appraisalPerWah,
        tx.baseValue,
        `${tx.taxRatePercent}%`,
        tx.taxPayable,
      ].join(",");
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ตารางภาษีที่ดินรายแปลง_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setEditingId(null);
    setLandCode(`LP-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`);
    setSrtLandType("ที่ดินสถานี");
    setLandUse("ใช้เพื่อการขนส่ง");
    setLandType("โฉนด");
    setDeedNo("");
    setAddressNo("");
    setSubdistrict("");
    setDistrict("");
    setProvince("");
    setPostalCode("");
    setRai(1);
    setNgan(0);
    setWa(0);
    setWidth(40.0);
    setLength(100.0);
    setPictureF("");
    setLat(13.7563);
    setLng(100.5018);
    setGpsLocked(false);
  };

  const openCreate = () => {
    resetForm();
    setView("form");
    setMsg(null);
  };

  const openEdit = (l: LandParcel) => {
    setEditingId(l.public_id);
    setLandCode(l.land_code);
    setSrtLandType(l.srt_land_type || "");
    setLandUse(l.land_use || "");
    setLandType(l.land_type || "");
    setDeedNo(l.deed_no || "");
    setAddressNo(l.address_no || "");
    setSubdistrict(l.subdistrict || "");
    setDistrict(l.district || "");
    setProvince(l.province || "");
    setPostalCode(l.postal_code || "");
    if (l.rai !== undefined && l.rai !== null) {
      setRai(l.rai);
      setNgan(l.ngan ?? 0);
      setWa(l.wa ?? 0);
    } else if (l.dimension) {
      const parts = l.dimension.split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        setRai(parts[0]);
        setNgan(parts[1]);
        setWa(parts[2]);
      } else {
        setRai(0);
        setNgan(0);
        setWa(0);
      }
    } else {
      setRai(0);
      setNgan(0);
      setWa(0);
    }
    setWidth(l.width ?? "");
    setLength(l.length ?? "");
    setPictureF(l.picture_f || "");
    setLat(l.lat ?? 13.7563);
    setLng(l.lng ?? 100.5018);
    setGpsLocked(Boolean(l.lat && l.lng));
    setView("form");
    setMsg(null);
  };

  const handleDelete = (publicId: string, code: string) => {
    setDeleteTarget({ publicId, code });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLand(deleteTarget.publicId);
      setMsg({ text: `ลบแปลงที่ดิน "${deleteTarget.code}" สำเร็จ`, tone: "green" });
      loadData(search);
    } catch (e) {
      setMsg({ text: (e as Error).message || "เกิดข้อผิดพลาดในการลบ", tone: "red" });
    } finally {
      setDeleteTarget(null);
    }
  };

  // ดึงพิกัด GPS จริงจากเบราว์เซอร์
  const acquireGPS = () => {
    if (!navigator.geolocation) {
      alert("อุปกรณ์ของคุณไม่รองรับการดึงพิกัด GPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setGpsLocked(true);
      },
      (err) => {
        alert("ไม่สามารถดึงพิกัด GPS ได้: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // จัดการอัปโหลดรูปภาพ
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("ไฟล์รูปภาพมีขนาดเกิน 2MB กรุณาเลือกภาพใหม่");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPictureF(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLandCode = landCode.trim();
    if (!cleanLandCode) {
      alert("กรุณาระบุรหัสแปลงที่ดิน");
      return;
    }

    // ตรวจสอบความซ้ำซ้อนของรหัสแปลงที่ดิน (Uniqueness Check)
    const dupCode = lands.find(
      (l) => l.land_code.trim().toLowerCase() === cleanLandCode.toLowerCase() && l.public_id !== editingId
    );
    if (dupCode) {
      alert(`รหัสแปลงที่ดิน "${cleanLandCode}" มีอยู่ในระบบแล้ว กรุณาระบุรหัสอื่น`);
      return;
    }

    // ตรวจสอบเลขที่โฉนดที่ดินซ้ำ (กรณีมีการระบุ)
    const cleanDeedNo = deedNo.trim();
    if (cleanDeedNo) {
      const dupDeed = lands.find(
        (l) => (l.deed_no || "").trim() === cleanDeedNo && l.public_id !== editingId
      );
      if (dupDeed) {
        alert(`เลขที่โฉนดที่ดิน "${cleanDeedNo}" ซ้ำกับแปลง "${dupDeed.land_code}" ในระบบ`);
        return;
      }
    }

    setSaving(true);

    const r = rai === "" ? 0 : Number(rai);
    const n = ngan === "" ? 0 : Number(ngan);
    const w = wa === "" ? 0 : Number(wa);
    const formattedDimension = `${r}-${n}-${w}`;

    const payload: Partial<LandParcel> = {
      land_code: landCode.trim(),
      srt_land_type: srtLandType,
      land_use: landUse,
      land_type: landType,
      deed_no: deedNo.trim(),
      address_no: addressNo.trim(),
      subdistrict: subdistrict.trim(),
      district: district.trim(),
      province: province.trim(),
      postal_code: postalCode.trim(),
      rai: r,
      ngan: n,
      wa: w,
      dimension: formattedDimension,
      width: width === "" ? null : Number(width),
      length: length === "" ? null : Number(length),
      picture_f: pictureF,
      lat: lat,
      lng: lng,
    };

    try {
      if (editingId) {
        await updateLand(editingId, payload);
        setMsg({ text: `อัปเดตแปลงที่ดิน "${landCode}" สำเร็จ`, tone: "green" });
      } else {
        await createLand(payload);
        setMsg({ text: `บันทึกแปลงที่ดิน "${landCode}" สำเร็จ`, tone: "green" });
      }
      await loadData(search);
      setView("list");
    } catch (e) {
      setMsg({ text: (e as Error).message || "บันทึกไม่สำเร็จ", tone: "red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page allowedRoles={["admin", "accountant"]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <SectionHeader title={t("landTitle")} />
        <div className="flex items-center gap-2">
          {view === "list" ? (
            <div className="flex items-center gap-2">
              <Btn onClick={() => openRequestModal()} className="!bg-govblue-800 !text-white hover:!bg-govblue-900 shadow-sm">
                <AlertCircle size={16} /> สร้างคำร้องขอแก้ไข / ตรวจสอบ
              </Btn>
              {currentUser?.role === "admin" && (
                <Btn onClick={openCreate} className="!bg-govgold-500 !text-govblue-900 hover:!bg-govgold-400">
                  <Plus size={16} /> บันทึกแปลงที่ดินใหม่ (Admin)
                </Btn>
              )}
            </div>
          ) : (
            <Btn variant="secondary" onClick={() => setView("list")}>
              <ArrowLeft size={16} /> กลับหน้ารายการ
            </Btn>
          )}
        </div>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg mb-4 text-sm flex items-center justify-between ${
            msg.tone === "green"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.tone === "green" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      )}

      {view === "list" ? (
        <div className="space-y-4">
          {/* Filter & Action Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="ค้นหารหัสที่ดิน, เลขที่โฉนด, ประเภทที่ดิน, ที่ตั้ง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportLandTaxCSV}
                className="px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download size={14} className="text-govblue-700" /> ส่งออก CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 text-xs font-semibold text-white bg-govblue-800 hover:bg-govblue-900 rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer size={14} /> พิมพ์ตารางภาษี
              </button>
              <Btn variant="secondary" onClick={() => loadData(search)} disabled={loading}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช
              </Btn>
            </div>
          </div>

          {/* Summary Cards for Consolidated Land Tax */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xs">
              <span className="text-xs text-gray-500 block">แปลงที่ดินทั้งหมดในระบบ</span>
              <span className="text-xl font-bold text-gray-900 mt-1 block">
                {lands.length} แปลง
              </span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                เนื้อที่รวม {landTaxStats.totalAreaFormatted} ({landTaxStats.totalWah.toLocaleString()} ตร.ว.)
              </span>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xs">
              <span className="text-xs text-gray-500 block">มูลค่าฐานภาษีประเมินรวมทั้งสิ้น</span>
              <span className="text-xl font-bold text-govblue-900 font-mono mt-1 block">
                ฿{landTaxStats.formattedBaseValue}
              </span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                คิดจากราคาประเมินทุนทรัพย์ที่ดิน
              </span>
            </div>
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs">
              <span className="text-xs text-emerald-800 font-medium block">ประมาณการภาษีที่ดินรวมปี 2569</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
                ฿{landTaxStats.formattedTaxPayable}
              </span>
              <span className="text-[11px] text-emerald-600 block mt-0.5">
                ตามอัตรา พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง
              </span>
            </div>
          </div>

          {/* 1. Desktop Table View (hidden on mobile, visible on md+) */}
          <Card className="hidden md:block overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-900 text-white border-b border-gray-200 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 text-center w-12">ลำดับ</th>
                    <th className="p-3">รหัสที่ดิน</th>
                    <th className="p-3">เลขที่โฉนด</th>
                    <th className="p-3">ประเภทที่ดิน</th>
                    <th className="p-3">การใช้ประโยชน์</th>
                    <th className="p-3 text-right">เนื้อที่ (ไร่-งาน-วา)</th>
                    <th className="p-3 text-right">เนื้อที่รวม (ตร.ว.)</th>
                    <th className="p-3 text-right">ราคาประเมิน/ตร.ว.</th>
                    <th className="p-3 text-right">มูลค่าฐานภาษี</th>
                    <th className="p-3 text-center">อัตราภาษี</th>
                    <th className="p-3 text-right">ภาษีที่ต้องชำระ</th>
                    <th className="p-3 text-center">การจัดการ / ออกเอกสาร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && lands.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-gray-500">
                        กำลังโหลดข้อมูลแปลงที่ดิน...
                      </td>
                    </tr>
                  ) : lands.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-gray-500">
                        ไม่พบข้อมูลแปลงที่ดิน
                      </td>
                    </tr>
                  ) : (
                    lands.map((l, idx) => {
                      const tx = calculateLandTax(l);
                      const r = l.rai ?? (l.dimension ? l.dimension.split("-")[0] : 0);
                      const n = l.ngan ?? (l.dimension ? l.dimension.split("-")[1] : 0);
                      const w = l.wa ?? (l.dimension ? l.dimension.split("-")[2] : 0);
                      return (
                        <tr key={l.public_id} className="hover:bg-emerald-50/40 transition">
                          <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-govblue-900">{l.land_code}</div>
                            {formatShortAddress(l) !== "-" && (
                              <div className="text-[10px] text-gray-500 font-normal">
                                📍 {formatShortAddress(l)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-gray-700">{l.deed_no || "-"}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                              {l.srt_land_type || "แปลงที่ดิน"}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700">{tx.useType}</td>
                          <td className="p-3 text-right text-gray-800">
                            {r} ไร่ {n} งาน {w} วา
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-gray-900">
                            {tx.totalWah.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-600">
                            ฿{tx.appraisalPerWah.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono font-medium text-govblue-900">
                            ฿{tx.formattedBaseValue}
                          </td>
                          <td className="p-3 text-center font-mono">
                            {tx.taxRatePercent}%
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            ฿{tx.formattedTaxPayable}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setDetailLand(l)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-govblue-800 bg-govblue-50 hover:bg-govblue-100 rounded-md border border-govblue-200 transition shadow-2xs"
                                title="ดูรายละเอียดเชิงลึก"
                              >
                                <Eye size={13} /> <span>ดูรายละเอียด</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTaxInvoiceLand(l)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-govblue-800 hover:bg-govblue-900 rounded-md shadow-2xs transition"
                                title="พิมพ์ใบแจ้งการประเมินภาษี / ใบกำกับภาษี"
                              >
                                <Printer size={12} /> <span>พิมพ์ใบภาษี</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openRequestModal(l)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition"
                                title="สร้างคำร้องขอแก้ไขแปลงนี้"
                              >
                                <AlertCircle size={12} /> <span>ขอแก้ไข</span>
                              </button>
                              {currentUser?.role === "admin" && (
                                <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-gray-200">
                                  <button
                                    type="button"
                                    onClick={() => openEdit(l)}
                                    className="p-1 text-govblue-600 hover:bg-govblue-50 rounded"
                                    title="แก้ไข"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(l.public_id, l.land_code)}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                    title="ลบ"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 text-xs">
                  <tr>
                    <td colSpan={5} className="p-3 text-right text-gray-700">
                      รวมทั้งสิ้น ({lands.length} แปลง):
                    </td>
                    <td className="p-3 text-right text-gray-800">
                      {landTaxStats.totalAreaFormatted}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-gray-900">
                      {landTaxStats.totalWah.toLocaleString()} ตร.ว.
                    </td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right font-mono font-bold text-govblue-950">
                      ฿{landTaxStats.formattedBaseValue}
                    </td>
                    <td className="p-3 text-center">-</td>
                    <td className="p-3 text-right font-mono font-black text-emerald-800 text-sm">
                      ฿{landTaxStats.formattedTaxPayable}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="text-xs text-govblue-700 hover:underline font-semibold"
                      >
                        พิมพ์ตารางนี้
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* 2. Mobile Responsive Card View (visible on mobile, hidden on md+) */}
          <div className="md:hidden space-y-3">
            {loading && lands.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
                กำลังโหลดข้อมูลแปลงที่ดิน...
              </div>
            ) : lands.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
                ไม่พบข้อมูลแปลงที่ดิน
              </div>
            ) : (
              lands.map((l, idx) => {
                const tx = calculateLandTax(l);
                const r = l.rai ?? (l.dimension ? l.dimension.split("-")[0] : 0);
                const n = l.ngan ?? (l.dimension ? l.dimension.split("-")[1] : 0);
                const w = l.wa ?? (l.dimension ? l.dimension.split("-")[2] : 0);
                return (
                  <div
                    key={l.public_id}
                    className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-govblue-100 text-govblue-900 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-govblue-900 text-sm block">
                            {l.land_code}
                          </span>
                          {l.deed_no && (
                            <span className="text-[11px] text-gray-500">
                              โฉนด {l.deed_no}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                        {l.srt_land_type || "แปลงที่ดิน"}
                      </span>
                    </div>

                    {/* Location & Details */}
                    <div className="text-xs space-y-1 text-gray-600 bg-gray-50/60 p-2.5 rounded-lg border border-gray-100">
                      {formatShortAddress(l) !== "-" && (
                        <div className="flex items-start gap-1.5 text-gray-700">
                          <span className="text-govblue-600 shrink-0">📍</span>
                          <span className="font-medium">{formatShortAddress(l)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-gray-500">การใช้ประโยชน์:</span>
                        <span className="font-semibold text-gray-800">{tx.useType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">เนื้อที่:</span>
                        <span className="font-semibold text-gray-800">
                          {r} ไร่ {n} งาน {w} วา ({tx.totalWah.toLocaleString()} ตร.ว.)
                        </span>
                      </div>
                    </div>

                    {/* Tax Summary Grid */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 text-[10px] block">ราคาประเมิน/ตร.ว.</span>
                        <span className="font-mono font-medium text-gray-800">
                          ฿{tx.appraisalPerWah.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">อัตราภาษี</span>
                        <span className="font-mono font-medium text-gray-800">
                          {tx.taxRatePercent}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">มูลค่าฐานภาษี</span>
                        <span className="font-mono font-bold text-govblue-900">
                          ฿{tx.formattedBaseValue}
                        </span>
                      </div>
                      <div>
                        <span className="text-emerald-800 text-[10px] font-bold block">
                          ภาษีที่ต้องชำระ
                        </span>
                        <span className="font-mono font-black text-emerald-700 text-sm">
                          ฿{tx.formattedTaxPayable}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setDetailLand(l)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-govblue-800 bg-govblue-50 hover:bg-govblue-100 rounded-lg border border-govblue-200 transition"
                      >
                        <Eye size={13} className="shrink-0" /> <span>ดูรายละเอียด</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxInvoiceLand(l)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-govblue-800 hover:bg-govblue-900 rounded-lg shadow-2xs transition"
                      >
                        <Printer size={13} className="shrink-0" /> <span>พิมพ์ใบภาษี</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openRequestModal(l)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                        title="สร้างคำร้องขอแก้ไข"
                      >
                        <AlertCircle size={13} className="shrink-0" /> <span>ขอแก้ไข</span>
                      </button>
                      {currentUser?.role === "admin" && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(l)}
                            className="p-2 text-govblue-700 hover:bg-govblue-50 rounded-lg border border-gray-200"
                            title="แก้ไข"
                          >
                            <Edit2 size={13} className="shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(l.public_id, l.land_code)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200"
                            title="ลบ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Summary Card */}
            {lands.length > 0 && (
              <div className="p-3 bg-gray-100 rounded-xl border border-gray-200 text-xs space-y-1 text-gray-700 font-medium">
                <div className="flex justify-between">
                  <span>รวมทั้งหมด:</span>
                  <span className="font-bold">{lands.length} แปลง ({landTaxStats.totalWah.toLocaleString()} ตร.ว.)</span>
                </div>
                <div className="flex justify-between">
                  <span>ฐานภาษีรวม:</span>
                  <span className="font-bold font-mono">฿{landTaxStats.formattedBaseValue}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold border-t border-gray-200 pt-1">
                  <span>ภาษีรวมปี 2569:</span>
                  <span className="font-black font-mono text-sm">฿{landTaxStats.formattedTaxPayable}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Form View */
        <form onSubmit={handleSave} className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* GPS & Map Section */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-govblue-700 flex items-center gap-1.5">
                  <MapPin size={16} /> 1. พิกัดภูมิศาสตร์และแผนที่ (GPS & Google Maps)
                </h3>
                <Tag tone={gpsLocked ? "green" : "gold"}>
                  {gpsLocked ? "ระบุพิกัดแล้ว ✓" : "พิกัดตั้งต้น"}
                </Tag>
              </div>

              <MapPicker
                lat={lat}
                lng={lng}
                onChange={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                  setGpsLocked(true);
                }}
                height="280px"
                showInputs={true}
              />
            </Card>

            {/* Land Attributes */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-govblue-700 mb-3">
                2. ข้อมูลแปลงที่ดิน (Attribute Specification)
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="รหัสประจำที่ดิน (Land_Code)" required hint="Text 20">
                  <Input
                    value={landCode}
                    onChange={(e) => setLandCode(e.target.value)}
                    placeholder="เช่น LP-2569-0043"
                    required
                  />
                </Field>
                <Field label="เลขที่โฉนดที่ดิน (Deed_No)" hint="Text 20">
                  <Input
                    value={deedNo}
                    onChange={(e) => setDeedNo(e.target.value)}
                    placeholder="เช่น 12345/2540"
                  />
                </Field>
                <Field label="ประเภทการใช้ประโยชน์ (Land_Type)" hint="Text 50">
                  <Select value={srtLandType} onChange={(e) => setSrtLandType(e.target.value)}>
                    <option value="">— เลือกประเภท —</option>
                    <option value="ที่ดินเชิงพาณิชย์">ที่ดินเชิงพาณิชย์</option>
                    <option value="ที่ดินสถานี">ที่ดินสถานี</option>
                    <option value="ที่ดินเขตทางสัญจร">ที่ดินเขตทางสัญจร</option>
                    <option value="ที่ดินสาธารณูปโภค">ที่ดินสาธารณูปโภค</option>
                    <option value="ที่ดินว่างเปล่า">ที่ดินว่างเปล่า</option>
                  </Select>
                </Field>
                <Field label="ลักษณะการใช้ประโยชน์ (Land_Use)" hint="Text 50">
                  <Select value={landUse} onChange={(e) => setLandUse(e.target.value)}>
                    <option value="">— เลือกลักษณะ —</option>
                    <option value="ใช้เพื่อการขนส่ง">ใช้เพื่อการขนส่ง</option>
                    <option value="ใช้เพื่อการพาณิชย์">ใช้เพื่อการพาณิชย์</option>
                    <option value="ใช้เพื่อที่อยู่อาศัย">ใช้เพื่อที่อยู่อาศัย</option>
                    <option value="ใช้เพื่อการเกษตร">ใช้เพื่อการเกษตร</option>
                    <option value="ยังไม่ได้ใช้ประโยชน์">ยังไม่ได้ใช้ประโยชน์</option>
                  </Select>
                </Field>
                <Field label="ประเภทที่ดิน (Land_Type)" hint="Text 50">
                  <Select value={landType} onChange={(e) => setLandType(e.target.value)}>
                    <option value="">— เลือกเอกสารสิทธิ์ —</option>
                    <option value="โฉนด">โฉนด</option>
                    <option value="น.ส.3">น.ส.3</option>
                    <option value="น.ส.3 ก.">น.ส.3 ก.</option>
                    <option value="ส.ป.ก.">ส.ป.ก.</option>
                    <option value="ที่ดินกรรมสิทธิ์รัฐ">ที่ดินกรรมสิทธิ์รัฐ</option>
                  </Select>
                </Field>
                <div className="sm:col-span-2 bg-govblue-50/50 p-3 rounded-lg border border-govblue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-govblue-900">
                      ขนาดพื้นที่ดิน (ไร่ - งาน - ตารางวา)
                    </span>
                    <span className="text-xs font-mono font-medium text-govblue-700 bg-white px-2.5 py-0.5 rounded border border-govblue-200">
                      รวมคำนวณ: {((rai === "" ? 0 : Number(rai)) * 400 + (ngan === "" ? 0 : Number(ngan)) * 100 + (wa === "" ? 0 : Number(wa))).toLocaleString()} ตร.ว.
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="ไร่ (Rai)" hint="1 ไร่ = 4 งาน">
                      <Input
                        type="number"
                        min="0"
                        value={rai}
                        onChange={(e) => setRai(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="งาน (Ngan)" hint="1 งาน = 100 ตร.ว.">
                      <Input
                        type="number"
                        min="0"
                        max="3"
                        value={ngan}
                        onChange={(e) => setNgan(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="ตารางวา (Tarang Wa)" hint="ทศนิยม 2 ตำแหน่ง">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={wa}
                        onChange={(e) => setWa(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </Field>
                  </div>
                </div>
                <Field label="ความกว้าง (Width)" hint="เมตร (Float 10,2)">
                  <Input
                    type="number"
                    step="0.01"
                    value={width}
                    onChange={(e) => setWidth(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="ความยาว (Length)" hint="เมตร (Float 10,2)">
                  <Input
                    type="number"
                    step="0.01"
                    value={length}
                    onChange={(e) => setLength(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0.00"
                  />
                </Field>
              </div>
            </Card>

            {/* Address Section */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-govblue-700 mb-3 flex items-center gap-1.5">
                <MapPin size={16} /> 3. ข้อมูลที่อยู่และสถานที่ตั้ง (Address & Location)
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field label="เลขที่ / ที่ตั้ง / ถนน / ซอย (Address No.)" hint="เช่น 1 ถนนรองเมือง หรือ 234/12 ซอยพหลโยธิน 18">
                    <Input
                      value={addressNo}
                      onChange={(e) => setAddressNo(e.target.value)}
                      placeholder="เช่น 1 ถนนรองเมือง"
                    />
                  </Field>
                </div>
                <Field label="ตำบล / แขวง (Subdistrict)" hint="เช่น แขวงรองเมือง หรือ ต.ปากช่อง">
                  <Input
                    value={subdistrict}
                    onChange={(e) => setSubdistrict(e.target.value)}
                    placeholder="เช่น แขวงรองเมือง"
                  />
                </Field>
                <Field label="อำเภอ / เขต (District)" hint="เช่น เขตปทุมวัน หรือ อ.ปากช่อง">
                  <Input
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="เช่น เขตปทุมวัน"
                  />
                </Field>
                <Field label="จังหวัด (Province)" hint="เช่น กรุงเทพมหานคร, นครราชสีมา">
                  <Input
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="เช่น กรุงเทพมหานคร"
                  />
                </Field>
                <Field label="รหัสไปรษณีย์ (Postal Code)" hint="5 หลัก เช่น 10330">
                  <Input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="เช่น 10330"
                    maxLength={5}
                  />
                </Field>
              </div>
            </Card>

            {/* Photo Section */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-govblue-700 mb-3">
                4. รูปถ่ายด้านหน้า (Picture_F)
              </h3>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
              {pictureF ? (
                <div className="relative border border-gray-200 rounded-lg overflow-hidden max-h-60 flex items-center justify-center bg-black/5">
                  <img src={pictureF} alt="รูปถ่ายด้านหน้า" className="max-h-60 object-contain" />
                  <button
                    type="button"
                    onClick={() => setPictureF("")}
                    className="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-full shadow hover:bg-rose-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-govblue-400 rounded-lg p-6 text-center bg-gray-50 cursor-pointer transition"
                >
                  <Camera className="mx-auto text-gray-400" size={28} />
                  <div className="text-xs text-gray-500 mt-2">แตะเพื่อถ่ายรูปหรือเลือกไฟล์ภาพจากเครื่อง</div>
                  <Btn type="button" className="mt-3">
                    <Camera size={14} /> อัปโหลดรูปภาพ
                  </Btn>
                </div>
              )}
            </Card>

            {/* Submit buttons */}
            <div className="flex gap-2 justify-end">
              <Btn type="button" variant="secondary" onClick={() => setView("list")}>
                <X size={14} /> ยกเลิก
              </Btn>
              <Btn type="submit" disabled={saving}>
                <Save size={14} /> {saving ? "กำลังบันทึก..." : editingId ? "อัปเดตข้อมูล" : "บันทึกข้อมูล"}
              </Btn>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-3">
            <Card className="p-4 bg-govblue-900 text-white">
              <h4 className="text-xs uppercase tracking-wider text-govgold-400 font-semibold mb-2">
                คุณลักษณะชั้นข้อมูลที่ดิน
              </h4>
              <p className="text-xs text-blue-100 leading-relaxed">
                ตามข้อกำหนดระบบสารสนเทศภูมิศาสตร์และการคำนวณภาษี รหัสและขนาดพื้นที่ที่บันทึกจะถูกนำไปเชื่อมโยงกับสิ่งปลูกสร้างและคำนวณภาษีประจำปีอัตโนมัติ
              </p>
            </Card>

            <Card className="p-3">
              <h4 className="text-xs font-semibold text-govblue-700 mb-2">ผู้บันทึกข้อมูล</h4>
              <div className="text-xs space-y-1">
                <div className="font-medium text-gray-800">{currentUser?.display_name || "เจ้าหน้าที่สำรวจ"}</div>
                <div className="text-gray-500">สิทธิ์: {currentUser?.role || "ผู้สำรวจ"}</div>
                <div className="text-gray-400 text-[11px] pt-1">
                  วันที่: {new Date().toLocaleDateString("th-TH")}
                </div>
              </div>
            </Card>
          </div>
        </form>
      )}

      {/* Modal: สร้างคำร้องขอแก้ไข/ตรวจสอบสำหรับฝ่ายบัญชี */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-govblue-800 font-bold text-base">
                <AlertCircle size={20} className="text-amber-500" />
                <span>สร้างคำร้องขอแก้ไข / ตรวจสอบแปลงที่ดิน</span>
              </div>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  แปลงที่ดินที่ต้องการให้ตรวจสอบ
                </label>
                <div className="relative mb-1.5">
                  <Search className="absolute left-2.5 top-2 text-gray-400" size={13} />
                  <input
                    type="text"
                    placeholder="พิมพ์ค้นหารหัสแปลง, โฉนด, ประเภทที่ดินเพื่อกรองตัวเลือก..."
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-govblue-500 focus:outline-none"
                  />
                </div>
                <select
                  value={reqLandId}
                  onChange={(e) => {
                    const sel = lands.find((x) => x.public_id === e.target.value);
                    setReqLandId(e.target.value);
                    setReqLandCode(sel ? sel.land_code : "");
                  }}
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
                >
                  <option value="">— ไม่ระบุแปลงเฉพาะเจาะจง (งานทั่วไป) —</option>
                  {lands
                    .filter((l) => {
                      if (!reqSearch.trim()) return true;
                      const q = reqSearch.toLowerCase();
                      return (
                        l.land_code.toLowerCase().includes(q) ||
                        (l.deed_no && l.deed_no.toLowerCase().includes(q)) ||
                        (l.srt_land_type && l.srt_land_type.toLowerCase().includes(q)) ||
                        (l.subdistrict && l.subdistrict.toLowerCase().includes(q)) ||
                        (l.province && l.province.toLowerCase().includes(q))
                      );
                    })
                    .map((l) => (
                      <option key={l.public_id} value={l.public_id}>
                        {l.land_code} {l.deed_no ? `(โฉนด ${l.deed_no})` : ""} - {l.srt_land_type || "แปลงที่ดิน"}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ประเภทคำร้อง
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReqType("revision")}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left transition ${
                      reqType === "revision"
                        ? "border-govblue-600 bg-blue-50/60 text-govblue-900 ring-2 ring-govblue-500/20"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="font-semibold">ขอแก้ไขข้อมูลเดิม</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">ข้อมูลผิดพลาด, ขนาดไม่ตรง</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReqType("survey_new")}
                    className={`p-2.5 rounded-lg border text-xs font-medium text-left transition ${
                      reqType === "survey_new"
                        ? "border-govblue-600 bg-blue-50/60 text-govblue-900 ring-2 ring-govblue-500/20"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="font-semibold">ขอให้ลงสำรวจใหม่</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">วัดแนวเขตใหม่, สำรวจภาคสนาม</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  รายละเอียด / หมายเหตุคำร้อง <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reqRemarks}
                  onChange={(e) => setReqRemarks(e.target.value)}
                  placeholder="ระบุสิ่งที่พบ เช่น เนื้อที่ดินในระบบไม่ตรงกับเอกสารสิทธิ์โฉนด หรือขอให้วัดพิกัดแนวเขตใหม่..."
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  คำร้องนี้จะถูกส่งไปยังหน้าสั่งงานของหัวหน้างาน เพื่อให้หัวหน้าพิจารณาสั่งงานลูกน้องต่อไป
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={reqSending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-govblue-800 hover:bg-govblue-900 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {reqSending ? "กำลังส่งคำร้อง..." : "ส่งคำร้องไปยังหัวหน้างาน"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals for Detail and Tax Invoice */}
      <LandDetailModal
        isOpen={Boolean(detailLand)}
        onClose={() => setDetailLand(null)}
        land={detailLand}
        onOpenTaxInvoice={(l) => setTaxInvoiceLand(l)}
        onOpenRevisionRequest={(l) => openRequestModal(l)}
      />

      <TaxInvoiceModal
        isOpen={Boolean(taxInvoiceLand)}
        onClose={() => setTaxInvoiceLand(null)}
        targetType="land"
        land={taxInvoiceLand}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="ยืนยันการลบแปลงที่ดิน"
        message={
          <div className="text-left space-y-2">
            <p className="text-center text-gray-700">
              คุณต้องการลบแปลงที่ดิน <strong className="text-gray-900 font-semibold">"{deleteTarget?.code}"</strong> ใช่หรือไม่?
            </p>
            <p className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-100 leading-relaxed">
              ⚠️ <strong>คำเตือน:</strong> การลบแปลงที่ดินนี้จะไม่สามารถกู้คืนได้ และอาจส่งผลต่อสิ่งปลูกสร้างที่ผูกอยู่กับแปลงที่ดินนี้
            </p>
          </div>
        }
        confirmLabel="ยืนยันลบข้อมูล"
        cancelLabel="ยกเลิก"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Page>
  );
}
