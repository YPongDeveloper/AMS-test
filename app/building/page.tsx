"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, Tag } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  fetchBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  fetchLands,
  type Building,
  type FloorDetail,
  type LandParcel,
  getCurrentUser,
  createRevisionRequest,
} from "@/lib/api";
import {
  Camera,
  Save,
  X,
  Layers,
  ImageIcon,
  ChevronRight,
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Eye,
  Printer,
  Receipt,
  Download,
  MapPin,
} from "lucide-react";
import BuildingDetailModal from "@/components/BuildingDetailModal";
import TaxInvoiceModal from "@/components/TaxInvoiceModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  calculateBuildingTax,
  calculateBuildingTotalSqm,
  formatCurrency,
  formatShortAddress,
  formatFullAddress,
} from "@/lib/tax";

export default function BuildingPage() {
  const { t } = useI18n();
  const [view, setView] = useState<"list" | "form">("list");
  const [detailBuilding, setDetailBuilding] = useState<Building | null>(null);
  const [taxInvoiceBuilding, setTaxInvoiceBuilding] = useState<Building | null>(null);
  const [tab, setTab] = useState<"info" | "floors" | "photos">("info");
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [lands, setLands] = useState<LandParcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterLand, setFilterLand] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "green" | "red" } | null>(null);

  // Confirmation Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ publicId: string; code: string } | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bldgCode, setBldgCode] = useState("");
  const [landCode, setLandCode] = useState("");
  const [name, setName] = useState("");
  const [bldg69, setBldg69] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [age, setAge] = useState("");
  const [beAge, setBeAge] = useState("");
  const [numFl, setNumFl] = useState<number>(3);
  const [condition, setCondition] = useState("ดี");
  const [addressNo, setAddressNo] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [district, setDistrict] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const copyAddressFromLand = () => {
    if (!landCode) {
      alert("กรุณาเลือกแปลงที่ดินที่ตั้งก่อน");
      return;
    }
    const found = lands.find((l) => l.land_code === landCode);
    if (found) {
      if (found.address_no) setAddressNo(found.address_no);
      if (found.subdistrict) setSubdistrict(found.subdistrict);
      if (found.district) setDistrict(found.district);
      if (found.province) setProvince(found.province);
      if (found.postal_code) setPostalCode(found.postal_code);
      setMsg({ text: `คัดลอกที่อยู่จากแปลงที่ดิน "${landCode}" สำเร็จ`, tone: "green" });
    } else {
      alert(`ไม่พบข้อมูลแปลงที่ดิน ${landCode}`);
    }
  };

  // Floor details 1..10
  const [activeFloor, setActiveFloor] = useState(1);
  const [floors, setFloors] = useState<FloorDetail[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      floor_number: i + 1,
      bldg_use: i === 0 ? "สำนักงานบริการ" : "",
      dim: i === 0 ? 300 : null,
      width: i === 0 ? 15 : null,
      length: i === 0 ? 20 : null,
    })),
  );

  // Photos (4 directions)
  const [photoF, setPhotoF] = useState("");
  const [photoB, setPhotoB] = useState("");
  const [photoR, setPhotoR] = useState("");
  const [photoL, setPhotoL] = useState("");

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);
  const leftInputRef = useRef<HTMLInputElement>(null);

  const currentUser = getCurrentUser();

  // Request Modal State (สำหรับพนักงานบัญชีสร้างคำร้องขอแก้ไข / สำรวจใหม่)
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqBldgId, setReqBldgId] = useState("");
  const [reqBldgCode, setReqBldgCode] = useState("");
  const [reqType, setReqType] = useState<"revision" | "survey_new">("revision");
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqSending, setReqSending] = useState(false);
  const [reqSearch, setReqSearch] = useState("");

  const openRequestModal = (b?: Building) => {
    if (b) {
      setReqBldgId(b.public_id);
      setReqBldgCode(b.bldg_code);
    } else if (buildings.length > 0) {
      setReqBldgId(buildings[0].public_id);
      setReqBldgCode(buildings[0].bldg_code);
    } else {
      setReqBldgId("");
      setReqBldgCode("");
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
        target_type: "building",
        target_id: reqBldgId || undefined,
        target_code: reqBldgCode || undefined,
        request_type: reqType,
        remarks: reqRemarks.trim(),
      });
      setRequestModalOpen(false);
      setDetailBuilding(null);
      setMsg({
        text: `สร้างคำร้องขอแก้ไข/ตรวจสอบสิ่งปลูกสร้าง "${reqBldgCode || "ทั่วไป"}" สำเร็จ (ส่งไปยังหัวหน้างานในหน้าสั่งงานแล้ว)`,
        tone: "green",
      });
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการส่งคำร้อง");
    } finally {
      setReqSending(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [bData, lData] = await Promise.all([
        fetchBuildings(search, filterLand),
        fetchLands(),
      ]);
      setBuildings(bData);
      setLands(lData);
    } catch (e) {
      console.error(e);
      setMsg({ text: "ไม่สามารถดึงข้อมูลสิ่งปลูกสร้างได้", tone: "red" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, filterLand]);

  const bldgTaxStats = useMemo(() => {
    let totalUsableSqm = 0;
    let totalBaseValue = 0;
    let totalTaxPayable = 0;

    buildings.forEach((b) => {
      const tx = calculateBuildingTax(b);
      totalUsableSqm += tx.totalUsableSqm;
      totalBaseValue += tx.baseValue;
      totalTaxPayable += tx.taxPayable;
    });

    return {
      totalUsableSqm,
      totalBaseValue,
      totalTaxPayable,
      formattedBaseValue: formatCurrency(totalBaseValue),
      formattedTaxPayable: formatCurrency(totalTaxPayable),
    };
  }, [buildings]);

  const handleExportBldgTaxCSV = () => {
    const headers = [
      "รหัสสิ่งปลูกสร้าง (Bldg_Code)",
      "ชื่ออาคาร",
      "แปลงที่ดิน",
      "สถานที่ตั้ง/เลขที่",
      "ตำบล/แขวง",
      "อำเภอ/เขต",
      "จังหวัด",
      "รหัสไปรษณีย์",
      "ที่อยู่เต็ม",
      "จำนวนชั้น",
      "พื้นที่ใช้สอยรวม (ตร.ม.)",
      "ประเภทการใช้งาน",
      "สภาพอาคาร",
      "ราคาประเมินต่อ ตร.ม. (บาท)",
      "มูลค่าฐานภาษี (บาท)",
      "อัตราภาษี (%)",
      "ภาษีที่ต้องชำระ (บาท)",
    ];
    const rows = buildings.map((b) => {
      const tx = calculateBuildingTax(b);
      return [
        `"${b.bldg_code}"`,
        `"${b.name}"`,
        `"${b.land_code || "-"}"`,
        `"${b.address_no || "-"}"`,
        `"${b.subdistrict || "-"}"`,
        `"${b.district || "-"}"`,
        `"${b.province || "-"}"`,
        `"${b.postal_code || "-"}"`,
        `"${formatFullAddress(b)}"`,
        b.num_fl,
        tx.totalUsableSqm,
        `"${tx.useType}"`,
        `"${b.bld_condition_type || "ดี"}"`,
        tx.appraisalPerSqm,
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
    a.download = `ตารางภาษีสิ่งปลูกสร้างรายอาคาร_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setEditingId(null);
    setBldgCode(`BL-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`);
    setLandCode(lands[0]?.land_code || "LP-2569-0043");
    setName("");
    setBldg69("301 - อาคารสำนักงาน");
    setMaterialType("คอนกรีตเสริมเหล็ก");
    setAge("10");
    setBeAge(String(new Date().getFullYear() + 543 - 10));
    setNumFl(3);
    setCondition("ดี");
    setAddressNo("");
    setSubdistrict("");
    setDistrict("");
    setProvince("");
    setPostalCode("");

    setFloors(
      Array.from({ length: 10 }, (_, i) => ({
        floor_number: i + 1,
        bldg_use: i < 3 ? "สำนักงาน" : "",
        dim: i < 3 ? 300 : null,
        width: i < 3 ? 15 : null,
        length: i < 3 ? 20 : null,
      })),
    );
    setActiveFloor(1);
    setPhotoF("");
    setPhotoB("");
    setPhotoR("");
    setPhotoL("");
    setTab("info");
  };

  const openCreate = () => {
    resetForm();
    setView("form");
    setMsg(null);
  };

  const openEdit = (b: Building) => {
    setEditingId(b.public_id);
    setBldgCode(b.bldg_code);
    setLandCode(b.land_code || "");
    setName(b.name);
    setBldg69(b.bldg_69 || "");
    setMaterialType(b.material_type || "");
    setAge(b.age || "");
    setBeAge(b.be_age || "");
    setNumFl(b.num_fl || 1);
    setCondition(b.bld_condition_type || "ดี");
    setAddressNo(b.address_no || "");
    setSubdistrict(b.subdistrict || "");
    setDistrict(b.district || "");
    setProvince(b.province || "");
    setPostalCode(b.postal_code || "");

    // Merge existing floors with 10 slots
    const mergedFloors: FloorDetail[] = Array.from({ length: 10 }, (_, i) => {
      const existing = b.floors?.find((f) => f.floor_number === i + 1);
      return (
        existing || {
          floor_number: i + 1,
          bldg_use: "",
          dim: null,
          width: null,
          length: null,
        }
      );
    });
    setFloors(mergedFloors);
    setActiveFloor(1);

    setPhotoF(b.picture_f || "");
    setPhotoB(b.picture_b || "");
    setPhotoR(b.picture_r || "");
    setPhotoL(b.picture_l || "");
    setTab("info");
    setView("form");
    setMsg(null);
  };

  const handleDelete = (publicId: string, code: string) => {
    setDeleteTarget({ publicId, code });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBuilding(deleteTarget.publicId);
      setMsg({ text: `ลบสิ่งปลูกสร้าง "${deleteTarget.code}" สำเร็จ`, tone: "green" });
      loadData();
    } catch (e) {
      setMsg({ text: (e as Error).message || "เกิดข้อผิดพลาดในการลบ", tone: "red" });
    } finally {
      setDeleteTarget(null);
    }
  };

  const updateActiveFloor = (field: keyof FloorDetail, value: any) => {
    setFloors((prev) =>
      prev.map((fl) => {
        if (fl.floor_number !== activeFloor) return fl;
        const updated = { ...fl, [field]: value };
        if (field === "width" || field === "length") {
          const w = field === "width" ? Number(value) : Number(fl.width);
          const l = field === "length" ? Number(value) : Number(fl.length);
          if (w > 0 && l > 0) {
            updated.dim = Math.round(w * l * 100) / 100;
          }
        }
        return updated;
      }),
    );
  };

  const handlePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bldgCode.trim()) {
      setMsg({ text: "กรุณาระบุรหัสประจำอาคาร (Bldg_Code)", tone: "red" });
      return;
    }
    if (!name.trim()) {
      setMsg({ text: "กรุณาระบุชื่ออาคารสิ่งปลูกสร้าง (Name)", tone: "red" });
      return;
    }
    setSaving(true);
    setMsg(null);

    // Filter only floors up to numFl or with content
    const cleanedFloors = floors.filter(
      (fl) => fl.floor_number <= Math.ceil(numFl) || fl.bldg_use || (fl.dim && fl.dim > 0),
    );

    const payload: Partial<Building> = {
      bldg_code: bldgCode.trim(),
      land_code: landCode.trim(),
      name: name.trim(),
      bldg_69: bldg69,
      material_type: materialType,
      age: age.trim(),
      be_age: beAge.trim(),
      num_fl: Number(numFl),
      floors: cleanedFloors,
      bld_condition_type: condition,
      address_no: addressNo.trim(),
      subdistrict: subdistrict.trim(),
      district: district.trim(),
      province: province.trim(),
      postal_code: postalCode.trim(),
      picture_f: photoF,
      picture_b: photoB,
      picture_r: photoR,
      picture_l: photoL,
    };

    try {
      if (editingId) {
        await updateBuilding(editingId, payload);
        setMsg({ text: `อัปเดตสิ่งปลูกสร้าง "${bldgCode}" สำเร็จ`, tone: "green" });
      } else {
        await createBuilding(payload);
        setMsg({ text: `บันทึกสิ่งปลูกสร้าง "${bldgCode}" สำเร็จ`, tone: "green" });
      }
      await loadData();
      setView("list");
    } catch (e) {
      setMsg({ text: (e as Error).message || "บันทึกไม่สำเร็จ", tone: "red" });
    } finally {
      setSaving(false);
    }
  };

  const currentFloorData = floors.find((fl) => fl.floor_number === activeFloor) || {
    floor_number: activeFloor,
    bldg_use: "",
    dim: null,
    width: null,
    length: null,
  };

  return (
    <Page allowedRoles={["admin", "accountant"]}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <SectionHeader title={t("bldgTitle")} />
        <div className="flex items-center gap-2">
          {view === "list" ? (
            <div className="flex items-center gap-2">
              <Btn onClick={() => openRequestModal()} className="!bg-govblue-800 !text-white hover:!bg-govblue-900 shadow-sm">
                <AlertCircle size={16} /> สร้างคำร้องขอแก้ไข / ตรวจสอบ
              </Btn>
              {currentUser?.role === "admin" && (
                <Btn onClick={openCreate} className="!bg-govgold-500 !text-govblue-900 hover:!bg-govgold-400">
                  <Plus size={16} /> บันทึกสิ่งปลูกสร้างใหม่ (Admin)
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
          {/* Filters & Actions */}
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="ค้นหารหัสสิ่งปลูกสร้าง, ชื่ออาคาร, รหัส 69 แบบ, ที่ตั้ง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterLand}
                onChange={(e) => setFilterLand(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
              >
                <option value="">— ทุกแปลงที่ดิน —</option>
                {lands.map((l) => (
                  <option key={l.public_id} value={l.land_code}>
                    {l.land_code} ({l.srt_land_type || "แปลงที่ดิน"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExportBldgTaxCSV}
                className="px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-2xs flex items-center gap-1 transition cursor-pointer"
                title="ส่งออก CSV"
              >
                <Download size={14} className="text-govblue-700" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 text-xs font-semibold text-white bg-govblue-800 hover:bg-govblue-900 rounded-lg shadow-2xs flex items-center gap-1 transition cursor-pointer"
                title="พิมพ์ตารางภาษี"
              >
                <Printer size={14} />
              </button>
              <Btn variant="secondary" onClick={loadData} disabled={loading}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </Btn>
            </div>
          </div>

          {/* Summary Cards for Consolidated Building Tax */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xs">
              <span className="text-xs text-gray-500 block">อาคารสิ่งปลูกสร้างทั้งหมด</span>
              <span className="text-xl font-bold text-gray-900 mt-1 block">
                {buildings.length} หลัง
              </span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                พื้นที่ใช้สอยรวม {bldgTaxStats.totalUsableSqm.toLocaleString()} ตร.ม.
              </span>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xs">
              <span className="text-xs text-gray-500 block">มูลค่าฐานภาษีประเมินรวมทั้งสิ้น</span>
              <span className="text-xl font-bold text-govblue-900 font-mono mt-1 block">
                ฿{bldgTaxStats.formattedBaseValue}
              </span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                คิดจากราคาประเมินทุนทรัพย์สิ่งปลูกสร้าง
              </span>
            </div>
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs">
              <span className="text-xs text-emerald-800 font-medium block">ประมาณการภาษีสิ่งปลูกสร้างรวมปี 2569</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
                ฿{bldgTaxStats.formattedTaxPayable}
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
                    <th className="p-3">รหัสสิ่งปลูกสร้าง</th>
                    <th className="p-3">ชื่ออาคาร</th>
                    <th className="p-3">แปลงที่ดิน</th>
                    <th className="p-3 text-center">จำนวนชั้น</th>
                    <th className="p-3 text-right">พื้นที่ใช้สอย (ตร.ม.)</th>
                    <th className="p-3">สภาพ / วัสดุ</th>
                    <th className="p-3 text-right">ราคาประเมิน/ตร.ม.</th>
                    <th className="p-3 text-right">มูลค่าฐานภาษี</th>
                    <th className="p-3 text-center">อัตราภาษี</th>
                    <th className="p-3 text-right">ภาษีที่ต้องชำระ</th>
                    <th className="p-3 text-center">การจัดการ / ออกเอกสาร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && buildings.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-gray-500">
                        กำลังโหลดข้อมูลสิ่งปลูกสร้าง...
                      </td>
                    </tr>
                  ) : buildings.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-gray-500">
                        ไม่พบข้อมูลสิ่งปลูกสร้าง
                      </td>
                    </tr>
                  ) : (
                    buildings.map((b, idx) => {
                      const tx = calculateBuildingTax(b);
                      return (
                        <tr key={b.public_id} className="hover:bg-emerald-50/40 transition">
                          <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-govblue-900">{b.bldg_code}</div>
                            {formatShortAddress(b) !== "-" && (
                              <div className="text-[10px] text-gray-500 font-normal">
                                📍 {formatShortAddress(b)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-gray-800 font-medium">{b.name}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-govblue-800 font-medium text-[11px] border border-blue-200">
                              {b.land_code || "-"}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">{b.num_fl} ชั้น</td>
                          <td className="p-3 text-right font-mono font-medium text-gray-900">
                            {tx.totalUsableSqm.toLocaleString()} ตร.ม.
                          </td>
                          <td className="p-3 text-gray-600">
                            {b.bld_condition_type || "ดี"} ({b.material_type || "คอนกรีต"})
                          </td>
                          <td className="p-3 text-right font-mono text-gray-600">
                            ฿{tx.appraisalPerSqm.toLocaleString()}
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
                                onClick={() => setDetailBuilding(b)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-govblue-800 bg-govblue-50 hover:bg-govblue-100 rounded-md border border-govblue-200 transition shadow-2xs"
                                title="ดูรายละเอียดเชิงลึก"
                              >
                                <Eye size={13} /> <span>ดูรายละเอียด</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setTaxInvoiceBuilding(b)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-govblue-800 hover:bg-govblue-900 rounded-md shadow-2xs transition"
                                title="พิมพ์ใบแจ้งการประเมินภาษี / ใบกำกับภาษี"
                              >
                                <Printer size={12} /> <span>พิมพ์ใบภาษี</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openRequestModal(b)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition"
                                title="สร้างคำร้องขอแก้ไขอาคารนี้"
                              >
                                <AlertCircle size={12} /> <span>ขอแก้ไข</span>
                              </button>
                              {currentUser?.role === "admin" && (
                                <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-gray-200">
                                  <button
                                    type="button"
                                    onClick={() => openEdit(b)}
                                    className="p-1 text-govblue-600 hover:bg-govblue-50 rounded"
                                    title="แก้ไข"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(b.public_id, b.bldg_code)}
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
                      รวมทั้งสิ้น ({buildings.length} หลัง):
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-gray-900">
                      {bldgTaxStats.totalUsableSqm.toLocaleString()} ตร.ม.
                    </td>
                    <td colSpan={2} className="p-3 text-right">-</td>
                    <td className="p-3 text-right font-mono font-bold text-govblue-950">
                      ฿{bldgTaxStats.formattedBaseValue}
                    </td>
                    <td className="p-3 text-center">-</td>
                    <td className="p-3 text-right font-mono font-black text-emerald-800 text-sm">
                      ฿{bldgTaxStats.formattedTaxPayable}
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
            {loading && buildings.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
                กำลังโหลดข้อมูลสิ่งปลูกสร้าง...
              </div>
            ) : buildings.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
                ไม่พบข้อมูลสิ่งปลูกสร้าง
              </div>
            ) : (
              buildings.map((b, idx) => {
                const tx = calculateBuildingTax(b);
                return (
                  <div
                    key={b.public_id}
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
                            {b.bldg_code}
                          </span>
                          <span className="text-xs text-gray-700 font-medium">
                            {b.name}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                        {b.num_fl} ชั้น • {b.bld_condition_type || "ดี"}
                      </span>
                    </div>

                    {/* Location & Land Ref */}
                    <div className="text-xs space-y-1 text-gray-600 bg-gray-50/60 p-2.5 rounded-lg border border-gray-100">
                      {formatShortAddress(b) !== "-" && (
                        <div className="flex items-start gap-1.5 text-gray-700">
                          <span className="text-govblue-600 shrink-0">📍</span>
                          <span className="font-medium">{formatShortAddress(b)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-gray-500">แปลงที่ดินที่ตั้ง:</span>
                        <span className="font-semibold text-govblue-800">{b.land_code || "-"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">พื้นที่ใช้สอยรวม:</span>
                        <span className="font-semibold text-gray-800">
                          {tx.totalUsableSqm.toLocaleString()} ตร.ม. ({b.material_type || "คอนกรีต"})
                        </span>
                      </div>
                    </div>

                    {/* Tax Summary Grid */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 text-[10px] block">ราคาประเมิน/ตร.ม.</span>
                        <span className="font-mono font-medium text-gray-800">
                          ฿{tx.appraisalPerSqm.toLocaleString()}
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
                        onClick={() => setDetailBuilding(b)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold text-govblue-800 bg-govblue-50 hover:bg-govblue-100 rounded-lg border border-govblue-200 transition"
                      >
                        <Eye size={13} /> <span>ดูรายละเอียด</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxInvoiceBuilding(b)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-white bg-govblue-800 hover:bg-govblue-900 rounded-lg shadow-2xs transition"
                      >
                        <Printer size={13} /> <span>พิมพ์ใบภาษี</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openRequestModal(b)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition"
                        title="สร้างคำร้องขอแก้ไข"
                      >
                        <AlertCircle size={13} /> <span>ขอแก้ไข</span>
                      </button>
                      {currentUser?.role === "admin" && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(b)}
                            className="p-2 text-govblue-700 hover:bg-govblue-50 rounded-lg border border-gray-200"
                            title="แก้ไข"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(b.public_id, b.bldg_code)}
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
            {buildings.length > 0 && (
              <div className="p-3 bg-gray-100 rounded-xl border border-gray-200 text-xs space-y-1 text-gray-700 font-medium">
                <div className="flex justify-between">
                  <span>รวมทั้งหมด:</span>
                  <span className="font-bold">{buildings.length} หลัง ({bldgTaxStats.totalUsableSqm.toLocaleString()} ตร.ม.)</span>
                </div>
                <div className="flex justify-between">
                  <span>ฐานภาษีรวม:</span>
                  <span className="font-bold font-mono">฿{bldgTaxStats.formattedBaseValue}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold border-t border-gray-200 pt-1">
                  <span>ภาษีรวมปี 2569:</span>
                  <span className="font-black font-mono text-sm">฿{bldgTaxStats.formattedTaxPayable}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Form View */
        <form onSubmit={handleSave}>
          <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
            <TabBtn active={tab === "info"} onClick={() => setTab("info")} icon={<Layers size={14} />}>
              1. ข้อมูลทั่วไป (Info)
            </TabBtn>
            <TabBtn active={tab === "floors"} onClick={() => setTab("floors")} icon={<Layers size={14} />}>
              2. ข้อมูลรายชั้น (Floors 1-10)
            </TabBtn>
            <TabBtn active={tab === "photos"} onClick={() => setTab("photos")} icon={<ImageIcon size={14} />}>
              3. รูปถ่าย 4 ทิศ (Photos)
            </TabBtn>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Tab 1: Info */}
              {tab === "info" && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-govblue-700 mb-3">
                    ข้อมูลคุณลักษณะสิ่งปลูกสร้าง (Attribute Layer)
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="รหัสประจำสิ่งปลูกสร้าง (Bldg_Code)" required hint="Text 20">
                      <Input
                        value={bldgCode}
                        onChange={(e) => setBldgCode(e.target.value)}
                        placeholder="เช่น BL-2569-0118"
                        required
                      />
                    </Field>
                    <Field label="ชื่ออาคารสิ่งปลูกสร้าง (Name)" required hint="Text 254">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="เช่น อาคารสำนักงานใหญ่ ชั้น 1-3"
                        required
                      />
                    </Field>
                    <Field label="แปลงที่ดินที่ตั้ง (Land_Code)" hint="เชื่อมโยงแปลงที่ดิน">
                      <Select value={landCode} onChange={(e) => setLandCode(e.target.value)}>
                        <option value="">— เลือกแปลงที่ดิน —</option>
                        {lands.map((l) => (
                          <option key={l.public_id} value={l.land_code}>
                            {l.land_code} ({l.srt_land_type || "แปลงที่ดิน"})
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="ประเภทอาคาร 69 แบบ (Bldg_69)" hint="Text 254">
                      <Select value={bldg69} onChange={(e) => setBldg69(e.target.value)}>
                        <option value="">— เลือกประเภท 69 แบบ —</option>
                        <option value="101 - บ้านเดี่ยว">101 - บ้านเดี่ยว</option>
                        <option value="201 - ตึกแถว">201 - ตึกแถว</option>
                        <option value="301 - อาคารสำนักงาน">301 - อาคารสำนักงาน</option>
                        <option value="401 - โรงงาน">401 - โรงงาน</option>
                        <option value="501 - คลังสินค้า">501 - คลังสินค้า</option>
                        <option value="601 - โรงพักรถไฟ/สถานี">601 - โรงพักรถไฟ/สถานี</option>
                      </Select>
                    </Field>
                    <Field label="วัสดุก่อสร้าง (Material_Type)" hint="Text 50">
                      <Select value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
                        <option value="">— เลือกวัสดุ —</option>
                        <option value="คอนกรีตเสริมเหล็ก">คอนกรีตเสริมเหล็ก</option>
                        <option value="ไม้">ไม้</option>
                        <option value="เหล็ก">เหล็ก</option>
                        <option value="ตึกครึ่งไม้">ตึกครึ่งไม้</option>
                        <option value="โครงสร้างผสม">โครงสร้างผสม</option>
                      </Select>
                    </Field>
                    <Field label="อายุสิ่งปลูกสร้าง (Age)" hint="ปี (Text 3)">
                      <Input
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="เช่น 28"
                      />
                    </Field>
                    <Field label="ปีที่สร้าง พ.ศ. (B.E._Age)" hint="Text 20">
                      <Input
                        value={beAge}
                        onChange={(e) => setBeAge(e.target.value)}
                        placeholder="เช่น 2541"
                      />
                    </Field>
                    <Field label="จำนวนชั้น (Num_Fl)" hint="Float 3,2">
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        max="10"
                        value={numFl}
                        onChange={(e) => setNumFl(Number(e.target.value))}
                      />
                    </Field>
                    <Field label="สภาพปัจจุบัน (BLD_Condition_Type)" hint="Text 50">
                      <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
                        <option value="ดี">ดี</option>
                        <option value="พอใช้">พอใช้</option>
                        <option value="ทรุดโทรม">ทรุดโทรม</option>
                      </Select>
                    </Field>

                    {/* Address Fields */}
                    <div className="sm:col-span-2 pt-3 mt-1 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-govblue-900 flex items-center gap-1.5">
                          <MapPin size={14} className="text-rose-600" /> ข้อมูลที่อยู่และสถานที่ตั้งอาคาร (Address & Location)
                        </span>
                        <button
                          type="button"
                          onClick={copyAddressFromLand}
                          className="text-[11px] font-semibold text-govblue-700 bg-govblue-50 hover:bg-govblue-100 px-2.5 py-1 rounded border border-govblue-200 transition cursor-pointer"
                        >
                          📋 คัดลอกจากแปลงที่ดินที่ตั้ง
                        </button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <Field label="เลขที่ / อาคาร / ห้อง / ถนน / ซอย" hint="เช่น 1 อาคารสำนักงานบริหาร หรือ 234/12 อาคารเอ">
                            <Input
                              value={addressNo}
                              onChange={(e) => setAddressNo(e.target.value)}
                              placeholder="เช่น 1 อาคารสำนักงานบริหาร"
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
                    </div>
                  </div>
                </Card>
              )}

              {/* Tab 2: Floors */}
              {tab === "floors" && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-govblue-700">
                      รายละเอียดรายชั้น (Floors 1..10)
                    </h3>
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setActiveFloor(f)}
                          className={`w-8 h-8 text-xs font-medium rounded transition ${
                            activeFloor === f
                              ? "bg-govblue-700 text-white shadow-sm"
                              : "bg-white text-govblue-700 border border-gray-200 hover:bg-govblue-50"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-govblue-50 border-l-4 border-govblue-700 px-3 py-2 mb-4 rounded-r">
                    <div className="text-xs text-govblue-800 font-semibold">
                      ชั้นที่ {activeFloor} จาก 10 ชั้น
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field
                      label={`ลักษณะการใช้ประโยชน์ ชั้นที่ ${activeFloor} (Bldg_Use_Fl_${activeFloor})`}
                      className="sm:col-span-2"
                      hint="Text 254"
                    >
                      <Input
                        value={currentFloorData.bldg_use}
                        onChange={(e) => updateActiveFloor("bldg_use", e.target.value)}
                        placeholder="เช่น สำนักงาน, ร้านค้า, ที่พักอาศัย, ส่วนกลาง"
                      />
                    </Field>
                    <Field
                      label={`ความกว้าง ชั้นที่ ${activeFloor} (Width_Fl_${activeFloor})`}
                      hint="เมตร (Float 10,2)"
                    >
                      <Input
                        type="number"
                        step="0.01"
                        value={currentFloorData.width ?? ""}
                        onChange={(e) =>
                          updateActiveFloor("width", e.target.value ? Number(e.target.value) : null)
                        }
                        placeholder="0.00"
                      />
                    </Field>
                    <Field
                      label={`ความยาว ชั้นที่ ${activeFloor} (Length_Fl_${activeFloor})`}
                      hint="เมตร (Float 10,2)"
                    >
                      <Input
                        type="number"
                        step="0.01"
                        value={currentFloorData.length ?? ""}
                        onChange={(e) =>
                          updateActiveFloor("length", e.target.value ? Number(e.target.value) : null)
                        }
                        placeholder="0.00"
                      />
                    </Field>
                    <Field
                      label={`ขนาดพื้นที่ ชั้นที่ ${activeFloor} (Dim_Fl_${activeFloor})`}
                      hint="ตร.ม. (Float 10,2 - คำนวณอัตโนมัติ)"
                      className="sm:col-span-2"
                    >
                      <Input
                        type="number"
                        step="0.01"
                        value={currentFloorData.dim ?? ""}
                        onChange={(e) =>
                          updateActiveFloor("dim", e.target.value ? Number(e.target.value) : null)
                        }
                        placeholder="0.00"
                      />
                    </Field>
                  </div>
                </Card>
              )}

              {/* Tab 3: Photos 4 directions */}
              {tab === "photos" && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-govblue-700 mb-3">
                    ภาพถ่าย 4 ทิศ (Picture_F, B, R, L)
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Front */}
                    <PhotoBox
                      label="รูปถ่ายด้านหน้า (Picture_F)"
                      value={photoF}
                      onUpload={(e) => handlePhotoUpload(e, setPhotoF)}
                      onClear={() => setPhotoF("")}
                      inputRef={frontInputRef}
                    />
                    {/* Back */}
                    <PhotoBox
                      label="รูปถ่ายด้านหลัง (Picture_B)"
                      value={photoB}
                      onUpload={(e) => handlePhotoUpload(e, setPhotoB)}
                      onClear={() => setPhotoB("")}
                      inputRef={backInputRef}
                    />
                    {/* Right */}
                    <PhotoBox
                      label="รูปถ่ายด้านขวา (Picture_R)"
                      value={photoR}
                      onUpload={(e) => handlePhotoUpload(e, setPhotoR)}
                      onClear={() => setPhotoR("")}
                      inputRef={rightInputRef}
                    />
                    {/* Left */}
                    <PhotoBox
                      label="รูปถ่ายด้านซ้าย (Picture_L)"
                      value={photoL}
                      onUpload={(e) => handlePhotoUpload(e, setPhotoL)}
                      onClear={() => setPhotoL("")}
                      inputRef={leftInputRef}
                    />
                  </div>
                </Card>
              )}

              {/* Buttons */}
              <div className="flex gap-2 justify-end">
                <Btn type="button" variant="secondary" onClick={() => setView("list")}>
                  <X size={14} /> ยกเลิก
                </Btn>
                <Btn type="submit" disabled={saving}>
                  <Save size={14} /> {saving ? "กำลังบันทึก..." : editingId ? "อัปเดตข้อมูล" : "บันทึกข้อมูล"}
                </Btn>
              </div>
            </div>

            {/* Sidebar status */}
            <div className="space-y-3">
              <Card className="p-4 bg-govblue-900 text-white">
                <h4 className="text-xs uppercase tracking-wider text-govgold-400 font-semibold mb-2">
                  คุณลักษณะสิ่งปลูกสร้าง 51 Attribute
                </h4>
                <p className="text-xs text-blue-100 leading-relaxed">
                  ตรงตามมาตรฐานข้อมูลสำรวจ ประกอบด้วยข้อมูลพื้นฐาน, โครงสร้าง 69 แบบ, รายละเอียดแต่ละชั้น 1-10 และรูปถ่าย 4 ทิศ
                </p>
              </Card>

              <Card className="p-3">
                <h4 className="text-xs font-semibold text-govblue-700 mb-2">สรุปรายการ</h4>
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">แปลงที่ดิน:</span>
                    <span className="font-medium text-govblue-700">{landCode || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">จำนวนชั้น:</span>
                    <span className="font-mono">{numFl} ชั้น</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">รูปภาพครบ:</span>
                    <span className="font-mono">
                      {[photoF, photoB, photoR, photoL].filter(Boolean).length}/4 ภาพ
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-3">
                <h4 className="text-xs font-semibold text-govblue-700 mb-2">ผู้บันทึก</h4>
                <div className="text-xs space-y-1">
                  <div className="font-medium text-gray-800">{currentUser?.display_name || "เจ้าหน้าที่สำรวจ"}</div>
                  <div className="text-gray-500">สิทธิ์: {currentUser?.role || "ผู้สำรวจ"}</div>
                </div>
              </Card>
            </div>
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
                <span>สร้างคำร้องขอแก้ไข / ตรวจสอบสิ่งปลูกสร้าง</span>
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
                  สิ่งปลูกสร้างที่ต้องการให้ตรวจสอบ
                </label>
                <div className="relative mb-1.5">
                  <Search className="absolute left-2.5 top-2 text-gray-400" size={13} />
                  <input
                    type="text"
                    placeholder="พิมพ์ค้นหารหัสอาคาร, ชื่ออาคาร, แปลงที่ตั้งเพื่อกรองตัวเลือก..."
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-govblue-500 focus:outline-none"
                  />
                </div>
                <select
                  value={reqBldgId}
                  onChange={(e) => {
                    const sel = buildings.find((x) => x.public_id === e.target.value);
                    setReqBldgId(e.target.value);
                    setReqBldgCode(sel ? sel.bldg_code : "");
                  }}
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
                >
                  <option value="">— ไม่ระบุอาคารเฉพาะเจาะจง (งานทั่วไป) —</option>
                  {buildings
                    .filter((b) => {
                      if (!reqSearch.trim()) return true;
                      const q = reqSearch.toLowerCase();
                      return (
                        b.bldg_code.toLowerCase().includes(q) ||
                        b.name.toLowerCase().includes(q) ||
                        (b.land_code && b.land_code.toLowerCase().includes(q)) ||
                        (b.subdistrict && b.subdistrict.toLowerCase().includes(q)) ||
                        (b.province && b.province.toLowerCase().includes(q))
                      );
                    })
                    .map((b) => (
                      <option key={b.public_id} value={b.public_id}>
                        {b.bldg_code} : {b.name} ({b.num_fl} ชั้น) {b.land_code ? `[แปลง ${b.land_code}]` : ""}
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
                    <div className="text-[10px] text-gray-500 mt-0.5">ข้อมูลผิดพลาด, จำนวนชั้นไม่ตรง</div>
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
                    <div className="text-[10px] text-gray-500 mt-0.5">ตรวจสอบสภาพอาคาร, ถ่ายภาพใหม่</div>
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
                  placeholder="ระบุสิ่งที่พบ เช่น จำนวนชั้นหรือการใช้ประโยชน์ไม่ตรงกับความเป็นจริง, สภาพทรุดโทรม..."
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

      {/* Building Detail Modal */}
      <BuildingDetailModal
        isOpen={Boolean(detailBuilding)}
        onClose={() => setDetailBuilding(null)}
        building={detailBuilding}
        onOpenTaxInvoice={(b) => setTaxInvoiceBuilding(b)}
        onOpenRevisionRequest={(b) => openRequestModal(b)}
      />

      {/* Building Tax Invoice Modal */}
      <TaxInvoiceModal
        isOpen={Boolean(taxInvoiceBuilding)}
        onClose={() => setTaxInvoiceBuilding(null)}
        targetType="building"
        building={taxInvoiceBuilding}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="ยืนยันการลบสิ่งปลูกสร้าง"
        message={
          <div className="text-left space-y-2">
            <p className="text-center text-gray-700">
              คุณต้องการลบสิ่งปลูกสร้าง <strong className="text-gray-900 font-semibold">"{deleteTarget?.code}"</strong> ใช่หรือไม่?
            </p>
            <p className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-100 leading-relaxed">
              ⚠️ <strong>คำเตือน:</strong> การลบสิ่งปลูกสร้างนี้จะไม่สามารถกู้คืนได้ และข้อมูลชั้นการใช้งานและรูปภาพจะถูกลบออกจากระบบ
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

function PhotoBox({
  label,
  value,
  onUpload,
  onClear,
  inputRef,
}: {
  label: string;
  value: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
      <div className="text-xs font-medium text-govblue-800 mb-2">{label}</div>
      <input type="file" accept="image/*" ref={inputRef} onChange={onUpload} className="hidden" />
      {value ? (
        <div className="relative border border-gray-200 rounded overflow-hidden h-36 bg-black/5 flex items-center justify-center">
          <img src={value} alt={label} className="max-h-36 object-contain" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1.5 right-1.5 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-govblue-400 rounded p-6 text-center cursor-pointer transition bg-white"
        >
          <Camera className="mx-auto text-gray-400 mb-1" size={24} />
          <div className="text-xs text-gray-500">คลิกเพื่ออัปโหลดรูปภาพ</div>
        </div>
      )}
    </div>
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
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm border-b-2 transition whitespace-nowrap ${
        active
          ? "border-govblue-700 text-govblue-700 font-semibold"
          : "border-transparent text-gray-500 hover:text-govblue-600"
      }`}
    >
      {icon}
      {children}
      <ChevronRight size={12} className="opacity-50" />
    </button>
  );
}
