import { ArrowLeft, MapPin, Sofa, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Props {
  params: { id: string };
}

export default async function PlaceDetailPage({ params }: Props) {
  const place = await api.places.get(Number(params.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto p-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-500 rounded mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Map
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h1 className="text-xl font-bold text-gray-900">{place.name}</h1>

          {place.category && (
            <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
              {place.category}
            </span>
          )}

          <div className="mt-4 space-y-3 text-sm text-gray-700">
            {place.address && (
              <Row icon={<MapPin className="w-4 h-4 text-gray-400" aria-hidden="true" />} label="Address">
                {place.address}
              </Row>
            )}
            {place.state && (
              <Row icon={<MapPin className="w-4 h-4 text-gray-400" aria-hidden="true" />} label="State">
                {place.area ? `${place.area}, ` : ""}
                {place.state}
              </Row>
            )}
            {place.seating && (
              <Row icon={<Sofa className="w-4 h-4 text-gray-400" aria-hidden="true" />} label="Seating">
                {place.seating}
              </Row>
            )}
            {place.remarks && place.remarks !== "None" && (
              <Row
                icon={<UtensilsCrossed className="w-4 h-4 text-gray-400" aria-hidden="true" />}
                label="Notes"
              >
                {place.remarks}
              </Row>
            )}
          </div>

          {place.latitude && place.longitude && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full text-center bg-green-600 hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              Get Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
