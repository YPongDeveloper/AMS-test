import { LandParcel } from "./types";
import { api, API_CONFIGURED } from "./client";
import { MOCK_LANDS } from "./mockData";

export async function fetchLands(q?: string): Promise<LandParcel[]> {
  if (!API_CONFIGURED) {
    if (!q) return MOCK_LANDS;
    return MOCK_LANDS.filter(
      (l) => l.land_code.includes(q) || l.deed_no.includes(q) || l.srt_land_type.includes(q)
    );
  }
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return api<LandParcel[]>(`/api/lands${query}`);
}

export async function getLand(publicId: string): Promise<LandParcel> {
  if (!API_CONFIGURED) {
    const found = MOCK_LANDS.find((l) => l.public_id === publicId);
    if (!found) throw new Error("ไม่พบข้อมูลแปลงที่ดิน");
    return found;
  }
  return api<LandParcel>(`/api/lands/${publicId}`);
}

export async function createLand(data: Partial<LandParcel>): Promise<LandParcel> {
  if (!API_CONFIGURED) {
    const newL: LandParcel = {
      public_id: "mock-" + Date.now(),
      land_code: data.land_code || "LP-NEW",
      srt_land_type: data.srt_land_type || "",
      land_use: data.land_use || "",
      land_type: data.land_type || "",
      deed_no: data.deed_no || "",
      dimension: data.dimension || "",
      rai: data.rai ?? 0,
      ngan: data.ngan ?? 0,
      wa: data.wa ?? 0,
      width: data.width || 0,
      length: data.length || 0,
      picture_f: data.picture_f || "",
      lat: data.lat || 13.7563,
      lng: data.lng || 100.5018,
      address_no: data.address_no || "",
      subdistrict: data.subdistrict || "",
      district: data.district || "",
      province: data.province || "",
      postal_code: data.postal_code || "",
      created_by: "ฉัน (Demo)",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_LANDS.unshift(newL);
    return newL;
  }
  return api<LandParcel>("/api/lands", { method: "POST", json: data });
}

export async function updateLand(publicId: string, data: Partial<LandParcel>): Promise<LandParcel> {
  if (!API_CONFIGURED) {
    const idx = MOCK_LANDS.findIndex((l) => l.public_id === publicId);
    if (idx >= 0) {
      MOCK_LANDS[idx] = { ...MOCK_LANDS[idx], ...data, updated_at: new Date().toISOString() };
      return MOCK_LANDS[idx];
    }
    throw new Error("ไม่พบข้อมูลแปลงที่ดิน");
  }
  return api<LandParcel>(`/api/lands/${publicId}`, { method: "PUT", json: data });
}

export async function deleteLand(publicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const idx = MOCK_LANDS.findIndex((l) => l.public_id === publicId);
    if (idx >= 0) MOCK_LANDS.splice(idx, 1);
    return;
  }
  await api(`/api/lands/${publicId}`, { method: "DELETE" });
}
