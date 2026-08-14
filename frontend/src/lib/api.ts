import type { Place, PlaceListResponse, Submission } from "@/types/place";

const isBrowser = typeof window !== "undefined";
const BASE = isBrowser
  ? ""
  : (process.env.INTERNAL_API_URL ?? "http://backend:8000");

function baseUrl() {
  return BASE || (isBrowser ? window.location.origin : "http://backend:8000");
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function get<T>(path: string, params?: Record<string, string>, token?: string): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  }
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function patch<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function del(path: string, token?: string): Promise<void> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

export interface UserOut {
  id: number;
  clerk_user_id: string;
  role: string;
  created_at: string;
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

    update: (id: number, body: Partial<Place>, token: string) =>
      put<Place>(`/api/places/${id}`, body, token),

    delete: (id: number, token: string) =>
      del(`/api/places/${id}`, token),
  },

  states: () => get<string[]>("/api/places/states"),

  submissions: {
    create: (body: Omit<Submission, "id" | "status" | "created_at" | "submitted_by" | "reviewed_by">, token: string) =>
      post<{ id: number }>("/api/submissions", body, token),
  },

  users: {
    me: (token: string) => get<UserOut>("/api/admin/users/me", undefined, token),
  },

  admin: {
    submissions: {
      list: (token: string, status = "pending") =>
        get<Submission[]>("/api/admin/submissions", { status }, token),
      approve: (id: number, token: string) =>
        patch<Submission>(`/api/admin/submissions/${id}/approve`, undefined, token),
      reject: (id: number, token: string) =>
        patch<Submission>(`/api/admin/submissions/${id}/reject`, undefined, token),
    },
    users: {
      list: (token: string) => get<UserOut[]>("/api/admin/users", undefined, token),
      setRole: (clerkUserId: string, role: string, token: string) =>
        patch<UserOut>(`/api/admin/users/${clerkUserId}/role`, { role }, token),
    },
  },
};
