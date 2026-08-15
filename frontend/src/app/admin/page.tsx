"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ChevronDown, ShieldCheck, Users, ClipboardList } from "lucide-react";
import { api, type UserOut } from "@/lib/api";
import type { Submission } from "@/types/place";

type Tab = "submissions" | "users";
const ROLES = ["member", "admin", "superadmin"] as const;
type Role = typeof ROLES[number];

const roleBadge: Record<string, string> = {
  member: "bg-gray-100 text-gray-600",
  admin: "bg-blue-100 text-blue-700",
  superadmin: "bg-purple-100 text-purple-700",
};

const dateFormat: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

export default function AdminPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("submissions");
  const [me, setMe] = useState<UserOut | null>(null);
  const [authError, setAuthError] = useState(false);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subStatus, setSubStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [subLoading, setSubLoading] = useState(false);
  const [subActing, setSubActing] = useState<number | null>(null);

  const [users, setUsers] = useState<UserOut[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleActing, setRoleActing] = useState<string | null>(null);

  // Verify admin access
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

  // Fetch submissions
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

  // Fetch users
  useEffect(() => {
    if (!me || tab !== "users") return;
    setUsersLoading(true);
    getToken().then((token) => {
      if (!token) return;
      api.admin.users.list(token)
        .then(setUsers)
        .catch(() => {})
        .finally(() => setUsersLoading(false));
    });
  }, [me, tab, getToken]);

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

  if (!isLoaded || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {authError ? "Access denied." : "Loading…"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-brand-600" aria-hidden="true" />
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Admin Panel</h1>
          <p className="text-xs text-gray-500">
            Signed in as <span className={`font-medium px-1.5 py-0.5 rounded-full text-xs ${roleBadge[me.role]}`}>{me.role}</span>
          </p>
        </div>
        <a href="/" className="ml-auto text-sm text-gray-500 hover:text-gray-700">← Back to Map</a>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1" role="tablist">
        <TabBtn active={tab === "submissions"} onClick={() => setTab("submissions")} icon={<ClipboardList className="w-4 h-4" aria-hidden="true" />} label="Submissions" />
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="w-4 h-4" aria-hidden="true" />} label="Users" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* ── Submissions tab ── */}
        {tab === "submissions" && (
          <div>
            <div className="flex gap-2 mb-4">
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
              <p className="text-gray-400 text-sm">No users yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {users.map((u) => {
                  const isSelf = u.clerk_user_id === me.clerk_user_id;
                  const canEdit = !isSelf && (
                    me.role === "superadmin" ||
                    (me.role === "admin" && u.role !== "superadmin")
                  );

                  return (
                    <div key={u.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.clerk_user_id}</p>
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
            )}
          </div>
        )}
      </div>
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
