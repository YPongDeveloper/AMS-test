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
 * Init LIFF และคืนโปรไฟล์ผู้ใช้ LINE (ถ้ามี)
 * - ยังไม่ตั้ง NEXT_PUBLIC_LIFF_ID → คืน null (ใช้โหมดสาธิตเดิม)
 * - ยังไม่ login → เรียก liff.login() ซึ่งจะ redirect ไปหน้า auth ของ LINE
 * - init ล้มเหลว (เช่นเปิดนอก LINE แล้ว config ผิด) → คืน null แล้วใช้โหมดสาธิตต่อ
 */
export async function initLiff(): Promise<LineProfile | null> {
  if (!LIFF_ID || typeof window === "undefined") return null;
  try {
    const liff = (await import("@line/liff")).default;
    await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });
    if (!liff.isLoggedIn()) {
      liff.login(); // redirect ไป LINE OAuth แล้วกลับมาที่หน้านี้อีกครั้ง
      return null;
    }
    const profile = (await liff.getProfile()) as LineProfile;
    localStorage.setItem("lineProfile", JSON.stringify(profile));
    return profile;
  } catch (e) {
    console.warn("LIFF init failed, fallback to demo login:", e);
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
