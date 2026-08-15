"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

const CATEGORIES = ["Food & Beverage", "Attraction", "Pet friendly stay"];
const SEATINGS = ["Indoor seating", "Outdoor seating", "Indoor seating; Outdoor seating"];
const STATES = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang",
  "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor",
  "Terengganu", "Wilayah Persekutuan",
];

interface Props {
  onClose: () => void;
}

type Step = "form" | "success";

export default function SubmitModal({ onClose }: Props) {
  const { getToken } = useAuth();
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    address: "",
    state: "",
    category: "",
    seating: "",
    remarks: "",
    google_maps_url: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError("Place name and address are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      await api.submissions.create(form, token);
      setStep("success");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 id="submit-modal-title" className="font-bold text-gray-900 text-lg">
            {step === "form" ? "Add a Pet-Friendly Place" : "Thank You!"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {step === "success" ? (
          <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-brand-500" aria-hidden="true" />
            <p className="text-gray-700 font-medium">
              Your submission has been received and will be reviewed shortly.
            </p>
            <button
              onClick={onClose}
              className="mt-2 bg-brand-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-y-contain px-5 py-4 flex flex-col gap-4">
            <Field label="Place Name *">
              <input
                type="text"
                name="place_name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Corgi & The Gang Pet Cafe"
                autoComplete="off"
                className={inputCls}
              />
            </Field>

            <Field label="Address *">
              <textarea
                name="address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Full address"
                rows={2}
                autoComplete="off"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="State">
                <select name="state" value={form.state} onChange={(e) => set("state", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Category">
                <select name="category" value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Seating Type">
              <select name="seating" value={form.seating} onChange={(e) => set("seating", e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {SEATINGS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Google Maps Link">
              <input
                type="url"
                name="google_maps_url"
                value={form.google_maps_url}
                onChange={(e) => set("google_maps_url", e.target.value)}
                placeholder="https://maps.google.com/…"
                autoComplete="url"
                className={inputCls}
              />
            </Field>

            <Field label="Remarks / Notes">
              <input
                type="text"
                name="remarks"
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
                placeholder="e.g. Small breeds only, outdoor area"
                autoComplete="off"
                className={inputCls}
              />
            </Field>

            {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-brand-500 text-white font-semibold py-3 rounded-xl transition-colors mt-1 mb-2"
            >
              {loading ? "Submitting…" : "Submit for Review"}
            </button>
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
