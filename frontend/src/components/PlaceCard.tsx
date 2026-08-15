"use client";

import { MapPin, Sofa, UtensilsCrossed, Building2, Tent } from "lucide-react";
import clsx from "clsx";
import type { Place } from "@/types/place";

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  "Food & Beverage": <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />,
  Attraction: <Tent className="w-4 h-4" aria-hidden="true" />,
  "Pet friendly stay": <Building2 className="w-4 h-4" aria-hidden="true" />,
};

const CATEGORY_COLOR: Record<string, string> = {
  "Food & Beverage": "bg-orange-100 text-orange-700",
  Attraction: "bg-blue-100 text-blue-700",
  "Pet friendly stay": "bg-purple-100 text-purple-700",
};

interface Props {
  place: Place;
  onClick?: () => void;
  compact?: boolean;
}

export default function PlaceCard({ place, onClick, compact = false }: Props) {
  const categoryColor =
    CATEGORY_COLOR[place.category ?? ""] ?? "bg-gray-100 text-gray-700";
  const categoryIcon = CATEGORY_ICON[place.category ?? ""] ?? null;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 transition-shadow",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{place.name}</p>
          {!compact && place.address && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
              <MapPin className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-2">{place.address}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {place.category && (
              <span
                className={clsx(
                  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                  categoryColor
                )}
              >
                {categoryIcon}
                {place.category}
              </span>
            )}
            {place.seating && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <Sofa className="w-3 h-3" aria-hidden="true" />
                {place.seating}
              </span>
            )}
          </div>
          {!compact && place.remarks && place.remarks !== "None" && (
            <p className="text-xs text-gray-500 mt-1.5 italic">{place.remarks}</p>
          )}
        </div>
      </div>
    </button>
  );
}
