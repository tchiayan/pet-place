export interface Place {
  id: number;
  name: string;
  address: string | null;
  postcode: string | null;
  sub_area: string | null;
  area: string | null;
  state: string | null;
  category: string | null;
  seating: string | null;
  remarks: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PlaceListResponse {
  total: number;
  items: Place[];
}

export interface Filters {
  category: string;
  seating: string;
  state: string;
}

export interface Submission {
  id: number;
  name: string;
  address: string;
  state: string | null;
  category: string | null;
  seating: string | null;
  remarks: string | null;
  google_maps_url: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_by: string | null;
  reviewed_by: string | null;
  created_at: string;
}
