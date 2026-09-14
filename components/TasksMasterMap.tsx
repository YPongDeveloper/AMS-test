"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  MapPin,
  Navigation,
  Crosshair,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { type Task, type TaskStatus, STATUS_COLOR, STATUS_LABEL, TYPE_LABEL } from "@/lib/api";

interface TasksMasterMapProps {
  tasks: Task[];
  orderedIds: string[];
  onReorder: (newOrderedIds: string[]) => void;
  onSelectTask: (task: Task) => void;
  height?: string;
}

type LayerType = "hybrid" | "roadmap";

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
};

// คำนวณระยะทาง Haversine (กิโลเมตร)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function TasksMasterMap({
  tasks,
  orderedIds,
  onReorder,
  onSelectTask,
  height = "560px",
}: TasksMasterMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersGroupRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routePolylineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userGpsMarkerRef = useRef<any>(null);

  const [activeLayer, setActiveLayer] = useState<LayerType>("hybrid");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // กรองเฉพาะงานที่มีพิกัด
  const mappableTasks = useMemo(() => {
    return tasks.filter((t) => t.lat != null && t.lng != null);
  }, [tasks]);

  // เรียงลำดับงานตาม orderedIds
  const orderedTasks = useMemo(() => {
    const copy = [...mappableTasks];
    copy.sort((a, b) => {
      const idxA = orderedIds.indexOf(a.public_id);
      const idxB = orderedIds.indexOf(b.public_id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
    return copy;
  }, [mappableTasks, orderedIds]);

  // คำนวณระยะทางรวมตามลำดับ (Total Distance)
  const routeStats = useMemo(() => {
    if (orderedTasks.length === 0) return { totalKm: 0, count: 0 };
    let total = 0;

    // ถ้ามี GPS ของเรา ให้บวกระยะจากตำแหน่งเราไปยังจุดแรก
    if (userLocation && orderedTasks[0]?.lat != null && orderedTasks[0]?.lng != null) {
      total += calculateDistanceKm(
        userLocation.lat,
        userLocation.lng,
        orderedTasks[0].lat,
        orderedTasks[0].lng
      );
    }

    for (let i = 0; i < orderedTasks.length - 1; i++) {
      const curr = orderedTasks[i];
      const next = orderedTasks[i + 1];
      if (curr.lat != null && curr.lng != null && next.lat != null && next.lng != null) {
        total += calculateDistanceKm(curr.lat, curr.lng, next.lat, next.lng);
      }
    }

    return { totalKm: Number(total.toFixed(1)), count: orderedTasks.length };
  }, [orderedTasks, userLocation]);

  // ดึงตำแหน่ง GPS ของผู้ใช้
  const acquireUserGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsTracking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsTracking(false);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([pos.coords.latitude, pos.coords.longitude]);
        }
      },
      () => {
        setGpsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // เมื่อเริ่มต้น พยายามดึง GPS อัตโนมัติ 1 ครั้ง
  useEffect(() => {
    acquireUserGPS();
  }, [acquireUserGPS]);

  // สร้าง Pin Icon สีตามสถานะ
  // - รอรับงาน: ขาว (#ffffff) ขอบเข้ม
  // - กำลังปฏิบัติงาน / รับงานแล้ว: ฟ้าอ่อน (#38bdf8)
  // - เสร็จสิ้น: เขียว (#22c55e)
  // - ยกเลิก: แดง (#ef4444)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPinIcon = useCallback((L: any, seq: number, status: TaskStatus) => {
    let bgColor = "#ffffff";
    let textColor = "#0f172a";
    let borderColor = "#334155";
    let shadowColor = "rgba(0,0,0,0.3)";

    switch (status) {
      case "pending":
        bgColor = "#ffffff";
        textColor = "#0f172a";
        borderColor = "#475569";
        shadowColor = "rgba(0,0,0,0.35)";
        break;
      case "accepted":
      case "in_progress":
        bgColor = "#38bdf8"; // สีฟ้าอ่อน
        textColor = "#ffffff";
        borderColor = "#0284c7";
        shadowColor = "rgba(56, 189, 248, 0.45)";
        break;
      case "done":
        bgColor = "#22c55e"; // สีเขียว
        textColor = "#ffffff";
        borderColor = "#15803d";
        shadowColor = "rgba(34, 197, 94, 0.45)";
        break;
      case "cancelled":
        bgColor = "#ef4444"; // สีแดง
        textColor = "#ffffff";
        borderColor = "#991b1b";
        shadowColor = "rgba(239, 68, 68, 0.45)";
        break;
    }

    return L.divIcon({
      className: "ams-route-pin",
      html: `
        <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="background-color: ${bgColor}; color: ${textColor}; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px ${shadowColor}; border: 2.5px solid ${borderColor};">
            <span style="transform: rotate(45deg); font-size: 13px; font-weight: 800; font-family: ui-sans-serif, system-ui, sans-serif;">${seq}</span>
          </div>
          <div style="width: 8px; height: 4px; background: rgba(0,0,0,0.35); border-radius: 50%; margin-top: 2px; filter: blur(1px);"></div>
        </div>
      `,
      iconSize: [34, 42],
      iconAnchor: [17, 42],
      popupAnchor: [0, -38],
    });
  }, []);

  // เริ่มต้น Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMasterMap() {
      if (!mapContainerRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

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

      const defaultCenter: [number, number] = [13.8045, 100.5398]; // ย่านบางซื่อ / กรุงเทพฯ
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Tile Layer
      const cfg = TILE_LAYERS[activeLayer];
      const tiles = L.tileLayer(cfg.url, {
        subdomains: cfg.subdomains,
        maxZoom: cfg.maxZoom,
        attribution: cfg.attribution,
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Group สำหรับเก็บหมุดและเส้น
      markersGroupRef.current = L.featureGroup().addTo(map);
      mapInstanceRef.current = map;

      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
    }

    initMasterMap();

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

  // วาดหมุดงาน เส้นทาง และตำแหน่ง GPS ลงบนแผนที่
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!mapInstanceRef.current || !markersGroupRef.current) return;

      // ล้างของเก่าใน LayerGroup
      markersGroupRef.current.clearLayers();
      if (routePolylineRef.current) {
        mapInstanceRef.current.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      if (userGpsMarkerRef.current) {
        mapInstanceRef.current.removeLayer(userGpsMarkerRef.current);
        userGpsMarkerRef.current = null;
      }

      const allLatLngs: [number, number][] = [];

      // 1. วาดตำแหน่ง GPS ปัจจุบัน (ถ้ามี)
      if (userLocation) {
        const gpsIcon = L.divIcon({
          className: "ams-user-gps-pulse",
          html: `
            <div style="transform: translate(-50%, -50%); position: relative; width: 30px; height: 30px; display: flex; items-center; justify-content: center;">
              <div style="position: absolute; width: 30px; height: 30px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: relative; width: 14px; height: 14px; background: #2563eb; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4); margin: auto;"></div>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const gpsMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: gpsIcon,
          zIndexOffset: 1000,
        }).addTo(mapInstanceRef.current);

        gpsMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; text-align: center; padding: 2px;">
            <b style="color: #1d4ed8;">📍 ตำแหน่งปัจจุบันของคุณ (GPS)</b><br/>
            <span style="font-size: 11px; color: #64748b;">${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}</span>
          </div>
        `);

        userGpsMarkerRef.current = gpsMarker;
        allLatLngs.push([userLocation.lat, userLocation.lng]);
      }

      // 2. วาดหมุดงานตามลำดับ (1, 2, 3...)
      const routePoints: [number, number][] = [];
      if (userLocation) {
        routePoints.push([userLocation.lat, userLocation.lng]);
      }

      orderedTasks.forEach((task, idx) => {
        if (task.lat == null || task.lng == null) return;
        const seq = idx + 1;
        const pt: [number, number] = [task.lat, task.lng];
        routePoints.push(pt);
        allLatLngs.push(pt);

        const pinIcon = getPinIcon(L, seq, task.status);
        const marker = L.marker(pt, { icon: pinIcon }).addTo(markersGroupRef.current);

        const statusBg =
          task.status === "pending"
            ? "background:#f1f5f9; color:#334155;"
            : task.status === "done"
            ? "background:#dcfce7; color:#166534;"
            : task.status === "cancelled"
            ? "background:#fee2e2; color:#991b1b;"
            : "background:#e0f2fe; color:#0369a1;";

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; min-width: 200px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
              <span style="font-weight: bold; color: #1e3a8a;">ลำดับที่ ${seq}: ${task.code || "TASK"}</span>
              <span style="font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 9999px; ${statusBg}">
                ${STATUS_LABEL[task.status]}
              </span>
            </div>
            <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px; line-height: 1.3;">
              ${task.title}
            </div>
            ${
              task.place_name
                ? `<div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">📍 ${task.place_name}</div>`
                : ""
            }
            <div style="font-size: 11px; color: #4b5563; font-family: monospace; margin-bottom: 8px;">
              พิกัด: ${task.lat.toFixed(6)}, ${task.lng.toFixed(6)}
            </div>
            <button
              id="ams-open-task-${task.public_id}"
              style="width: 100%; background: #1e3a8a; color: white; border: none; border-radius: 6px; padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer;"
            >
              ดูรายละเอียดงานนี้ ↗
            </button>
          </div>
        `);

        marker.on("popupopen", () => {
          setSelectedPinId(task.public_id);
          const btn = document.getElementById(`ams-open-task-${task.public_id}`);
          if (btn) {
            btn.onclick = () => onSelectTask(task);
          }
        });
      });

      // 3. วาดเส้น Polyline เชื่อมโยงตามลำดับเส้นทาง
      if (routePoints.length >= 2) {
        const polyline = L.polyline(routePoints, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.85,
          dashArray: "8, 8",
          lineJoin: "round",
        }).addTo(mapInstanceRef.current);
        routePolylineRef.current = polyline;
      }

      // 4. ขยายมุมมองแผนที่ให้ครอบคลุมทุกจุดอัตโนมัติ (Fit Bounds)
      if (allLatLngs.length > 0) {
        try {
          mapInstanceRef.current.fitBounds(L.latLngBounds(allLatLngs), {
            padding: [45, 45],
            maxZoom: 16,
          });
        } catch {
          /* ignore bounds error */
        }
      }
    });
  }, [orderedTasks, userLocation, getPinIcon, onSelectTask]);

  // จัดการ ResizeObserver
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

  // เลื่อนลำดับงานขึ้น/ลง (Reorder Handlers)
  const moveTask = (taskIndex: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? taskIndex - 1 : taskIndex + 1;
    if (newIdx < 0 || newIdx >= orderedTasks.length) return;

    const newArr = [...orderedTasks];
    const [moved] = newArr.splice(taskIndex, 1);
    newArr.splice(newIdx, 0, moved);

    onReorder(newArr.map((t) => t.public_id));
  };

  // จัดลำดับเส้นทางอัตโนมัติ (Nearest Neighbor Algorithm)
  const autoOptimizeRoute = () => {
    if (orderedTasks.length <= 1) return;
    const startLat = userLocation?.lat ?? orderedTasks[0].lat!;
    const startLng = userLocation?.lng ?? orderedTasks[0].lng!;

    const remaining = [...orderedTasks];
    const result: Task[] = [];
    let curLat = startLat;
    let curLng = startLng;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDst = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const t = remaining[i];
        if (t.lat != null && t.lng != null) {
          const d = calculateDistanceKm(curLat, curLng, t.lat, t.lng);
          if (d < minDst) {
            minDst = d;
            nearestIdx = i;
          }
        }
      }
      const [nextTask] = remaining.splice(nearestIdx, 1);
      result.push(nextTask);
      if (nextTask.lat != null && nextTask.lng != null) {
        curLat = nextTask.lat;
        curLng = nextTask.lng;
      }
    }

    onReorder(result.map((t) => t.public_id));
  };

  // เลื่อนแผนที่ไปยังหมุดงานที่คลิกใน Itinerary List
  const focusTaskPin = (task: Task) => {
    if (!mapInstanceRef.current || task.lat == null || task.lng == null) return;
    mapInstanceRef.current.flyTo([task.lat, task.lng], 17, { animate: true, duration: 1.0 });
    setSelectedPinId(task.public_id);
  };

  const renderMapBox = () => (
    <div className="relative w-full h-full flex flex-col rounded-xl overflow-hidden border border-gray-300 shadow-sm bg-slate-100">
      {/* Top Floating Control Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex items-center justify-between pointer-events-none gap-2">
        {/* สรุปเส้นทาง & ตัวบ่งชี้ระยะทาง */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg shadow-md border border-gray-200 text-xs font-semibold text-govblue-900 flex items-center gap-2">
          <Navigation size={15} className="text-govblue-700 shrink-0" />
          <span>เส้นทางปฏิบัติงาน</span>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {orderedTasks.length} จุดภารกิจ
          </span>
          {routeStats.totalKm > 0 && (
            <span className="text-[11px] font-medium text-gray-600 border-l border-gray-200 pl-2">
              ~{routeStats.totalKm} กม. รวม
            </span>
          )}
        </div>

        {/* ปุ่มควบคุมเสริม */}
        <div className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur p-1 rounded-lg shadow-md border border-gray-200">
          {/* สลับ Layer */}
          <div className="flex items-center gap-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveLayer("hybrid")}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                activeLayer === "hybrid"
                  ? "bg-govblue-800 text-white shadow-xs"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              🛰️ ดาวเทียม
            </button>
            <button
              type="button"
              onClick={() => setActiveLayer("roadmap")}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                activeLayer === "roadmap"
                  ? "bg-govblue-800 text-white shadow-xs"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              🗺️ แผนที่
            </button>
          </div>

          <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

          {/* ปุ่มดึง GPS ตำแหน่งเรา */}
          <button
            type="button"
            onClick={acquireUserGPS}
            disabled={gpsTracking}
            className="p-1.5 text-govblue-700 hover:bg-govblue-50 rounded transition"
            title="ค้นหาตำแหน่ง GPS ปัจจุบันของฉัน"
          >
            <Crosshair size={15} className={gpsTracking ? "animate-spin text-govblue-600" : ""} />
          </button>

          <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

          {/* ปุ่มขยายเต็มจอ */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition"
            title={isFullscreen ? "ย่อหน้าจอ" : "ขยายแผนที่เต็มจอ"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* คำอธิบายสัญลักษณ์สีหมุด (Legend ด้านล่าง) */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-black/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-3 shadow pointer-events-none flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white border border-gray-400 inline-block shadow-xs" />
          <span>รอรับงาน (ขาว)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-sky-600 inline-block shadow-xs" />
          <span>กำลังทำ (ฟ้าอ่อน)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-700 inline-block shadow-xs" />
          <span>เสร็จสิ้น (เขียว)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-700 inline-block shadow-xs" />
          <span>ยกเลิก (แดง)</span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-gray-600 pl-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-300 inline-block animate-pulse" />
          <span>ตำแหน่งเรา (GPS)</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Wrapper Map Container */}
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
              ? "bg-white rounded-2xl shadow-2xl w-full h-full max-w-7xl flex flex-col overflow-hidden border border-gray-300 animate-in zoom-in-95 duration-150"
              : "w-full h-full flex flex-col"
          }
        >
          {/* Modal Header เมื่อ Fullscreen */}
          {isFullscreen && (
            <div className="px-5 py-3.5 bg-gradient-to-r from-govblue-900 via-govblue-800 to-govblue-900 text-white flex items-center justify-between shrink-0 shadow-sm border-b border-govblue-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-govgold-400 border border-white/10 shrink-0">
                  <Navigation size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">แผนที่รวมจุดปฏิบัติงานและแนะนำเส้นทางประจำวัน</h3>
                  <p className="text-[11px] text-blue-200">
                    แสดงหมุดจุดงานตามลำดับ แผนที่ภาพถ่ายดาวเทียม Google และเส้นทางเชื่อมต่อ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="px-3 py-1.5 text-xs text-blue-200 hover:text-white rounded-lg hover:bg-white/10 flex items-center gap-1.5 transition border border-white/10"
              >
                ปิดหน้าต่างขยาย
              </button>
            </div>
          )}

          {/* แผนที่จริง */}
          <div className="flex-1 w-full h-full relative min-h-0">{renderMapBox()}</div>
        </div>
      </div>

      {/* แผงจัดลำดับงานก่อน-หลัง (Task Itinerary & Route Sequence) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-govblue-900 flex items-center gap-2">
              <Navigation size={16} className="text-govblue-700" />
              ลำดับการลงพื้นที่ปฏิบัติงาน (Itinerary Route)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              จัดลำดับงานว่าจะไปจุดไหนก่อน-หลัง เพื่อให้ระบบคำนวณและวาดเส้นทางแนะนำบนแผนที่
            </p>
          </div>

          <button
            type="button"
            onClick={autoOptimizeRoute}
            disabled={orderedTasks.length <= 1}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-govblue-700 to-govblue-800 hover:from-govblue-800 hover:to-govblue-900 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition disabled:opacity-50 self-start sm:self-auto active:scale-95"
          >
            <Sparkles size={14} className="text-govgold-400" />
            จัดลำดับอัตโนมัติ (ใกล้สุดก่อน)
          </button>
        </div>

        {orderedTasks.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
            ไม่มีงานที่มีพิกัดแผนที่ในวันที่เลือก
          </div>
        ) : (
          <div className="space-y-2">
            {orderedTasks.map((task, idx) => {
              const seq = idx + 1;
              const isFirst = idx === 0;
              const isLast = idx === orderedTasks.length - 1;
              const isSelected = selectedPinId === task.public_id;

              return (
                <div
                  key={task.public_id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-govblue-50/70 border-govblue-400 shadow-xs ring-1 ring-govblue-400/50"
                      : "bg-white border-gray-200 hover:border-govblue-300 hover:bg-slate-50/60"
                  }`}
                >
                  {/* ลำดับเลข & รายละเอียดงาน */}
                  <div
                    onClick={() => focusTaskPin(task)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border ${
                        task.status === "pending"
                          ? "bg-white text-gray-900 border-gray-400"
                          : task.status === "done"
                          ? "bg-emerald-500 text-white border-emerald-600"
                          : task.status === "cancelled"
                          ? "bg-rose-500 text-white border-rose-600"
                          : "bg-sky-400 text-white border-sky-500"
                      }`}
                    >
                      {seq}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[11px] font-mono font-bold text-govblue-800 bg-govblue-50 px-2 py-0.5 rounded">
                          {task.code || "TASK"}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            STATUS_COLOR[task.status]
                          }`}
                        >
                          {STATUS_LABEL[task.status]}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {TYPE_LABEL[task.task_type] || task.task_type}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-gray-800 truncate">
                        {task.title}
                      </div>
                      {task.place_name && (
                        <div className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-rose-500 shrink-0" />
                          <span>{task.place_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ปุ่มควบคุมเลื่อนขึ้น-ลง & ปุ่มดูงาน */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveTask(idx, "up")}
                      disabled={isFirst}
                      className="p-1.5 text-gray-500 hover:text-govblue-800 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition"
                      title="เลื่อนขึ้นไปก่อนหน้า"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(idx, "down")}
                      disabled={isLast}
                      className="p-1.5 text-gray-500 hover:text-govblue-800 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition"
                      title="เลื่อนลงไปทำทีหลัง"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="px-2.5 py-1.5 bg-govblue-50 hover:bg-govblue-100 text-govblue-800 rounded-lg text-xs font-semibold transition ml-1"
                      title="ดูรายละเอียดงานเต็ม"
                    >
                      รายละเอียด
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
