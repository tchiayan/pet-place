"use client";

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Place } from "@/types/place";

const CATEGORIES = ["Food & Beverage", "Attraction", "Pet friendly stay"];
const SEATINGS = ["Indoor seating", "Outdoor seating", "Indoor seating; Outdoor seating"];
const STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang",
  "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor",
  "Terengganu", "Wilayah Persekutuan",
];

interface Props {
  place: Place;
  token: string;
  onClose: () => void;
  onSaved: (updated: Place) => void;
  onDeleted: () => void;
}

type View = "edit" | "confirm-delete";

export default function PlaceEditModal({ place, token, onClose, onSaved, onDeleted }: Props) {
  const [view, setView] = useState<View>("edit");
  const [form, setForm] = useState({
    name: place.name ?? "",
    address: place.address ?? "",
    postcode: place.postcode ?? "",
    sub_area: place.sub_area ?? "",
    area: place.area ?? "",
    state: place.state ?? "",
    category: place.category ?? "",
    seating: place.seating ?? "",
    remarks: place.remarks ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const updated = await api.places.update(place.id, form, token);
      onSaved(updated);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.places.delete(place.id, token);
      onDeleted();
    } catch {
      setError("Failed to delete. Please try again.");
      setView("edit");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 id="edit-modal-title" className="font-bold text-gray-900 text-lg">
            {view === "edit" ? "Edit Place" : "Delete Place?"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {view === "confirm-delete" ? (
          <div className="p-5 flex flex-col gap-4">
            <p className="text-gray-700 text-sm">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{place.name}</span>? This cannot be undone.
            </p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setView("edit")}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="overflow-y-auto overscroll-y-contain px-5 py-4 flex flex-col gap-4">
            <Field label="Place Name *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Address">
              <textarea
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Postcode">
                <input
                  type="text"
                  value={form.postcode}
                  onChange={(e) => set("postcode", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="State">
                <select value={form.state} onChange={(e) => set("state", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Area">
                <input
                  type="text"
                  value={form.area}
                  onChange={(e) => set("area", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Sub Area">
                <input
                  type="text"
                  value={form.sub_area}
                  onChange={(e) => set("sub_area", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Seating">
                <select value={form.seating} onChange={(e) => set("seating", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {SEATINGS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Remarks">
              <input
                type="text"
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                className={inputCls}
              />
            </Field>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3 mt-1 mb-2">
              <button
                type="button"
                onClick={() => setView("confirm-delete")}
                className="flex items-center gap-1.5 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-brand-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 bg-white transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
