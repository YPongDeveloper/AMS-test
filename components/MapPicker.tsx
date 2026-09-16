"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Search,
  Maximize2,
  Minimize2,
  ExternalLink,
  Crosshair,
  Check,
  AlertCircle,
  Loader2,
  X,
  WifiOff,
} from "lucide-react";

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange?: (lat: number | null, lng: number | null) => void;
  height?: string;
  showInputs?: boolean;
  readOnly?: boolean;
}

type LayerType = "hybrid" | "roadmap" | "osm";

const TILE_LAYERS: Record<
  LayerType,
  { name: string; url: string; subdomains: string[]; maxZoom: number; attribution: string }
> = {
  hybrid: {
    name: "🛰️ ดาวเทียม Google",
    url: "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    attribution: "&copy; Google Maps",
  },
  roadmap: {
    name: "🗺️ แผนที่ Google",
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    attribution: "&copy; Google Maps",
  },
  osm: {
    name: "🌐 OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  },
};

// แยกพิกัดจากข้อความ หรือ ลิงก์ Google Maps
function parseCoordinateInput(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Google Maps URL รูปแบบ @lat,lng
  // เช่น: https://www.google.com/maps/@13.880677,100.454334,17z
  // หรือ: https://www.google.com/maps/place/.../@13.880677,100.454334,17z
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

export default function MapPicker({
  lat,
  lng,
  onChange,
  height = "260px",
  showInputs = true,
  readOnly = false,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);

  const [activeLayer, setActiveLayer] = useState<LayerType>("hybrid");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const defaultCenter = { lat: 13.7563, lng: 100.5018 };
  const currentLat = lat ?? defaultCenter.lat;
  const currentLng = lng ?? defaultCenter.lng;
  const hasCoords = lat !== null && lng !== null;

  // ฟังก์ชันอัปเดตตำแหน่งแผนที่และหมุด
  const setPinPosition = useCallback(
    (newLat: number, newLng: number, zoomLevel?: number) => {
      if (readOnly) return;
      const formattedLat = Number(newLat.toFixed(6));
      const formattedLng = Number(newLng.toFixed(6));
      onChange?.(formattedLat, formattedLng);

      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLatLng([formattedLat, formattedLng]);
      }
      if (mapInstanceRef.current) {
        if (zoomLevel) {
          mapInstanceRef.current.setView([formattedLat, formattedLng], zoomLevel);
        } else {
          mapInstanceRef.current.panTo([formattedLat, formattedLng]);
        }
      }
    },
    [onChange, readOnly]
  );

  // เริ่มต้น Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      // ล้างแผนที่เก่าถ้ามี
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (
        mapContainerRef.current &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapContainerRef.current as any)._leaflet_id
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      // สร้าง Custom SVG Pin Marker ที่คมชัด
      const pinIcon = L.divIcon({
        className: "ams-custom-pin",
        html: `
          <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: ${readOnly ? "default" : "grab"};">
            <div style="background-color: #ef4444; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 2.5px solid #ffffff;">
              <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
            <div style="width: 8px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: 2px; filter: blur(1px);"></div>
          </div>
        `,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });

      const map = L.map(mapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: hasCoords ? 16 : 12,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Tile Layer เริ่มต้น
      const layerCfg = TILE_LAYERS[activeLayer];
      const tiles = L.tileLayer(layerCfg.url, {
        subdomains: layerCfg.subdomains,
        maxZoom: layerCfg.maxZoom,
        attribution: layerCfg.attribution,
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Marker ปักหมุด
      const marker = L.marker([currentLat, currentLng], {
        icon: pinIcon,
        draggable: !readOnly,
      }).addTo(map);

      if (readOnly) {
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.5; padding: 2px;">
            <b style="color: #1e3a8a;">📍 จุดปฏิบัติงานที่ได้รับมอบหมาย</b><br/>
            <span style="color: #4b5563; font-family: monospace; font-size: 11px;">${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}</span>
          </div>
        `);
      }

      if (!readOnly) {
        // เมื่อลากหมุดเสร็จ
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          setPinPosition(pos.lat, pos.lng);
        });

        // เมื่อคลิกบนแผนที่
        map.on("click", (e) => {
          setPinPosition(e.latlng.lat, e.latlng.lng);
        });
      }

      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;

      // กระตุ้น redraw เมื่อเริ่มต้น
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 350);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // สลับ Tile Layer เมื่อ activeLayer เปลี่ยน
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      if (!mapInstanceRef.current) return;
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }
      const cfg = TILE_LAYERS[activeLayer];
      const newTiles = L.tileLayer(cfg.url, {
        subdomains: cfg.subdomains,
        maxZoom: cfg.maxZoom,
        attribution: cfg.attribution,
      }).addTo(mapInstanceRef.current);
      tileLayerRef.current = newTiles;
    });
  }, [activeLayer]);

  // ซิงค์หมุดเมื่อพิกัดภายนอกเปลี่ยน
  useEffect(() => {
    if (!markerInstanceRef.current || !mapInstanceRef.current) return;
    if (lat !== null && lng !== null) {
      const curPos = markerInstanceRef.current.getLatLng();
      if (Math.abs(curPos.lat - lat) > 0.000001 || Math.abs(curPos.lng - lng) > 0.000001) {
        markerInstanceRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.panTo([lat, lng]);
      }
    }
  }, [lat, lng]);

  // ตรวจจับการเปลี่ยนแปลงขนาด container ด้วย ResizeObserver เพื่อปรับขนาด Leaflet อัตโนมัติ
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      ro.observe(mapContainerRef.current);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, []);

  // จัดการ Resize และปุ่ม ESC เมื่อเปิด/ปิด Fullscreen
  useEffect(() => {
    const t1 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 80);
    const t2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  // ดึง GPS อุปกรณ์
  const handleAcquireGPS = () => {
    if (!navigator.geolocation) {
      alert("อุปกรณ์ไม่รองรับการดึงพิกัด GPS");
      return;
    }
    setGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocating(false);
        setPinPosition(pos.coords.latitude, pos.coords.longitude, 17);
        setSearchMsg({ text: "ดึงพิกัดปัจจุบันจาก GPS สำเร็จ", tone: "ok" });
      },
      (err) => {
        setGpsLocating(false);
        alert("ไม่สามารถดึง GPS ได้: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ค้นหาสถานที่ หรือ วางลิงก์ Google Maps / พิกัด
  const handleSearchOrPaste = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    setSearchMsg(null);

    // 1. ลองถอดรหัสว่าเป็นพิกัด หรือ ลิงก์ Google Maps หรือไม่
    const parsedCoords = parseCoordinateInput(query);
    if (parsedCoords) {
      setPinPosition(parsedCoords.lat, parsedCoords.lng, 17);
      setSearchMsg({ text: `ตรวจพบพิกัด Google Maps: ${parsedCoords.lat}, ${parsedCoords.lng}`, tone: "ok" });
      setSearchInput("");
      return;
    }

    // 2. ถ้าไม่ใช่พิกัด ให้ค้นหาชื่อสถานที่ (Geocoding)
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=th&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const targetLat = parseFloat(data[0].lat);
        const targetLng = parseFloat(data[0].lon);
        setPinPosition(targetLat, targetLng, 16);
        setSearchMsg({ text: `พบสถานที่: ${data[0].display_name.split(",")[0]}`, tone: "ok" });
        setSearchInput("");
      } else {
        setSearchMsg({
          text: "ไม่พบสถานที่ ลองระบุชื่ออำเภอ/จังหวัด หรือวางพิกัดจาก Google Maps",
          tone: "err",
        });
      }
    } catch {
      setSearchMsg({ text: "เกิดข้อผิดพลาดในการค้นหา ลองวางพิกัดตัวเลขแทน", tone: "err" });
    } finally {
      setSearching(false);
    }
  };

  // เลื่อนมุมมองแผนที่ไปยังจุดพิกัดงานที่ได้รับมอบหมาย (Pan/Fly to target)
  const handleCenterOnTarget = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const targetLat = lat ?? defaultCenter.lat;
    const targetLng = lng ?? defaultCenter.lng;
    mapInstanceRef.current.flyTo([targetLat, targetLng], 17, {
      animate: true,
      duration: 1.0,
    });
    if (markerInstanceRef.current) {
      setTimeout(() => {
        if (markerInstanceRef.current) {
          markerInstanceRef.current.openPopup();
        }
      }, 500);
    }
  }, [lat, lng, defaultCenter.lat, defaultCenter.lng]);

  const renderMapBox = () => (
    <div className="relative w-full h-full flex flex-col rounded-lg overflow-hidden border border-gray-300 shadow-inner bg-slate-100">
      {/* Search & Tool Bar ด้านบนแผนที่ */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-row gap-1.5 items-center justify-between pointer-events-none">
        {/* ช่องค้นหา / วางลิงก์ Google Maps (เฉพาะโหมดเลือกพิกัด) หรือ ปุ่มเลื่อนไปยังจุดพิกัดงาน (โหมดดูอย่างเดียว) */}
        <div className="pointer-events-auto flex-1 max-w-md">
          {readOnly ? (
            <button
              type="button"
              onClick={handleCenterOnTarget}
              className="inline-flex items-center justify-center bg-white/95 hover:bg-white active:bg-govblue-50 backdrop-blur p-2 rounded-lg shadow-md border border-gray-200 hover:border-govblue-400 text-govblue-900 transition-all cursor-pointer group active:scale-95"
              title="เลื่อนแผนที่ไปยังจุดพิกัด"
            >
              <MapPin size={18} className="text-rose-600 shrink-0 group-hover:scale-110 transition-transform" />
            </button>
          ) : (
            <form onSubmit={handleSearchOrPaste} className="flex items-center bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 overflow-hidden">
              <Search size={16} className="ml-3 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="ค้นหาสถานที่ หรือ วางลิงก์ / พิกัด Google Maps..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-transparent focus:outline-none"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="p-1 mr-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="submit"
                disabled={searching}
                className="bg-govblue-700 hover:bg-govblue-800 text-white text-xs px-3 py-1.5 font-medium shrink-0 flex items-center gap-1 transition disabled:opacity-50"
              >
                {searching ? <Loader2 size={12} className="animate-spin" /> : "ค้นหา"}
              </button>
            </form>
          )}
        </div>

        {/* ปุ่มควบคุมเสริมบนแผนที่ */}
        <div className="pointer-events-auto flex items-center gap-1 shrink-0 bg-white/95 backdrop-blur p-1 rounded-lg shadow-md border border-gray-200">
          {/* ปุ่มสลับ Layer แผนที่ / ดาวเทียม (ปุ่มเดียวสลับได้) */}
          <button
            type="button"
            onClick={() => setActiveLayer((prev) => (prev === "hybrid" ? "roadmap" : "hybrid"))}
            className="px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 bg-govblue-700 hover:bg-govblue-800 text-white shadow-xs cursor-pointer"
            title={activeLayer === "hybrid" ? "สลับเป็นแผนที่ถนน" : "สลับเป็นภาพดาวเทียม"}
          >
            {activeLayer === "hybrid" ? "🗺️ แผนที่" : "🛰️ ดาวเทียม"}
          </button>

          {!readOnly && (
            <>
              <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />
              {/* ปุ่มดึง GPS */}
              <button
                type="button"
                onClick={handleAcquireGPS}
                disabled={gpsLocating}
                className="p-1.5 text-govblue-700 hover:bg-govblue-50 rounded transition"
                title="ดึงพิกัดปัจจุบันจาก GPS"
              >
                {gpsLocating ? <Loader2 size={15} className="animate-spin text-govblue-600" /> : <Crosshair size={15} />}
              </button>
            </>
          )}

          <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

          {/* ปุ่มขยายเต็มจอ */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition"
            title={isFullscreen ? "ย่อหน้าจอ" : readOnly ? "ขยายแผนที่เพื่อดูพื้นที่อย่างละเอียด" : "ขยายแผนที่เต็มจอเพื่อเลือกพิกัด"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ข้อความแจ้งเตือนผลค้นหา */}
      {searchMsg && (
        <div
          className={`absolute top-14 left-3 right-3 sm:right-auto sm:max-w-md z-[1000] px-3 py-1.5 rounded-md shadow-md text-xs flex items-center justify-between gap-2 border ${
            searchMsg.tone === "ok"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-rose-50 border-rose-300 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {searchMsg.tone === "ok" ? <Check size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
            <span className="truncate">{searchMsg.text}</span>
          </div>
          <button onClick={() => setSearchMsg(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* แถบสถานะด้านล่างแผนที่ */}
      <button
        type="button"
        onClick={readOnly ? handleCenterOnTarget : undefined}
        className={`absolute bottom-2 left-2 z-[1000] bg-black/75 backdrop-blur text-white px-2.5 py-1 rounded-md text-[11px] font-mono flex items-center gap-2 shadow transition ${
          readOnly ? "cursor-pointer hover:bg-black/90 active:scale-95" : "pointer-events-none"
        }`}
        title={readOnly ? "คลิกเพื่อเลื่อนกลับไปยังจุดพิกัดนี้" : undefined}
      >
        <MapPin size={12} className="text-rose-400 shrink-0" />
        <span>
          {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
        </span>
        <span className="text-[10px] text-gray-300 border-l border-gray-600 pl-2">
          {readOnly ? "จุดปฏิบัติงาน" : "คลิกหรือลากหมุดเพื่อเปลี่ยนพิกัด"}
        </span>
      </button>

      {/* ลิงก์เปิด Google Maps ด้านล่างขวา */}
      <div className="absolute bottom-2 right-12 z-[1000]">
        <a
          href={`https://www.google.com/maps?q=${currentLat},${currentLng}`}
          target="_blank"
          rel="noreferrer"
          className="bg-white/95 hover:bg-white text-govblue-800 border border-gray-300 text-[11px] font-medium px-2 py-1 rounded shadow-sm flex items-center gap-1 transition"
          title="เปิดตรวจสอบตำแหน่งบนเว็บไซต์ Google Maps"
        >
          <span>เปิดดูใน Google Maps</span>
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* แจ้งเตือนเมื่ออยู่ในโหมดออฟไลน์ */}
      {!isOnline && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2 shadow-xs">
          <WifiOff size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-bold text-amber-900">โหมดออฟไลน์ (ไม่มีสัญญาณอินเทอร์เน็ต): </span>
            <span className="text-amber-800">
              ภาพแผนที่ดาวเทียมอาจไม่แสดงผล ท่านสามารถพิมพ์ตัวเลขพิกัด ละติจูด / ลองจิจูด ในช่องด้านล่างเพื่อบันทึกพิกัดได้ตามปกติ
            </span>
          </div>
        </div>
      )}

      {/* Map Container Wrapper: เมื่อเป็น Fullscreen จะกลายเป็น Fixed Modal คลุมทั้งหน้าจอ */}
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
            : "w-full"
        }
        style={isFullscreen ? undefined : { height }}
      >
        <div
          className={
            isFullscreen
              ? "bg-white rounded-2xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden border border-gray-300 animate-in zoom-in-95 duration-150"
              : "w-full h-full flex flex-col"
          }
        >
          {/* Modal Header (แสดงเฉพาะเมื่อขยายเต็มจอ) */}
          {isFullscreen && (
            <div className="px-5 py-3.5 bg-gradient-to-r from-govblue-900 via-govblue-800 to-govblue-900 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-govblue-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-govgold-400 border border-white/10 shrink-0">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {readOnly
                      ? "ตำแหน่งจุดปฏิบัติงาน (Google Maps / ภาพถ่ายดาวเทียม)"
                      : "เลือกพิกัดจากแผนที่ Google Maps / ดาวเทียม"}
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    {readOnly
                      ? "แสดงพิกัดและสภาพภูมิประเทศจริงของจุดที่ต้องลงพื้นที่ปฏิบัติงาน"
                      : "คลิกบนแผนที่หรือลากหมุดสีแดงไปยังแปลงที่ดิน/สิ่งปลูกสร้างที่ต้องการ"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="bg-govgold-500 hover:bg-govgold-400 text-govblue-900 text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow"
                  >
                    <Check size={14} /> ยืนยันพิกัดนี้
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFullscreen(false)}
                  className="px-3 py-1.5 text-xs text-blue-200 hover:text-white rounded-lg hover:bg-white/10 flex items-center gap-1.5 transition border border-white/10"
                >
                  <X size={16} /> ปิดหน้าต่างขยาย
                </button>
              </div>
            </div>
          )}

          {/* Map Content (เรียก renderMapBox เพียง 1 ที่เท่านั้น เพื่อไม่ให้ Leaflet หลุดจาก DOM) */}
          <div className="flex-1 w-full h-full relative min-h-0">
            {renderMapBox()}
          </div>
        </div>
      </div>

      {/* ช่องกรอก Lat / Lng แบบตัวเลข (สองช่องด้านล่าง เฉพาะเมื่อไม่ใช่ readOnly) */}
      {showInputs && !readOnly && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ละติจูด (Lat) <span className="text-[10px] text-gray-400">คลิกเลือกบนแผนที่ได้</span>
            </label>
            <input
              type="number"
              step="0.000001"
              value={lat ?? ""}
              onChange={(e) => onChange?.(e.target.value ? Number(e.target.value) : null, lng)}
              placeholder="เช่น 13.880677"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ลองจิจูด (Lng) <span className="text-[10px] text-gray-400">คลิกเลือกบนแผนที่ได้</span>
            </label>
            <input
              type="number"
              step="0.000001"
              value={lng ?? ""}
              onChange={(e) => onChange?.(lat, e.target.value ? Number(e.target.value) : null)}
              placeholder="เช่น 100.454334"
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500 font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}
