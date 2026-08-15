"use client";

import { SignInButton, SignedIn, SignedOut, UserButton, useAuth, useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Locate, X, UserCircle2, Plus, ShieldCheck, ChevronDown } from "lucide-react";
import { api, type UserOut } from "@/lib/api";
import type { Filters, Place } from "@/types/place";
import type { Bounds, MapHandle } from "@/components/Map";
import PlaceCard from "@/components/PlaceCard";
import SearchBar from "@/components/SearchBar";
import FilterPanel from "@/components/FilterPanel";
import SubmitModal from "@/components/SubmitModal";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const DEBOUNCE_MS = 400;

export default function HomePage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const [appUser, setAppUser] = useState<UserOut | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ category: "", seating: "", state: "" });
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [ipCenter, setIpCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);

  const mapRef = useRef<MapHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPlaces = useCallback(
    async (q: string, f: Filters, b: Bounds | null) => {
      setLoading(true);
      try {
        let result;
        if (q) {
          result = await api.places.search(q, f.state, f.category);
        } else if (b) {
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
        if (q && result.items.length > 0) {
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPlaces(query, filters, bounds);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, filters, bounds, fetchPlaces]);

  useEffect(() => {
    api.states().then(setStates).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${window.location.protocol}//ip-api.com/json/?fields=status,lat,lon`)
      .then((r) => r.json())
      .then((d) => { if (d.status === "success") setIpCenter([d.lat, d.lon]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) { setAppUser(null); return; }
    let cancelled = false;
    getToken().then((token) => {
      if (cancelled || !token) return;
      api.users.me(token).then((u) => { if (!cancelled) setAppUser(u); }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn || !clerkUser) return;
    getToken().then((token) => {
      if (!token) return;
      const name = clerkUser.fullName;
      const email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
      if (name || email) api.users.sync(token, { name, email }).catch(() => {});
    });
  }, [isSignedIn, clerkUser, getToken]);

  const locateMe = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => alert("Location access denied.")
    );
  };

  const hasFilters = !!(filters.category || filters.seating || filters.state);

  return (
    <main id="main-content" className="relative w-screen overflow-hidden">
      <Map
        ref={mapRef}
        places={places}
        userLocation={userLocation}
        ipCenter={ipCenter}
        onMarkerClick={(p) => { setSelected(p); setShowList(false); }}
        onBoundsChange={setBounds}
      />

      {/* ── Top bar: search + avatar ── */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))",
          paddingBottom: "0.75rem",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0.75rem))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right, 0.75rem))",
        }}
      >
        <div className="flex-1 min-w-0">
          <SearchBar
            value={query}
            onChange={setQuery}
            onFilterClick={() => setShowFilters((v) => !v)}
            hasFilters={hasFilters}
          />
        </div>

        {/* Avatar area — skeleton while Clerk resolves the session after OAuth redirect */}
        {!isLoaded ? (
          <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 shrink-0 animate-pulse" aria-hidden="true" />
        ) : (
          <>
            <SignedIn>
              {appUser && ["admin", "superadmin"].includes(appUser.role) && (
                <a
                  href="/admin"
                  className="bg-white shadow-md rounded-full p-2.5 border border-gray-200 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
                  aria-label="Admin panel"
                >
                  <ShieldCheck className="w-5 h-5 text-brand-600" aria-hidden="true" />
                </a>
              )}
              <div className="shrink-0">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>

            <SignedOut>
              <SignInButton mode="modal">
                <button
                  className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 shrink-0"
                  aria-label="Sign in"
                >
                  <UserCircle2 className="w-6 h-6 text-gray-400" aria-hidden="true" />
                </button>
              </SignInButton>
            </SignedOut>
          </>
        )}
      </div>

      {/* ── Filter panel — positioned below the top bar ── */}
      {showFilters && (
        <div
          className="absolute left-3 right-3 z-20 flex justify-center"
          style={{ top: "calc(4rem + env(safe-area-inset-top, 0px))" }}
        >
          <FilterPanel
            filters={filters}
            states={states}
            onChange={setFilters}
            onClose={() => setShowFilters(false)}
          />
        </div>
      )}

      {/* ── Locate button — lower left, above bottom sheet ── */}
      <div
        className="absolute left-0 z-10"
        style={{
          bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0.75rem))",
        }}
      >
        <button
          onClick={locateMe}
          className="bg-white shadow-md rounded-xl p-2.5 border border-gray-200 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          aria-label="Use my location"
        >
          <Locate className="w-5 h-5 text-gray-600" aria-hidden="true" />
        </button>
      </div>

      {/* ── Selected place card — sits above the bottom sheet ── */}
      {selected && (
        <div
          className="absolute left-3 right-3 z-20"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 text-pretty">{selected.name}</h2>
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
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-400 rounded shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {selected.latitude && selected.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block w-full text-center bg-brand-600 hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 text-white text-sm font-medium py-2 rounded-xl transition-colors"
              >
                Get Directions
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Persistent bottom sheet ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-2xl">
        {/* Drag handle — decorative, tap target is the chevron button */}
        <div className="flex justify-center pt-2 pb-0" aria-hidden="true">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Sheet header: always visible */}
        <div
          className="flex items-center gap-3 px-4 pt-2 pb-3"
          style={{
            paddingBottom: showList
              ? "0.75rem"
              : "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
          }}
        >
          {isLoaded && (
            <>
              <SignedIn>
                <button
                  onClick={() => setShowSubmit(true)}
                  className="flex items-center gap-1.5 bg-brand-600 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add a Place
                </button>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="flex items-center gap-1.5 border border-gray-200 text-gray-600 rounded-full px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors shrink-0">
                    <Plus className="w-4 h-4 text-gray-400" aria-hidden="true" />
                    Sign In to Add
                  </button>
                </SignInButton>
              </SignedOut>
            </>
          )}

          <button
            onClick={() => setShowList((v) => !v)}
            aria-expanded={showList}
            aria-label={showList ? "Collapse places list" : "Expand places list"}
            className="flex items-center gap-1.5 ml-auto text-sm text-gray-600 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-400 rounded-lg px-2 py-1.5 transition-colors"
          >
            <span aria-live="polite" aria-atomic="true">
              {loading
                ? "Searching…"
                : `${places.length} place${places.length !== 1 ? "s" : ""}`}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform motion-reduce:transition-none ${showList ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Expanded list */}
        {showList && (
          <div
            className="overflow-y-auto overscroll-y-contain p-3 flex flex-col gap-2 max-h-[55vh] border-t border-gray-100"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
          >
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
        )}
      </div>

      {/* ── Submit modal ── */}
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} />}
    </main>
  );
}
