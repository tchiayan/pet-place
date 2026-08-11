"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Locate, X, PawPrint, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Filters, Place } from "@/types/place";
import type { Bounds, MapHandle } from "@/components/Map";
import PlaceCard from "@/components/PlaceCard";
import SearchBar from "@/components/SearchBar";
import FilterPanel from "@/components/FilterPanel";
import SubmitModal from "@/components/SubmitModal";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const DEBOUNCE_MS = 400;

export default function HomePage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ category: "", seating: "", state: "" });
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  const mapRef = useRef<MapHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlaces = useCallback(
    async (q: string, f: Filters, loc: [number, number] | null, b: Bounds | null) => {
      setLoading(true);
      try {
        let result;
        if (q) {
          // Text search: ignore viewport, return all matches across Malaysia
          result = await api.places.search(q, f.state, f.category);
        } else if (loc && !f.state) {
          // "Near me" mode with no state filter
          result = await api.places.nearby(loc[0], loc[1], 5, f.category);
        } else if (b) {
          // Viewport mode: only fetch places visible in the current map bbox
          result = await api.places.list({
            limit: "500",
            north: String(b.north),
            south: String(b.south),
            east: String(b.east),
            west: String(b.west),
            ...(f.state ? { state: f.state } : {}),
            ...(f.category ? { category: f.category } : {}),
            ...(f.seating ? { seating: f.seating } : {}),
          });
        } else {
          result = await api.places.list({
            limit: "2000",
            ...(f.state ? { state: f.state } : {}),
            ...(f.category ? { category: f.category } : {}),
            ...(f.seating ? { seating: f.seating } : {}),
          });
        }
        setPlaces(result.items);
        // Auto-fit map when a text search or nearby search returns results
        if ((q || loc) && result.items.length > 0) {
          setTimeout(() => mapRef.current?.fitPlaces(result.items), 50);
        }
      } catch (err) {
        console.error("Failed to fetch places:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounce: re-fetch when query, filters, location, or map bounds change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPlaces(query, filters, userLocation, bounds);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, filters, userLocation, bounds, fetchPlaces]);

  // Load states for filter panel once
  useEffect(() => {
    api.states().then(setStates).catch(() => {});
  }, []);

  const locateMe = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => alert("Location access denied.")
    );
  };

  const hasFilters = !!(filters.category || filters.seating || filters.state);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <Map
        ref={mapRef}
        places={places}
        userLocation={userLocation}
        onMarkerClick={(p) => { setSelected(p); setShowList(false); }}
        onBoundsChange={setBounds}
      />

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3 flex items-center gap-2">
        <div className="bg-brand-600 text-white rounded-xl p-2 shadow-md shrink-0">
          <PawPrint className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <SearchBar
            value={query}
            onChange={setQuery}
            onFilterClick={() => setShowFilters((v) => !v)}
            hasFilters={hasFilters}
          />
        </div>
        <button
          onClick={locateMe}
          className="bg-white shadow-md rounded-xl p-2.5 border border-gray-200 hover:bg-gray-50 shrink-0"
          title="Use my location"
        >
          <Locate className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="absolute top-16 left-3 right-3 z-20 flex justify-center">
          <FilterPanel
            filters={filters}
            states={states}
            onChange={setFilters}
            onClose={() => setShowFilters(false)}
          />
        </div>
      )}

      {/* ── Bottom action bar ── */}
      <div className="bottom-bar absolute left-0 right-0 z-10 flex items-center justify-between px-4 pt-2">
        <button
          onClick={() => setShowSubmit(true)}
          className="flex items-center gap-1.5 bg-white border border-gray-200 shadow-lg rounded-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Plus className="w-4 h-4 text-brand-600" />
          Add a place
        </button>

        {loading ? (
          <span className="bg-white shadow rounded-full px-4 py-2 text-sm text-gray-500">
            Searching…
          </span>
        ) : (
          <button
            onClick={() => setShowList((v) => !v)}
            className="bg-brand-600 text-white shadow-lg rounded-full px-5 py-2 text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            {places.length} place{places.length !== 1 ? "s" : ""} {showList ? "▲" : "▼"}
          </button>
        )}
      </div>

      {/* ── Slide-up list ── */}
      {showList && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl max-h-[65vh] flex flex-col pb-safe">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-900">{places.length} results</p>
            <button onClick={() => setShowList(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-3 flex flex-col gap-2">
            {places.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                compact
                onClick={() => {
                  setSelected(p);
                  setShowList(false);
                  if (p.latitude && p.longitude) {
                    mapRef.current?.flyTo(p.latitude, p.longitude);
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Selected place card — sits above the bottom bar ── */}
      {selected && (
        <div className="absolute left-3 right-3 z-20" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900">{selected.name}</h2>
                {selected.address && (
                  <p className="text-xs text-gray-500 mt-0.5">{selected.address}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {selected.category && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {selected.category}
                    </span>
                  )}
                  {selected.seating && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {selected.seating}
                    </span>
                  )}
                </div>
                {selected.remarks && selected.remarks !== "None" && (
                  <p className="text-xs text-gray-500 mt-1.5 italic">{selected.remarks}</p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            {selected.latitude && selected.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block w-full text-center bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium py-2 rounded-xl transition-colors"
              >
                Get Directions
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Submit modal ── */}
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}
    </main>
  );
}
