import { Building } from "./types";
import { api, API_CONFIGURED } from "./client";
import { MOCK_BUILDINGS } from "./mockData";

export async function fetchBuildings(q?: string, landCode?: string): Promise<Building[]> {
  if (!API_CONFIGURED) {
    let res = MOCK_BUILDINGS;
    if (landCode) res = res.filter((b) => b.land_code === landCode);
    if (q) res = res.filter((b) => b.bldg_code.includes(q) || b.name.includes(q));
    return res;
  }
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (landCode) params.set("land_code", landCode);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return api<Building[]>(`/api/buildings${qs}`);
}

export async function getBuilding(publicId: string): Promise<Building> {
  if (!API_CONFIGURED) {
    const found = MOCK_BUILDINGS.find((b) => b.public_id === publicId);
    if (!found) throw new Error("ไม่พบข้อมูลสิ่งปลูกสร้าง");
    return found;
  }
  return api<Building>(`/api/buildings/${publicId}`);
}

export async function createBuilding(data: Partial<Building>): Promise<Building> {
  if (!API_CONFIGURED) {
    const newB: Building = {
      public_id: "mock-bl-" + Date.now(),
      bldg_code: data.bldg_code || "BL-NEW",
      land_code: data.land_code || "",
      name: data.name || "",
      bldg_69: data.bldg_69 || "",
      material_type: data.material_type || "",
      age: data.age || "",
      be_age: data.be_age || "",
      num_fl: data.num_fl || 1,
      floors: data.floors || [],
      bld_condition_type: data.bld_condition_type || "",
      picture_f: data.picture_f || "",
      picture_b: data.picture_b || "",
      picture_r: data.picture_r || "",
      picture_l: data.picture_l || "",
      address_no: data.address_no || "",
      subdistrict: data.subdistrict || "",
      district: data.district || "",
      province: data.province || "",
      postal_code: data.postal_code || "",
      created_by: "ฉัน (Demo)",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    MOCK_BUILDINGS.unshift(newB);
    return newB;
  }
  return api<Building>("/api/buildings", { method: "POST", json: data });
}

export async function updateBuilding(publicId: string, data: Partial<Building>): Promise<Building> {
  if (!API_CONFIGURED) {
    const idx = MOCK_BUILDINGS.findIndex((b) => b.public_id === publicId);
    if (idx >= 0) {
      MOCK_BUILDINGS[idx] = { ...MOCK_BUILDINGS[idx], ...data, updated_at: new Date().toISOString() };
      return MOCK_BUILDINGS[idx];
    }
    throw new Error("ไม่พบข้อมูลสิ่งปลูกสร้าง");
  }
  return api<Building>(`/api/buildings/${publicId}`, { method: "PUT", json: data });
}

export async function deleteBuilding(publicId: string): Promise<void> {
  if (!API_CONFIGURED) {
    const idx = MOCK_BUILDINGS.findIndex((b) => b.public_id === publicId);
    if (idx >= 0) MOCK_BUILDINGS.splice(idx, 1);
    return;
  }
  await api(`/api/buildings/${publicId}`, { method: "DELETE" });
}
