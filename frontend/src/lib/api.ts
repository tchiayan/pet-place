import type { Place, PlaceListResponse, Submission } from "@/types/place";

// Browser: use relative URL (goes through nginx, avoids CORS)
// Server (SSR/RSC): use internal Docker service URL
const isBrowser = typeof window !== "undefined";
const BASE = isBrowser
  ? ""
  : (process.env.INTERNAL_API_URL ?? "http://backend:8000");

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = BASE || (isBrowser ? window.location.origin : "http://backend:8000");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const base = BASE || (isBrowser ? window.location.origin : "http://backend:8000");
  const url = new URL(`${base}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export const api = {
  places: {
    list: (params: Record<string, string> = {}) =>
      get<PlaceListResponse>("/api/places", params),

    nearby: (lat: number, lng: number, radius_km = 5, category = "") =>
      get<PlaceListResponse>("/api/places/nearby", {
        lat: String(lat),
        lng: String(lng),
        radius_km: String(radius_km),
        ...(category ? { category } : {}),
      }),

    search: (q: string, state = "", category = "") =>
      get<PlaceListResponse>("/api/places/search", {
        q,
        ...(state ? { state } : {}),
        ...(category ? { category } : {}),
      }),

    get: (id: number) => get<Place>(`/api/places/${id}`),
  },

  states: () => get<string[]>("/api/places/states"),

  submissions: {
    create: (body: Omit<Submission, "id" | "status" | "created_at">) =>
      post<{ id: number }>("/api/submissions", body),
  },
};
