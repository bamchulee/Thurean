"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapPin,
  Navigation,
  ExternalLink,
  Loader2,
  Check,
  Search,
  X,
  Compass,
} from "lucide-react";

interface MapLocationPickerProps {
  address: string;
  postalCode?: string;
  onAddressChange: (newAddress: string) => void;
  onPostalCodeChange?: (newPostalCode: string) => void;
  disabled?: boolean;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export function MapLocationPicker({
  address,
  postalCode,
  onAddressChange,
  onPostalCodeChange,
  disabled = false,
}: MapLocationPickerProps) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Map state
  const [mapLat, setMapLat] = useState(13.7563); // Default: Bangkok
  const [mapLng, setMapLng] = useState(100.5018);
  const [mapZoom, setMapZoom] = useState(14);
  const [pinnedAddressPreview, setPinnedAddressPreview] = useState("");
  const [pinnedPostalCode, setPinnedPostalCode] = useState("");
  const [resolvingAddress, setResolvingAddress] = useState(false);

  // Search state inside map modal
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Reverse geocode lat,lng into Thai address string
  const reverseGeocode = async (
    lat: number,
    lng: number
  ): Promise<{ formattedAddress: string; postalCode: string }> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th`,
        {
          headers: {
            "Accept-Language": "th,en",
          },
        }
      );
      if (!res.ok) throw new Error("Geocoding failed");
      const data = await res.json();
      const a = data.address || {};

      const road = a.road || a.pedestrian || a.suburb || "";
      const subdistrict =
        a.quarter || a.neighbourhood || a.subdistrict || a.village || "";
      const district = a.city_district || a.district || a.county || a.city || "";
      const province = a.province || a.state || "";
      const postcode = a.postcode || "";

      const isBkk =
        province.includes("กรุงเทพ") ||
        district.includes("กรุงเทพ") ||
        (data.display_name && data.display_name.includes("กรุงเทพ"));

      const parts: string[] = [];
      if (a.house_number) parts.push(`เลขที่ ${a.house_number}`);
      if (a.building) parts.push(a.building);
      if (road) parts.push(`ถ.${road}`);
      if (subdistrict)
        parts.push(isBkk ? `แขวง${subdistrict}` : `ต.${subdistrict}`);
      if (district) parts.push(isBkk ? `เขต${district}` : `อ.${district}`);
      if (province && !parts.some((p) => p.includes(province))) {
        parts.push(isBkk ? "กรุงเทพมหานคร" : `จ.${province}`);
      }

      const formatted =
        parts.length > 0 ? parts.join(" ") : data.display_name || "";
      return {
        formattedAddress: formatted,
        postalCode: postcode,
      };
    } catch {
      return {
        formattedAddress: `พิกัดละติจูด ${lat.toFixed(5)}, ลองจิจูด ${lng.toFixed(5)}`,
        postalCode: "",
      };
    }
  };

  // 1-Click Detect GPS Location
  const handleGetGps = () => {
    if (!navigator.geolocation) {
      setGpsError("เบราว์เซอร์นี้ไม่รองรับการดึงพิกัด GPS");
      setTimeout(() => setGpsError(""), 3500);
      return;
    }

    setGpsLoading(true);
    setGpsError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const { formattedAddress, postalCode: detectedPostcode } =
            await reverseGeocode(lat, lng);

          const mapsPin = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

          // Combine with existing address if user already typed house number
          let finalAddress = formattedAddress;
          if (address && !address.includes("maps.google.com")) {
            finalAddress = `${address.trim()} (${formattedAddress}) \n📍 หมุด: ${mapsPin}`;
          } else {
            finalAddress = `${formattedAddress} \n📍 หมุด: ${mapsPin}`;
          }

          onAddressChange(finalAddress);
          if (detectedPostcode && onPostalCodeChange) {
            onPostalCodeChange(detectedPostcode);
          }

          setGpsSuccess(true);
          setTimeout(() => setGpsSuccess(false), 2500);
        } catch {
          setGpsError("ไม่สามารถแปลงพิกัดเป็นชื่อที่อยู่ได้");
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("กรุณากด 'อนุญาต (Allow)' ให้เข้าถึงตำแหน่ง GPS บนอุปกรณ์");
        } else {
          setGpsError("ค้นหาสัญญาณ GPS ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
        setTimeout(() => setGpsError(""), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Open Interactive Map
  const handleOpenMap = () => {
    setIsMapModalOpen(true);
    // If address already contains coordinates, parse and center map on it
    const coordMatch = address.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      setMapLat(lat);
      setMapLng(lng);
      updatePinnedPreview(lat, lng);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapLat(pos.coords.latitude);
          setMapLng(pos.coords.longitude);
          updatePinnedPreview(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          updatePinnedPreview(mapLat, mapLng);
        },
        { timeout: 4000 }
      );
    } else {
      updatePinnedPreview(mapLat, mapLng);
    }
  };

  const updatePinnedPreview = async (lat: number, lng: number) => {
    setResolvingAddress(true);
    const res = await reverseGeocode(lat, lng);
    setPinnedAddressPreview(res.formattedAddress);
    setPinnedPostalCode(res.postalCode);
    setResolvingAddress(false);
  };

  // Search places in Thailand inside Map Modal
  const handleSearchPlaces = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&countrycodes=th&limit=5&accept-language=th`
      );
      if (res.ok) {
        const data = (await res.json()) as SearchResult[];
        setSearchResults(data);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setMapLat(lat);
    setMapLng(lng);
    setMapZoom(16);
    setSearchResults([]);
    setSearchQuery("");
    updatePinnedPreview(lat, lng);
  };

  // Confirm Pinned Location
  const handleConfirmPinnedLocation = () => {
    const mapsPin = `https://maps.google.com/?q=${mapLat.toFixed(6)},${mapLng.toFixed(6)}`;
    let finalAddr = pinnedAddressPreview || `พิกัดละติจูด ${mapLat.toFixed(5)}, ลองจิจูด ${mapLng.toFixed(5)}`;
    if (address && !address.includes("maps.google.com")) {
      finalAddr = `${address.trim()} (${pinnedAddressPreview}) \n📍 หมุด: ${mapsPin}`;
    } else {
      finalAddr = `${pinnedAddressPreview} \n📍 หมุด: ${mapsPin}`;
    }

    onAddressChange(finalAddr);
    if (pinnedPostalCode && onPostalCodeChange) {
      onPostalCodeChange(pinnedPostalCode);
    }
    setIsMapModalOpen(false);
  };

  // Open Google Maps search in new tab
  const handleOpenGoogleMaps = () => {
    if (!address.trim()) return;
    // If coordinates exist
    const coordMatch = address.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      window.open(
        `https://www.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}`,
        "_blank"
      );
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        address.trim()
      )}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-1.5">
      {/* Quick Action Pills for Map & GPS */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || gpsLoading}
          onClick={handleGetGps}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#1B4D31] border border-emerald-300 text-[11px] font-bold transition shadow-xs disabled:opacity-50"
        >
          {gpsLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-[#1B4D31]" />
          ) : gpsSuccess ? (
            <Check className="w-3 h-3 text-emerald-600" />
          ) : (
            <Navigation className="w-3 h-3 text-[#06C755]" />
          )}
          <span>
            {gpsLoading
              ? "กำลังดึงพิกัด..."
              : gpsSuccess
              ? "ดึงพิกัดแล้ว!"
              : "📍 ใช้พิกัด GPS ปัจจุบัน"}
          </span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={handleOpenMap}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-[11px] font-bold transition shadow-xs disabled:opacity-50"
        >
          <Compass className="w-3 h-3 text-sky-600" />
          <span>🗺️ เปิดแผนที่ปักหมุด</span>
        </button>

        {address.trim() && (
          <button
            type="button"
            onClick={handleOpenGoogleMaps}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold transition"
          >
            <span>ดูใน Google Maps</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {gpsError && (
        <p className="text-[10px] text-rose-600 font-semibold animate-pulse">
          ⚠️ {gpsError}
        </p>
      )}

      {/* Interactive Map Modal */}
      {isMapModalOpen && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsMapModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#11301F] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm text-white">
                    ปักหมุดที่อยู่จัดส่งทุเรียน
                  </h3>
                  <p className="text-[10px] text-emerald-300">
                    ลากหมุดหรือแตะบนแผนที่เพื่อเลือกตำแหน่งจัดส่ง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Landmark inside Map */}
            <div className="p-3 bg-stone-50 border-b border-stone-200">
              <form onSubmit={handleSearchPlaces} className="relative flex gap-1.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อหมู่บ้าน, คอนโด, ซอย, ถนน หรือสถานที่..."
                  className="flex-1 border border-stone-300 rounded-xl px-3 py-1.5 text-xs bg-white focus:border-[#06C755] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-[#1B4D31] hover:bg-[#143B25] text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1"
                >
                  {searching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>ค้นหา</span>
                </button>
              </form>

              {/* Search Suggestions */}
              {searchResults.length > 0 && (
                <div className="mt-2 bg-white border border-stone-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-stone-100 text-xs">
                  {searchResults.map((res) => (
                    <button
                      key={res.place_id}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left p-2.5 hover:bg-emerald-50 text-stone-800 flex items-start gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="truncate">{res.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Map Viewer Container */}
            <div className="relative flex-1 min-h-[300px] max-h-[380px] bg-stone-100 overflow-hidden">
              <iframe
                title="Location Map"
                className="w-full h-full border-0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(
                  mapLng - 0.005
                ).toFixed(5)}%2C${(mapLat - 0.003).toFixed(5)}%2C${(
                  mapLng + 0.005
                ).toFixed(5)}%2C${(mapLat + 0.003).toFixed(
                  5
                )}&layer=mapnik&marker=${mapLat.toFixed(5)}%2C${mapLng.toFixed(5)}`}
              />

              {/* Center Pin Indicator */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative -top-4 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-rose-600 border-2 border-white text-white flex items-center justify-center shadow-lg animate-bounce">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="w-2 h-2 rounded-full bg-rose-900/40 blur-[1px]" />
                </div>
              </div>

              {/* Fly to Current GPS Button */}
              <button
                type="button"
                onClick={handleGetGps}
                className="absolute right-3 bottom-3 bg-white/95 hover:bg-white text-stone-800 p-2.5 rounded-2xl shadow-lg border border-stone-200 flex items-center gap-1.5 text-xs font-bold transition z-10"
              >
                <Navigation className="w-4 h-4 text-[#06C755]" />
                <span>ตำแหน่งฉัน (GPS)</span>
              </button>
            </div>

            {/* Pinned Address Details & Confirmation */}
            <div className="p-4 bg-white border-t border-stone-200 space-y-3">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-emerald-950">
                      ตำแหน่งที่เลือก:
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      {mapLat.toFixed(4)}, {mapLng.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 font-semibold mt-0.5 leading-snug">
                    {resolvingAddress ? (
                      <span className="text-stone-400 italic flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        กำลังค้นหาชื่อที่อยู่...
                      </span>
                    ) : (
                      pinnedAddressPreview || "กำลังประมวลผลตำแหน่ง..."
                    )}
                  </p>
                  {pinnedPostalCode && (
                    <p className="text-[10px] text-emerald-800 font-bold mt-1">
                      รหัสไปรษณีย์: {pinnedPostalCode}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPinnedLocation}
                  className="flex-2 py-2.5 rounded-xl bg-[#1B4D31] hover:bg-[#143B25] text-amber-300 font-black text-xs transition shadow-md flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-amber-300" />
                  <span>ยืนยันพิกัดนี้ &amp; ใช้เป็นที่อยู่จัดส่ง</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
