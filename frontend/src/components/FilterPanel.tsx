"use client";

import { X } from "lucide-react";
import clsx from "clsx";
import type { Filters } from "@/types/place";

const CATEGORIES = ["Food & Beverage", "Attraction", "Pet friendly stay"];
const SEATINGS = ["Indoor seating", "Outdoor seating"];

interface Props {
  filters: Filters;
  states: string[];
  onChange: (f: Filters) => void;
  onClose: () => void;
}

export default function FilterPanel({ filters, states, onChange, onClose }: Props) {
  const set = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: filters[key] === value ? "" : value });

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Filters</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <Section label="Category">
        {CATEGORIES.map((c) => (
          <Chip key={c} active={filters.category === c} onClick={() => set("category", c)}>
            {c}
          </Chip>
        ))}
      </Section>

      <Section label="Seating">
        {SEATINGS.map((s) => (
          <Chip key={s} active={filters.seating === s} onClick={() => set("seating", s)}>
            {s}
          </Chip>
        ))}
      </Section>

      <Section label="State">
        <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
          {states.map((s) => (
            <button
              key={s}
              onClick={() => set("state", s)}
              className={clsx(
                "text-left text-sm px-3 py-1.5 rounded-lg transition-colors",
                filters.state === s
                  ? "bg-brand-600 text-white"
                  : "hover:bg-gray-100 text-gray-700"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      <button
        onClick={() => onChange({ category: "", seating: "", state: "" })}
        className="mt-4 w-full text-sm text-center text-gray-500 hover:text-gray-700 underline"
      >
        Clear all filters
      </button>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "text-sm px-3 py-1 rounded-full border transition-colors",
        active
          ? "bg-brand-600 text-white border-brand-600"
          : "border-gray-300 text-gray-700 hover:border-brand-500 hover:text-brand-700"
      )}
    >
      {children}
    </button>
  );
}
