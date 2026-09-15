"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MapPin,
  Search,
  Crosshair,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Info,
  Compass,
} from "lucide-react";

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface ThaiAreaResult {
  sqm: number;
  totalWah: number;
  rai: number;
  ngan: number;
  wa: number;
  formattedThai: string;
}

/**
 * คำนวณขนาดพื้นที่ Geodesic Spherical Polygon (ตารางเมตร)
 * ใช้สูตร Spherical Excess บนทรงกลม WGS84 รัศมี 6,378,137 เมตร
 */
export function computePolygonAreaSqm(coords: LatLngPoint[]): number {
  if (!coords || coords.length < 3) return 0;
  const R = 6378137; // Earth's mean radius in meters
  let area = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const j = (i + 1) % len;
    const p1 = coords[i];
    const p2 = coords[j];
    const rad1 = (p1.lat * Math.PI) / 180;
    const rad2 = (p2.lat * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    area += dLng * (2 + Math.sin(rad1) + Math.sin(rad2));
  }

  area = Math.abs((area * R * R) / 2);
  return Math.round(area * 100) / 100;
}

/**
 * แปลงหน่วยพื้นที่จาก ตารางเมตร เป็น ไร่ - งาน - ตารางวา
 */
export function sqmToThaiArea(sqm: number): ThaiAreaResult {
  const totalWah = sqm / 4;
  const rai = Math.floor(totalWah / 400);
  const remWahAfterRai = totalWah - rai * 400;
  const ngan = Math.floor(remWahAfterRai / 100);
  const wa = Math.round((remWahAfterRai - ngan * 100) * 100) / 100;

  return {
    sqm: Math.round(sqm * 100) / 100,
    totalWah: Math.round(totalWah * 100) / 100,
    rai,
    ngan,
    wa,
    formattedThai: `${rai} ไร่ ${ngan} งาน ${wa.toFixed(1)} ตร.ว.`,
  };
}

interface SurveyPolygonMapProps {
  initialLat?: number | null;
  initialLng?: number | null;
  initialPoints?: LatLngPoint[];
  onChange?: (points: LatLngPoint[], area: ThaiAreaResult) => void;
  height?: string;
  readOnly?: boolean;
}

export default function SurveyPolygonMap({
  initialLat,
  initialLng,
  initialPoints = [],
  onChange,
  height = "380px",
  readOnly = false,
}: SurveyPolygonMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygonLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersGroupRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null);

  const [points, setPoints] = useState<LatLngPoint[]>(initialPoints || []);
  const [activeLayer, setActiveLayer] = useState<"hybrid" | "roadmap">("hybrid");
  const [gpsLocating, setGpsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  const defaultCenter = { lat: 13.7563, lng: 100.5018 };
  const centerLat = initialLat ?? defaultCenter.lat;
  const centerLng = initialLng ?? defaultCenter.lng;

  // Real-time area calculation
  const currentArea = computePolygonAreaSqm(points);
  const thaiArea = sqmToThaiArea(currentArea);

  // Sync back to parent
  const notifyChange = useCallback(
    (newPts: LatLngPoint[]) => {
      const area = computePolygonAreaSqm(newPts);
      const th = sqmToThaiArea(area);
      onChange?.(newPts, th);
    },
    [onChange]
  );

  // Re-draw polygon and markers on leaflet map
  const redrawGeometry = useCallback(
    (currentPts: LatLngPoint[]) => {
      const L = LRef.current;
      const map = mapInstanceRef.current;
      if (!L || !map) return;

      // 1. Clear previous markers
      if (markersGroupRef.current) {
        markersGroupRef.current.clearLayers();
      } else {
        markersGroupRef.current = L.layerGroup().addTo(map);
      }

      // 2. Clear previous polygon
      if (polygonLayerRef.current) {
        map.removeLayer(polygonLayerRef.current);
        polygonLayerRef.current = null;
      }

      if (currentPts.length === 0) return;

      const latLngs = currentPts.map((p) => [p.lat, p.lng]);

      // Draw Polyline or Polygon
      if (currentPts.length === 1) {
        // Just single point marker
      } else if (currentPts.length === 2) {
        polygonLayerRef.current = L.polyline(latLngs, {
          color: "#10b981",
          weight: 3.5,
          dashArray: "6, 6",
          opacity: 0.9,
        }).addTo(map);
      } else {
        polygonLayerRef.current = L.polygon(latLngs, {
          color: "#059669",
          weight: 3.5,
          fillColor: "#10b981",
          fillOpacity: 0.35,
        }).addTo(map);
      }

      // Add vertex markers
      currentPts.forEach((p, idx) => {
        const vertexIcon = L.divIcon({
          className: "ams-vertex-pin",
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background-color: ${idx === 0 ? "#059669" : "#2563eb"};
              color: white;
              font-size: 11px;
              font-weight: bold;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.5);
              cursor: ${readOnly ? "default" : "grab"};
            ">
              ${idx + 1}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const m = L.marker([p.lat, p.lng], {
          icon: vertexIcon,
          draggable: !readOnly,
        });

        if (!readOnly) {
          // Drag vertex point to adjust boundary
          m.on("drag", (e: any) => {
            const newPos = e.target.getLatLng();
            const updated = [...currentPts];
            updated[idx] = {
              lat: Number(newPos.lat.toFixed(6)),
              lng: Number(newPos.lng.toFixed(6)),
            };
            setPoints(updated);

            // Update polygon in real-time
            if (polygonLayerRef.current) {
              polygonLayerRef.current.setLatLngs(updated.map((pt) => [pt.lat, pt.lng]));
            }
          });

          m.on("dragend", (e: any) => {
            const newPos = e.target.getLatLng();
            setPoints((prev) => {
              const updated = [...prev];
              updated[idx] = {
                lat: Number(newPos.lat.toFixed(6)),
                lng: Number(newPos.lng.toFixed(6)),
              };
              notifyChange(updated);
              return updated;
            });
          });
        }

        markersGroupRef.current.addLayer(m);
      });
    },
    [readOnly, notifyChange]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!mapContainerRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      LRef.current = L;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (
        mapContainerRef.current &&
        (mapContainerRef.current as any)._leaflet_id
      ) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      // Initial center: first polygon point or task coords or default
      const startLat = initialPoints.length > 0 ? initialPoints[0].lat : centerLat;
      const startLng = initialPoints.length > 0 ? initialPoints[0].lng : centerLng;

      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: initialPoints.length > 0 ? 17 : 16,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Tile Layer (Google Satellite Hybrid by default)
      const tileUrl =
        activeLayer === "hybrid"
          ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

      const tiles = L.tileLayer(tileUrl, {
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        maxZoom: 20,
        attribution: "&copy; Google Maps",
      }).addTo(map);
      tileLayerRef.current = tiles;

      mapInstanceRef.current = map;

      // Handle map click to add vertex points
      if (!readOnly) {
        map.on("click", (e: any) => {
          const newPt: LatLngPoint = {
            lat: Number(e.latlng.lat.toFixed(6)),
            lng: Number(e.latlng.lng.toFixed(6)),
          };
          setPoints((prev) => {
            const next = [...prev, newPt];
            notifyChange(next);
            redrawGeometry(next);
            return next;
          });
        });
      }

      // If we have initial points, fit bounds
      if (initialPoints.length > 0) {
        redrawGeometry(initialPoints);
        if (initialPoints.length >= 2) {
          const bounds = L.latLngBounds(initialPoints.map((p) => [p.lat, p.lng]));
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      }
    }

    init();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [centerLat, centerLng, readOnly]);

  // Update tile layer when activeLayer changes
  useEffect(() => {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      activeLayer === "hybrid"
        ? "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

    const tiles = L.tileLayer(tileUrl, {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      maxZoom: 20,
      attribution: "&copy; Google Maps",
    }).addTo(map);
    tileLayerRef.current = tiles;
  }, [activeLayer]);

  // Undo last point
  const handleUndo = () => {
    if (readOnly || points.length === 0) return;
    const next = points.slice(0, -1);
    setPoints(next);
    notifyChange(next);
    redrawGeometry(next);
  };

  // Clear all points
  const handleClear = () => {
    if (readOnly || points.length === 0) return;
    setPoints([]);
    notifyChange([]);
    redrawGeometry([]);
  };

  // Locate current GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setSearchMsg("อุปกรณ์ไม่รองรับ GPS");
      return;
    }
    setGpsLocating(true);
    setSearchMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 18);
        }
      },
      (err) => {
        setGpsLocating(false);
        setSearchMsg("ไม่สามารถเข้าถึงพิกัด GPS ของคุณได้");
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Search coordinate or location
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchMsg(null);

    // Check if coordinate
    const plainMatch = q.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
    if (plainMatch) {
      const pLat = parseFloat(plainMatch[1]);
      const pLng = parseFloat(plainMatch[2]);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([pLat, pLng], 18);
      }
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&countrycodes=th&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const itemLat = parseFloat(data[0].lat);
        const itemLng = parseFloat(data[0].lon);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([itemLat, itemLng], 17);
        }
      } else {
        setSearchMsg("ไม่พบสถานที่ที่ค้นหา");
      }
    } catch {
      setSearchMsg("ค้นหาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
      {/* Top Toolbar */}
      <div className="p-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold flex items-center gap-1.5 text-emerald-400">
            <Layers size={15} />
            ภาพถ่ายดาวเทียมสำรวจรังวัดแนวเขต
          </span>
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveLayer("hybrid")}
              className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition ${
                activeLayer === "hybrid"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              🛰️ ดาวเทียม
            </button>
            <button
              type="button"
              onClick={() => setActiveLayer("roadmap")}
              className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition ${
                activeLayer === "roadmap"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              🗺️ แผนที่
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                disabled={points.length === 0}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1 text-[11px] transition"
                title="ย้อนกลับจุดล่าสุด"
              >
                <RotateCcw size={12} /> ย้อนกลับจุด
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={points.length === 0}
                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 disabled:opacity-40 text-rose-300 rounded-lg border border-rose-800/60 flex items-center gap-1 text-[11px] transition"
                title="ล้างแนวเขตที่วาดทั้งหมด"
              >
                <Trash2 size={12} /> ล้างทั้งหมด
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={gpsLocating}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1 text-[11px] transition"
            title="ค้นหาตำแหน่ง GPS ปัจจุบันของฉัน"
          >
            <Crosshair size={12} className={gpsLocating ? "animate-spin text-emerald-400" : ""} />
            {gpsLocating ? "กำลังค้นหา..." : "GPS ของฉัน"}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {!readOnly && (
        <form onSubmit={handleSearch} className="px-3 py-1.5 bg-slate-800 border-b border-slate-700 flex items-center gap-2 text-xs">
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อสถานที่ หรือ พิกัดตัวเลข เช่น 13.7563, 100.5018..."
            className="w-full bg-transparent text-white placeholder-slate-400 text-xs focus:outline-hidden"
          />
          <button
            type="submit"
            className="px-2.5 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[11px] shrink-0"
          >
            ค้นหา
          </button>
          {searchMsg && <span className="text-amber-400 text-[11px] shrink-0">{searchMsg}</span>}
        </form>
      )}

      {/* Map Container */}
      <div className="relative">
        <div ref={mapContainerRef} style={{ height, width: "100%" }} />

        {/* Live Calculation HUD Card */}
        <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md text-white border border-slate-700/80 rounded-xl p-3 shadow-xl max-w-xs">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mb-1">
            <Compass size={14} />
            <span>คำนวณขนาดพื้นที่อัตโนมัติ</span>
          </div>

          {points.length < 3 ? (
            <div className="text-[11px] text-slate-300 leading-relaxed">
              {readOnly ? (
                <span>ยังไม่มีข้อมูลแนวเขตแปลงที่ดิน</span>
              ) : (
                <span>
                  คลิกบนแผนที่ดาวเทียมอย่างน้อย <strong className="text-amber-300">3 จุด</strong> เพื่อล้อมกรอบแนวเขตแปลงที่ดิน
                </span>
              )}
              <div className="mt-1 text-slate-400 text-[10px]">
                ปักแล้ว {points.length} จุด
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-emerald-300">
                {thaiArea.formattedThai}
              </div>
              <div className="text-xs text-slate-300 flex items-center justify-between">
                <span>ขนาดพื้นที่รวม:</span>
                <span className="font-bold text-white font-mono">
                  {thaiArea.sqm.toLocaleString()} ตร.ม.
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-700/70 pt-1">
                <span>จุดแนวเขต (Vertices):</span>
                <span className="font-mono text-emerald-400 font-bold">{points.length} จุด</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Helper Instruction */}
        {!readOnly && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[1000] bg-black/75 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[11px] border border-white/10 shadow-lg pointer-events-none flex items-center gap-1.5">
            <Info size={13} className="text-emerald-400 shrink-0" />
            <span>คลิกบนแผนที่เพื่อเพิ่มจุดแนวเขต • ลากจุดเพื่อปรับแนวได้</span>
          </div>
        )}
      </div>

      {/* Bottom Summary Bar */}
      <div className="p-3 bg-emerald-50/80 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            📐
          </div>
          <div>
            <span className="text-[11px] text-emerald-800 font-semibold block">
              ผลการคำนวณขนาดแปลงที่ดิน (ส่งเข้าแบบฟอร์มอัตโนมัติ):
            </span>
            <span className="text-emerald-950 font-bold">
              {thaiArea.formattedThai} ({thaiArea.sqm.toLocaleString()} ตารางเมตร)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
          <span className="text-slate-400">พิกัดจุดศูนย์กลาง:</span>
          <span>
            {points.length > 0
              ? `${points[0].lat.toFixed(6)}, ${points[0].lng.toFixed(6)}`
              : `${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
