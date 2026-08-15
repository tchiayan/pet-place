"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, ChevronDown, ShieldCheck, Users,
  ClipboardList, MapPin, Pencil, Search, ChevronLeft, ChevronRight, MapPinOff,
} from "lucide-react";
import { api, type UserListResponse, type UserOut } from "@/lib/api";
import type { Place, Submission } from "@/types/place";
import PlaceEditModal from "@/components/PlaceEditModal";

type Tab = "submissions" | "users" | "places";
const ROLES = ["member", "admin", "superadmin"] as const;
type Role = typeof ROLES[number];

const roleBadge: Record<string, string> = {
  member: "bg-gray-100 text-gray-600",
  admin: "bg-blue-100 text-blue-700",
  superadmin: "bg-purple-100 text-purple-700",
};

const dateFormat: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

const PAGE_SIZE = 10;

export default function AdminPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("submissions");
  const [me, setMe] = useState<UserOut | null>(null);
  const [authError, setAuthError] = useState(false);

  // ── Submissions ──
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subStatus, setSubStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [subLoading, setSubLoading] = useState(false);
  const [subActing, setSubActing] = useState<number | null>(null);

  // ── Users ──
  const [users, setUsers] = useState<UserOut[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleActing, setRoleActing] = useState<string | null>(null);

  // ── Places ──
  const [placesList, setPlacesList] = useState<Place[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [placesPage, setPlacesPage] = useState(0);
  const [placesSearch, setPlacesSearch] = useState("");
  const [placesLoading, setPlacesLoading] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [placesToken, setPlacesToken] = useState<string | null>(null);
  const [geocodingMissing, setGeocodingMissing] = useState(false);
  const [geocodeJobRunning, setGeocodeJobRunning] = useState(false);
  const [geocodeToast, setGeocodeToast] = useState<string | null>(null);

  // ── Auth ──
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.replace("/"); return; }
    getToken().then((token) => {
      if (!token) { router.replace("/"); return; }
      api.users.me(token)
        .then((u) => {
          if (!["admin", "superadmin"].includes(u.role)) {
            router.replace("/");
          } else {
            setMe(u);
          }
        })
        .catch(() => setAuthError(true));
    });
  }, [isLoaded, isSignedIn, getToken, router]);

  // ── Submissions fetch ──
  useEffect(() => {
    if (!me) return;
    setSubLoading(true);
    getToken().then((token) => {
      if (!token) return;
      api.admin.submissions.list(token, subStatus)
        .then(setSubmissions)
        .catch(() => {})
        .finally(() => setSubLoading(false));
    });
  }, [me, subStatus, getToken]);

  // ── Users fetch (debounced, server-side search + pagination) ──
  useEffect(() => {
    if (!me || tab !== "users") return;
    setUsersLoading(true);
    const tid = setTimeout(() => {
      getToken().then((token) => {
        if (!token) return;
        api.admin.users.list(token, { q: usersSearch.trim(), skip: usersPage * PAGE_SIZE, limit: PAGE_SIZE })
          .then((r: UserListResponse) => { setUsers(r.items); setUsersTotal(r.total); })
          .catch(() => {})
          .finally(() => setUsersLoading(false));
      });
    }, 300);
    return () => clearTimeout(tid);
  }, [me, tab, usersSearch, usersPage, getToken]);

  // ── Sync name/email to backend on sign-in ──
  useEffect(() => {
    if (!me || !clerkUser) return;
    getToken().then((token) => {
      if (!token) return;
      const name = clerkUser.fullName;
      const email = clerkUser.primaryEmailAddress?.emailAddress ?? null;
      if (name || email) api.users.sync(token, { name, email }).catch(() => {});
    });
  }, [me, clerkUser, getToken]);

  // ── Places fetch (debounced) ──
  useEffect(() => {
    if (!me || tab !== "places") return;
    getToken().then((t) => {
      if (!t) return;
      setPlacesToken(t);
      // Check if a geocoding job is already running
      api.admin.places.geocodeStatus(t)
        .then(({ running }) => setGeocodeJobRunning(running))
        .catch(() => {});
    });
  }, [me, tab, getToken]);

  // Poll geocode status every 5 s while a job is running
  useEffect(() => {
    if (!geocodeJobRunning || !placesToken) return;
    const iid = setInterval(async () => {
      try {
        const { running } = await api.admin.places.geocodeStatus(placesToken);
        if (!running) setGeocodeJobRunning(false);
      } catch {
        // ignore transient errors, keep polling
      }
    }, 5000);
    return () => clearInterval(iid);
  }, [geocodeJobRunning, placesToken]);

  useEffect(() => {
    if (!me || tab !== "places") return;
    setPlacesLoading(true);
    const tid = setTimeout(() => {
      const fetch = placesSearch.trim()
        ? api.places.search(placesSearch.trim())
        : api.places.list({ skip: String(placesPage * PAGE_SIZE), limit: String(PAGE_SIZE) });
      fetch
        .then((r) => { setPlacesList(r.items); setPlacesTotal(r.total); })
        .catch(() => {})
        .finally(() => setPlacesLoading(false));
    }, 300);
    return () => clearTimeout(tid);
  }, [me, tab, placesSearch, placesPage]);

  // ── Handlers ──
  const handleApprove = async (id: number) => {
    setSubActing(id);
    try {
      const token = await getToken();
      if (!token) return;
      await api.admin.submissions.approve(id, token);
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setSubActing(null);
    }
  };

  const handleReject = async (id: number) => {
    setSubActing(id);
    try {
      const token = await getToken();
      if (!token) return;
      await api.admin.submissions.reject(id, token);
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setSubActing(null);
    }
  };

  const handleRoleChange = async (clerkUserId: string, role: string) => {
    setRoleActing(clerkUserId);
    try {
      const token = await getToken();
      if (!token) return;
      const updated = await api.admin.users.setRole(clerkUserId, role, token);
      setUsers((prev) => prev.map((u) => u.clerk_user_id === clerkUserId ? updated : u));
    } catch {
      alert("Failed to update role.");
    } finally {
      setRoleActing(null);
    }
  };

  const handleGeocodeMissing = async () => {
    setGeocodingMissing(true);
    try {
      const token = await getToken();
      if (!token) return;
      const { queued, alreadyRunning } = await api.admin.places.geocodeMissing(token);
      if (alreadyRunning) {
        setGeocodeJobRunning(true);
        setGeocodeToast("A geocoding job is already running.");
      } else {
        setGeocodeJobRunning(true);
        setGeocodeToast(`Geocoding started for ${queued} place${queued !== 1 ? "s" : ""} in the background.`);
      }
      setTimeout(() => setGeocodeToast(null), 5000);
    } catch {
      setGeocodeToast("Failed to start geocoding job.");
      setTimeout(() => setGeocodeToast(null), 4000);
    } finally {
      setGeocodingMissing(false);
    }
  };

  const handlePlaceSearch = (q: string) => {
    setPlacesSearch(q);
    setPlacesPage(0);
  };

  if (!isLoaded || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {authError ? "Access denied." : "Loading…"}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── Fixed top panel ── */}
      <div className="bg-white flex-shrink-0">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-brand-600" aria-hidden="true" />
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Admin Panel</h1>
            <p className="text-xs text-gray-500">
              Signed in as{" "}
              <span className={`font-medium px-1.5 py-0.5 rounded-full text-xs ${roleBadge[me.role]}`}>
                {me.role}
              </span>
            </p>
          </div>
          <a href="/" className="ml-auto text-sm text-gray-500 hover:text-gray-700">← Back to Map</a>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4 flex gap-1" role="tablist">
          <TabBtn active={tab === "submissions"} onClick={() => setTab("submissions")} icon={<ClipboardList className="w-4 h-4" aria-hidden="true" />} label="Submissions" />
          <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="w-4 h-4" aria-hidden="true" />} label="Users" />
          <TabBtn active={tab === "places"} onClick={() => setTab("places")} icon={<MapPin className="w-4 h-4" aria-hidden="true" />} label="Places" />
        </div>

        {/* Filter / search bar */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {tab === "submissions" && (
              <div className="flex gap-2">
                {(["pending", "approved", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubStatus(s)}
                    className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      subStatus === s
                        ? "bg-brand-600 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {tab === "users" && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search by name, email or Clerk ID…"
                  value={usersSearch}
                  onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(0); }}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 bg-white transition-all"
                />
              </div>
            )}
            {tab === "places" && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search by name or address…"
                    value={placesSearch}
                    onChange={(e) => handlePlaceSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 bg-white transition-all"
                  />
                </div>
                <button
                  onClick={handleGeocodeMissing}
                  disabled={geocodingMissing || geocodeJobRunning}
                  title={geocodeJobRunning ? "A geocoding job is already running" : "Geocode places with missing coordinates"}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors shrink-0"
                >
                  <MapPinOff className="w-4 h-4" aria-hidden="true" />
                  {geocodingMissing ? "Starting…" : geocodeJobRunning ? "Job Running…" : "Geocode Missing"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ── Submissions tab ── */}
        {tab === "submissions" && (
          <div>
            {subLoading ? (
              <p className="text-gray-400 text-sm">Loading…</p>
            ) : submissions.length === 0 ? (
              <p className="text-gray-400 text-sm">No {subStatus} submissions.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {submissions.map((sub) => (
                  <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{sub.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{sub.address}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {sub.state && <Tag>{sub.state}</Tag>}
                          {sub.category && <Tag>{sub.category}</Tag>}
                          {sub.seating && <Tag>{sub.seating}</Tag>}
                        </div>
                        {sub.remarks && (
                          <p className="text-xs text-gray-500 mt-1.5 italic">{sub.remarks}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Submitted {new Date(sub.created_at).toLocaleDateString(undefined, dateFormat)}
                        </p>
                      </div>
                      {subStatus === "pending" && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => handleApprove(sub.id)}
                            disabled={subActing === sub.id}
                            className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-green-500 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(sub.id)}
                            disabled={subActing === sub.id}
                            className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {tab === "users" && (
          <div>
            {usersLoading ? (
              <p className="text-gray-400 text-sm">Loading…</p>
            ) : users.length === 0 ? (
              <p className="text-gray-400 text-sm">No users found.</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 mb-4">
                  {users.map((u) => {
                    const isSelf = u.clerk_user_id === me.clerk_user_id;
                    const canEdit = !isSelf && (
                      me.role === "superadmin" ||
                      (me.role === "admin" && u.role !== "superadmin")
                    );
                    return (
                      <div key={u.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {u.name ?? u.clerk_user_id}
                          </p>
                          {u.email && (
                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            Joined {new Date(u.created_at).toLocaleDateString(undefined, dateFormat)}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {canEdit ? (
                            <div className="relative">
                              <select
                                value={u.role}
                                disabled={roleActing === u.clerk_user_id}
                                onChange={(e) => handleRoleChange(u.clerk_user_id, e.target.value)}
                                className={`appearance-none pl-2.5 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-500 ${roleBadge[u.role]}`}
                              >
                                {ROLES.filter((r) => me.role === "superadmin" || r !== "superadmin").map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" aria-hidden="true" />
                            </div>
                          ) : (
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleBadge[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                              {u.role}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>
                    {usersPage * PAGE_SIZE + 1}–{Math.min((usersPage + 1) * PAGE_SIZE, usersTotal)} of {usersTotal}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
                      disabled={usersPage === 0}
                      className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setUsersPage((p) => p + 1)}
                      disabled={(usersPage + 1) * PAGE_SIZE >= usersTotal}
                      className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Places tab ── */}
        {tab === "places" && (
          <div>
            {/* Toast */}
            {geocodeToast && (
              <div className="mb-4 px-4 py-2.5 bg-brand-50 border border-brand-200 text-brand-700 text-sm rounded-xl">
                {geocodeToast}
              </div>
            )}

            {placesLoading ? (
              <p className="text-gray-400 text-sm">Loading…</p>
            ) : placesList.length === 0 ? (
              <p className="text-gray-400 text-sm">No places found.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2 mb-4">
                  {placesList.map((p) => (
                    <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                        {p.address && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.address}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {p.state && <Tag>{p.state}</Tag>}
                          {p.category && <Tag>{p.category}</Tag>}
                          {!p.latitude && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">No coords</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingPlace(p)}
                        className="shrink-0 flex items-center gap-1 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        Edit
                      </button>
                    </div>
                  ))}
                </div>

                {/* Pagination (only for non-search) */}
                {!placesSearch.trim() && (
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      {placesPage * PAGE_SIZE + 1}–{Math.min((placesPage + 1) * PAGE_SIZE, placesTotal)} of {placesTotal}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPlacesPage((p) => Math.max(0, p - 1))}
                        disabled={placesPage === 0}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => setPlacesPage((p) => p + 1)}
                        disabled={(placesPage + 1) * PAGE_SIZE >= placesTotal}
                        className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Edit modal */}
      {editingPlace && placesToken && (
        <PlaceEditModal
          place={editingPlace}
          token={placesToken}
          onClose={() => setEditingPlace(null)}
          onSaved={(updated) => {
            setPlacesList((prev) => prev.map((p) => p.id === updated.id ? updated : p));
            setEditingPlace(null);
          }}
          onDeleted={() => {
            setPlacesList((prev) => prev.filter((p) => p.id !== editingPlace.id));
            setPlacesTotal((t) => t - 1);
            setEditingPlace(null);
          }}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active
          ? "border-brand-600 text-brand-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{children}</span>
  );
}
