"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { api, type UserOut } from "@/lib/api";
import type { Place } from "@/types/place";
import PlaceEditModal from "./PlaceEditModal";

interface Props {
  place: Place;
}

export default function PlaceAdminActions({ place: initialPlace }: Props) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<UserOut | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [place, setPlace] = useState(initialPlace);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getToken().then(async (t) => {
      if (!t) return;
      try {
        const u = await api.users.me(t);
        if (["admin", "superadmin"].includes(u.role)) {
          setMe(u);
          setToken(t);
        }
      } catch {
        // not an admin — show nothing
      }
    });
  }, [isLoaded, isSignedIn, getToken]);

  if (!me || !token) return null;

  return (
    <>
      <button
        onClick={() => setEditOpen(true)}
        className="mt-4 flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-500 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors w-full justify-center"
      >
        <Pencil className="w-4 h-4" aria-hidden="true" />
        Edit / Delete Place
      </button>

      {editOpen && (
        <PlaceEditModal
          place={place}
          token={token}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => { setPlace(updated); setEditOpen(false); }}
          onDeleted={() => router.push("/")}
        />
      )}
    </>
  );
}
