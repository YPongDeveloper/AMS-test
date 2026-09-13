export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
};

export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

export function liffConfigured(): boolean {
  return Boolean(LIFF_ID);
}

/**
 * Init LIFF และคืนสถานะ login
 * - ยังไม่ตั้ง NEXT_PUBLIC_LIFF_ID → คืน null (เว็บใช้โหมดสาธิต กดเข้าได้เลย)
 * - เปิดในแอป LINE (LIFF) และยังไม่ login → redirect เข้า LINE อัตโนมัติ
 * - เปิดผ่านเว็บทั่วไป → ไม่บังคับ login LINE ใช้เว็บแบบเดิมได้ทันที
 *   (จะ login ด้วย LINE เมื่อกดปุ่ม ใช้ loginWithLiff())
 */
export async function initLiff(): Promise<{
  profile: LineProfile | null;
  inClient: boolean;
} | null> {
  if (!LIFF_ID || typeof window === "undefined") return null;
  try {
    const liff = (await import("@line/liff")).default;
    await liff.init({ liffId: LIFF_ID });
    const inClient = liff.isInClient();
    if (!liff.isLoggedIn()) {
      if (inClient) liff.login(); // ใน LINE: ดึงตัวตนอัตโนมัติ
      return { profile: null, inClient };
    }
    const profile = (await liff.getProfile()) as LineProfile;
    localStorage.setItem("lineProfile", JSON.stringify(profile));
    return { profile, inClient };
  } catch (e) {
    console.warn("LIFF init failed, fallback to demo login:", e);
    return null;
  }
}

/** กดปุ่ม "เข้าสู่ระบบด้วย LINE" (ทำงานได้ทั้งในและนอกแอป LINE) */
export async function loginWithLiff(): Promise<boolean> {
  if (!LIFF_ID || typeof window === "undefined") return false;
  try {
    const liff = (await import("@line/liff")).default;
    if (!liff.isLoggedIn()) {
      liff.login();
      return true; // กำลัง redirect ไปหน้า auth ของ LINE
    }
    const profile = (await liff.getProfile()) as LineProfile;
    localStorage.setItem("lineProfile", JSON.stringify(profile));
    return true;
  } catch (e) {
    console.warn("LIFF login failed:", e);
    return false;
  }
}

/** ดึง LINE ID Token (สำหรับยืนยันตัวตนกับ backend) — คืน null ถ้ายังไม่ login */
export async function getLineIdToken(): Promise<string | null> {
  if (!LIFF_ID || typeof window === "undefined") return null;
  try {
    const liff = (await import("@line/liff")).default;
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) return null;
    return liff.getIDToken();
  } catch {
    return null;
  }
}

export function getStoredLineProfile(): LineProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("lineProfile");
    return raw ? (JSON.parse(raw) as LineProfile) : null;
  } catch {
    return null;
  }
}
