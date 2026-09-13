"use client";

// MapPicker — ปักหมุดพิกัดสถานที่งาน
// มี NEXT_PUBLIC_GOOGLE_MAPS_API_KEY → Google Maps คลิกปักหมุดได้
// ไม่มี key → กรอกพิกัดเอง + ลิงก์เปิด Google Maps ช่วยหาพิกัด

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";

const GM_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

let gmapsPromise: Promise<any> | null = null;
function loadGoogleMaps(): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (!gmapsPromise) {
    gmapsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GM_KEY}&language=th&region=TH`;
      s.async = true;
      s.onload = () => resolve((window as any).google);
      s.onerror = () => reject(new Error("โหลด Google Maps ไม่สำเร็จ"));
      document.head.appendChild(s);
    });
  }
  return gmapsPromise;
}

export default function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapError, setMapError] = useState("");

  const hasCoords = lat != null && lng != null;
  const center = hasCoords ? { lat: lat as number, lng: lng as number } : { lat: 13.7563, lng: 100.5018 };

  useEffect(() => {
    if (!GM_KEY || mapRef.current) return;
    loadGoogleMaps()
      .then((google) => {
        if (!mapDiv.current || mapRef.current) return;
        const map = new google.maps.Map(mapDiv.current, {
          center,
          zoom: hasCoords ? 16 : 11,
          mapTypeControl: false,
          streetViewControl: false,
        });
        map.addListener("click", (e: any) => {
          const p = e.latLng;
          onChange(Number(p.lat().toFixed(7)), Number(p.lng().toFixed(7)));
        });
        mapRef.current = map;
        (window as any).__amsMap = map;
      })
      .catch((e) => setMapError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [GM_KEY]);

  // sync marker กับค่า lat/lng ปัจจุบัน
  useEffect(() => {
    const google = (window as any).google;
    if (!google?.maps || !mapRef.current) return;
    if (hasCoords) {
      const pos = { lat: lat as number, lng: lng as number };
      if (!markerRef.current) {
        markerRef.current = new google.maps.Marker({ position: pos, map: mapRef.current, title: "จุดงาน" });
      } else {
        markerRef.current.setPosition(pos);
      }
      mapRef.current.panTo(pos);
    } else if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, [lat, lng, hasCoords]);

  return (
    <div>
      {GM_KEY ? (
        <>
          <div
            ref={mapDiv}
            className="w-full h-56 rounded-lg border border-gray-300 overflow-hidden"
            style={{ backgroundColor: "#e5eef7" }}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            คลิกบนแผนที่เพื่อปักหมุดจุดปฏิบัติงาน (ปัจจุบัน:{" "}
            {hasCoords ? `${lat!.toFixed(6)}, ${lng!.toFixed(6)}` : "ยังไม่ระบุ"})
          </p>
          {hasCoords && (
            <a
              className="text-[11px] text-govblue-600 hover:underline"
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
            >
              เปิดดูใน Google Maps ↗
            </a>
          )}
          {mapError && <p className="text-[11px] text-rose-600 mt-1">{mapError}</p>}
        </>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              placeholder="ละติจูด (13.7563)"
              value={lat ?? ""}
              onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), lng)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
            />
            <input
              type="number"
              step="any"
              placeholder="ลองจิจูด (100.5018)"
              value={lng ?? ""}
              onChange={(e) => onChange(lat, e.target.value === "" ? null : Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-govblue-500/20 focus:border-govblue-500"
            />
          </div>
          <p className="text-[11px] text-gray-500">
            เคล็ดลับ: เปิด{" "}
            <a
              className="text-govblue-600 hover:underline"
              href="https://www.google.com/maps"
              target="_blank"
              rel="noreferrer"
            >
              Google Maps
            </a>{" "}
            คลิกถูกที่จุดงานเพื่อคัดลอกพิกัด แล้ววางที่นี่ (ตั้งค่า NEXT_PUBLIC_GOOGLE_MAPS_API_KEY เพื่อใช้แผนที่เลือกจุดในหน้าเว็บ)
          </p>
        </div>
      )}
    </div>
  );
}
