"use client";

import { useEffect, useState, useRef } from "react";
import { Page } from "@/components/Page";
import { Card, SectionHeader, Field, Input, Select, Btn, Tag } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  fetchLands,
  createLand,
  updateLand,
  deleteLand,
  type LandParcel,
  getCurrentUser,
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
} from "lucide-react";

export default function LandPage() {
  const { t } = useI18n();
  const [view, setView] = useState<"list" | "form">("list");
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

  const resetForm = () => {
    setEditingId(null);
    setLandCode(`LP-${new Date().getFullYear() + 543}-${String(Math.floor(Math.random() * 900) + 100)}`);
    setSrtLandType("ที่ดินสถานี");
    setLandUse("ใช้เพื่อการขนส่ง");
    setLandType("โฉนด");
    setDeedNo("");
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

  const handleDelete = async (publicId: string, code: string) => {
    if (!confirm(`ยืนยันการลบแปลงที่ดิน "${code}" ใช่หรือไม่?`)) return;
    try {
      await deleteLand(publicId);
      setMsg({ text: `ลบแปลงที่ดิน "${code}" สำเร็จ`, tone: "green" });
      loadData(search);
    } catch (e) {
      setMsg({ text: (e as Error).message || "เกิดข้อผิดพลาดในการลบ", tone: "red" });
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
    const reader = new FileReader();
    reader.onload = () => {
      setPictureF(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landCode.trim()) {
      setMsg({ text: "กรุณาระบุรหัสประจำที่ดิน (Land_Code)", tone: "red" });
      return;
    }
    setSaving(true);
    setMsg(null);

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
    <Page>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <SectionHeader title={t("landTitle")} />
        <div className="flex items-center gap-2">
          {view === "list" ? (
            <Btn onClick={openCreate} className="!bg-govgold-500 !text-govblue-900 hover:!bg-govgold-400">
              <Plus size={16} /> บันทึกแปลงที่ดินใหม่
            </Btn>
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
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="ค้นหารหัสที่ดิน, เลขที่โฉนด, ประเภทที่ดิน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
              />
            </div>
            <Btn variant="secondary" onClick={() => loadData(search)} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> รีเฟรช
            </Btn>
          </div>

          {/* Land List Table */}
          <Card className="overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-govblue-50/80 text-govblue-800 border-b border-gray-200 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">รหัสที่ดิน (Land_Code)</th>
                    <th className="p-3">เลขที่โฉนด</th>
                    <th className="p-3">ประเภท รฟท.</th>
                    <th className="p-3">การใช้ประโยชน์</th>
                    <th className="p-3">ขนาด (ไร่-งาน-วา)</th>
                    <th className="p-3">กว้าง × ยาว (ม.)</th>
                    <th className="p-3">พิกัด GPS</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && lands.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        กำลังโหลดข้อมูลแปลงที่ดิน...
                      </td>
                    </tr>
                  ) : lands.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        ยังไม่พบข้อมูลแปลงที่ดิน — กดปุ่ม "+ บันทึกแปลงที่ดินใหม่" เพื่อเริ่มต้น
                      </td>
                    </tr>
                  ) : (
                    lands.map((l) => (
                      <tr key={l.public_id} className="hover:bg-blue-50/40 transition">
                        <td className="p-3 font-semibold text-govblue-800 flex items-center gap-2">
                          <Layers size={14} className="text-govblue-600" />
                          <span>{l.land_code}</span>
                        </td>
                        <td className="p-3 text-gray-700">{l.deed_no || "-"}</td>
                        <td className="p-3">
                          <Tag tone="blue">{l.srt_land_type || "-"}</Tag>
                        </td>
                        <td className="p-3 text-gray-600">{l.land_use || "-"}</td>
                        <td className="p-3">
                          <div className="font-medium text-govblue-900">
                            {l.rai ?? (l.dimension ? l.dimension.split("-")[0] : 0)} ไร่{" "}
                            {l.ngan ?? (l.dimension ? l.dimension.split("-")[1] : 0)} งาน{" "}
                            {l.wa ?? (l.dimension ? l.dimension.split("-")[2] : 0)} วา
                          </div>
                          {l.dimension && (
                            <div className="text-[10px] text-gray-400 font-mono">({l.dimension})</div>
                          )}
                        </td>
                        <td className="p-3 text-gray-600">
                          {l.width && l.length ? `${l.width} × ${l.length} ม.` : "-"}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-gray-500">
                          {l.lat && l.lng ? `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}` : "-"}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <button
                            onClick={() => openEdit(l)}
                            className="p-1 text-govblue-600 hover:text-govblue-800 hover:bg-govblue-50 rounded"
                            title="แก้ไข"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(l.public_id, l.land_code)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            title="ลบ"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        /* Form View */
        <form onSubmit={handleSave} className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* GPS Section */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-govblue-700 flex items-center gap-1.5">
                  <MapPin size={16} /> 1. พิกัดภูมิศาสตร์ (GPS Coordinates)
                </h3>
                <Btn type="button" variant="secondary" onClick={acquireGPS} className="!text-xs py-1">
                  <MapPin size={12} /> ดึงพิกัดปัจจุบัน
                </Btn>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200 rounded p-4 h-32 flex items-center justify-center relative overflow-hidden">
                <div className="relative text-center">
                  <MapPin className="mx-auto text-rose-500" size={28} />
                  <div className="text-xs text-gray-700 mt-1 font-mono font-medium">
                    {lat ? `${lat}° N` : "-"}, {lng ? `${lng}° E` : "-"}
                  </div>
                  <Tag tone={gpsLocked ? "green" : "gold"} className="mt-1">
                    {gpsLocked ? "GPS Locked ✓" : "พิกัดตั้งต้น"}
                  </Tag>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="ละติจูด (Lat)">
                  <Input
                    type="number"
                    step="0.000001"
                    value={lat ?? ""}
                    onChange={(e) => setLat(e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
                <Field label="ลองจิจูด (Lng)">
                  <Input
                    type="number"
                    step="0.000001"
                    value={lng ?? ""}
                    onChange={(e) => setLng(e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
              </div>
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
                <Field label="ประเภทการใช้ประโยชน์ (SRT_Land_Type)" hint="Text 50">
                  <Select value={srtLandType} onChange={(e) => setSrtLandType(e.target.value)}>
                    <option value="">— เลือกประเภท —</option>
                    <option value="ที่ดินเชิงพาณิชย์">ที่ดินเชิงพาณิชย์</option>
                    <option value="ที่ดินสถานี">ที่ดินสถานี</option>
                    <option value="ที่ดินทางรถไฟ">ที่ดินทางรถไฟ</option>
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
                    <option value="ที่ดินกรรมสิทธิ์ รฟท.">ที่ดินกรรมสิทธิ์ รฟท.</option>
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

            {/* Photo Section */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-govblue-700 mb-3">
                3. รูปถ่ายด้านหน้า (Picture_F)
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
                ตามข้อกำหนดระบบสารสนเทศภูมิศาสตร์และการคำนวณภาษี รฟท. รหัสและขนาดพื้นที่ที่บันทึกจะถูกนำไปเชื่อมโยงกับสิ่งปลูกสร้างและคำนวณภาษีประจำปีอัตโนมัติ
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
    </Page>
  );
}
