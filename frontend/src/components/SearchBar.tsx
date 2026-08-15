"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRef, useState } from "react";
import clsx from "clsx";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onFilterClick: () => void;
  hasFilters: boolean;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  onFilterClick,
  hasFilters,
  placeholder = "Search by place or area…",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={clsx(
        "flex items-center gap-2 bg-white rounded-2xl shadow-lg border px-3 py-2 transition-all",
        focused ? "border-brand-500 ring-2 ring-brand-100" : "border-gray-200"
      )}
    >
      <Search className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        name="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label="Search for pet-friendly places"
        autoComplete="off"
        className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
      <button
        onClick={onFilterClick}
        className={clsx(
          "p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-brand-500",
          hasFilters
            ? "bg-brand-600 text-white"
            : "text-gray-500 hover:bg-gray-100"
        )}
        aria-label="Toggle filters"
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
