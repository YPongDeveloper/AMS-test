// Geocoding and Address lookup utilities for Thailand and Google Maps coordinates

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
}

// Well-known Thai railway stations, landmarks, and districts fallback
export const THAI_LOCATION_FALLBACKS: Record<
  string,
  { lat: number; lng: number; name: string }
> = {
  "หัวลำโพง": { lat: 13.7388, lng: 100.5167, name: "สถานีรถไฟกรุงเทพ (หัวลำโพง) แขวงรองเมือง เขตปทุมวัน กรุงเทพฯ" },
  "กรุงเทพ": { lat: 13.7563, lng: 100.5018, name: "กรุงเทพมหานคร" },
  "อยุธยา": { lat: 14.3532, lng: 100.5828, name: "สถานีรถไฟอยุธยา ถ.นเรศวร ต.กะมัง อ.พระนครศรีอยุธยา จ.พระนครศรีอยุธยา" },
  "มักกะสัน": { lat: 13.7533, lng: 100.5595, name: "โรงงานรถไฟมักกะสัน แขวงมักกะสัน เขตราชเทวี กรุงเทพฯ" },
  "บางซื่อ": { lat: 13.8037, lng: 100.5398, name: "สถานีกลางกรุงเทพอภิวัฒน์ (บางซื่อ) ถ.กำแพงเพชร เขตจตุจักร กรุงเทพฯ" },
  "จตุจักร": { lat: 13.7999, lng: 100.5501, name: "ย่านพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ" },
  "ธนบุรี": { lat: 13.7584, lng: 100.4777, name: "สถานีรถไฟธนบุรี แขวงศิริราช เขตบางกอกน้อย กรุงเทพฯ" },
  "เชียงใหม่": { lat: 18.7844, lng: 99.0169, name: "สถานีรถไฟเชียงใหม่ ถ.เจริญเมือง ต.วัดเกต อ.เมือง จ.เชียงใหม่" },
  "ขอนแก่น": { lat: 16.4253, lng: 102.8258, name: "สถานีรถไฟขอนแก่น ถ.ดรุณสำราญ ต.ในเมือง อ.เมือง จ.ขอนแก่น" },
  "นครราชสีมา": { lat: 14.9733, lng: 102.0833, name: "สถานีรถไฟนครราชสีมา ถ.มุขมนตรี ต.ในเมือง อ.เมือง จ.นครราชสีมา" },
  "ปากช่อง": { lat: 14.706, lng: 101.416, name: "สถานีรถไฟปากช่อง ถ.มิตรภาพ ต.ปากช่อง อ.ปากช่อง จ.นครราชสีมา" },
  "พัทยา": { lat: 12.9236, lng: 100.9007, name: "สถานีรถไฟพัทยา อ.บางละมุง จ.ชลบุรี" },
  "หัวหิน": { lat: 12.5684, lng: 99.9547, name: "สถานีรถไฟหัวหิน ถ.พระปกเกล้า อ.หัวหิน จ.ประจวบคีรีขันธ์" },
  "หาดใหญ่": { lat: 7.0036, lng: 100.4688, name: "สถานีรถไฟชุมทางหาดใหญ่ ถ.รถไฟ ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา" },
  "พิษณุโลก": { lat: 16.8184, lng: 100.2647, name: "สถานีรถไฟพิษณุโลก ถ.เอกาทศรฐ ต.ในเมือง อ.เมือง จ.พิษณุโลก" },
  "สุราษฎร์ธานี": { lat: 9.1068, lng: 99.2312, name: "สถานีรถไฟสุราษฎร์ธานี ต.ท่าข้าม อ.พุนพิน จ.สุราษฎร์ธานี" },
  "อุบลราชธานี": { lat: 15.1972, lng: 104.8587, name: "สถานีรถไฟอุบลราชธานี ต.วารินชำราบ อ.วารินชำราบ จ.อุบลราชธานี" },
  "ชุมพร": { lat: 10.4939, lng: 99.18, name: "สถานีรถไฟชุมพร ต.ท่าตะเภา อ.เมือง จ.ชุมพร" },
  "ลพบุรี": { lat: 14.7995, lng: 100.6156, name: "สถานีรถไฟลพบุรี ถ.นารายณ์มหาราช ต.ท่าหิน อ.เมือง จ.ลพบุรี" },
  "ฉะเชิงเทรา": { lat: 13.6974, lng: 101.0664, name: "สถานีรถไฟชุมทางฉะเชิงเทรา ต.หน้าเมือง อ.เมือง จ.ฉะเชิงเทรา" },
  "ราชบุรี": { lat: 13.5358, lng: 99.8247, name: "สถานีรถไฟราชบุรี ต.หน้าเมือง อ.เมือง จ.ราชบุรี" },
  "นครปฐม": { lat: 13.8219, lng: 100.0636, name: "สถานีรถไฟนครปฐม ต.พระปฐมเจดีย์ อ.เมือง จ.นครปฐม" },
  "สระบุรี": { lat: 14.5292, lng: 100.9122, name: "สถานีรถไฟสระบุรี ต.ปากเพรียว อ.เมือง จ.สระบุรี" },
};

/**
 * แยกพิกัดจากข้อความ ละติจูด, ลองจิจูด หรือ URL Google Maps
 */
export function parseCoordinateInput(input: string): { lat: number; lng: number } | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;

  // 1. Google Maps URL รูปแบบ @lat,lng
  const urlAtMatch = trimmed.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (urlAtMatch) {
    return { lat: parseFloat(urlAtMatch[1]), lng: parseFloat(urlAtMatch[2]) };
  }

  // 2. Google Maps URL รูปแบบ ?q=lat,lng หรือ ?ll=lat,lng
  const queryMatch = trimmed.match(/[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  }

  // 3. พิกัดตัวเลข "13.880677, 100.454334" หรือ "13.880677 100.454334"
  const plainMatch = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (plainMatch) {
    const pLat = parseFloat(plainMatch[1]);
    const pLng = parseFloat(plainMatch[2]);
    if (pLat >= -90 && pLat <= 90 && pLng >= -180 && pLng <= 180) {
      return { lat: pLat, lng: pLng };
    }
  }

  return null;
}

/**
 * ค้นหาพิกัดจากที่อยู่ หรือชื่อสถานที่ (Address Geocoding)
 */
export async function searchAddressCoordinates(query: string): Promise<GeocodingResult | null> {
  const trimmed = (query || "").trim();
  if (!trimmed) return null;

  // 1. ลองตรวจสอบว่าผู้ใช้ป้อนพิกัดตัวเลข หรือ ลิงก์ Google Maps ตรงๆ
  const parsedCoords = parseCoordinateInput(trimmed);
  if (parsedCoords) {
    return {
      lat: Number(parsedCoords.lat.toFixed(6)),
      lng: Number(parsedCoords.lng.toFixed(6)),
      displayName: `พิกัด Google Maps (${parsedCoords.lat.toFixed(6)}, ${parsedCoords.lng.toFixed(6)})`,
    };
  }

  // 2. ค้นหาผ่าน OpenStreetMap Nominatim Geocoding API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&countrycodes=th&limit=1`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: Number(parseFloat(data[0].lat).toFixed(6)),
          lng: Number(parseFloat(data[0].lon).toFixed(6)),
          displayName: data[0].display_name || trimmed,
        };
      }
    }
  } catch {
    // Timeout or network offline -> proceed to fallback dictionary
  }

  // 3. ค้นหาจากพจนานุกรมสถานที่สำคัญและสถานีรถไฟ
  for (const [key, loc] of Object.entries(THAI_LOCATION_FALLBACKS)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return {
        lat: loc.lat,
        lng: loc.lng,
        displayName: loc.name,
      };
    }
  }

  return null;
}
