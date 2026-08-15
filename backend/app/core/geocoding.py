import logging
import re
from urllib.parse import urlparse, unquote_plus, parse_qs

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_CATEGORY_MAP: dict[str, str] = {
    "restaurant": "Food & Beverage",
    "cafe": "Food & Beverage",
    "food": "Food & Beverage",
    "bar": "Food & Beverage",
    "bakery": "Food & Beverage",
    "meal_takeaway": "Food & Beverage",
    "meal_delivery": "Food & Beverage",
    "lodging": "Pet friendly stay",
    "hotel": "Pet friendly stay",
    "motel": "Pet friendly stay",
    "resort": "Pet friendly stay",
    "tourist_attraction": "Attraction",
    "park": "Attraction",
    "zoo": "Attraction",
    "aquarium": "Attraction",
    "museum": "Attraction",
    "amusement_park": "Attraction",
    "campground": "Attraction",
}

_VALID_STATES = {
    "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang",
    "Penang", "Perak", "Perlis", "Sabah", "Sarawak", "Selangor",
    "Terengganu", "Wilayah Persekutuan",
}

_STATE_ALIASES: dict[str, str] = {
    "pulau pinang": "Penang",
    "p. pinang": "Penang",
    "federal territory of kuala lumpur": "Wilayah Persekutuan",
    "federal territory of labuan": "Wilayah Persekutuan",
    "federal territory of putrajaya": "Wilayah Persekutuan",
    "wilayah persekutuan kuala lumpur": "Wilayah Persekutuan",
    "wp kuala lumpur": "Wilayah Persekutuan",
}


def geocode_address(address: str) -> tuple[float, float] | None:
    """Returns (lat, lng) or None if geocoding fails."""
    if not settings.google_geocoding_api_key:
        logger.warning("GOOGLE_GEOCODING_API_KEY not configured, skipping geocoding")
        return None
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"address": address, "key": settings.google_geocoding_api_key},
            )
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return loc["lat"], loc["lng"]
        logger.warning("Geocoding status=%s for address=%r", data.get("status"), address)
    except Exception as exc:
        logger.error("Geocoding failed for address=%r: %s", address, exc)
    return None


def lookup_place_from_url(url: str) -> dict | None:
    """
    Given a Google Maps URL (short or long), returns place details or None.
    Result keys: name, address, state, lat, lng, category

    Strategy (most → least reliable):
    1. Extract ftid/CID from expanded URL → Place Details directly (no text search)
    2. Extract place name from /maps/place/ path → findplacefromtext
    3. Extract exact coordinates from !3d/!4d in data param → Nearby Search
    4. Extract map-center coordinates from @lat,lng in path → Nearby Search
    """
    if not settings.google_geocoding_api_key:
        logger.warning("GOOGLE_GEOCODING_API_KEY not configured")
        return None

    try:
        expanded_url = _expand_url(url)
        logger.debug("Expanded URL: %r", expanded_url)

        # 1. ftid / CID — present in both mobile (?ftid=0x...) and web (!1s0x...) formats
        ftid = _extract_ftid(expanded_url)
        if ftid:
            result = _fetch_place_details(ftid=ftid)
            if result:
                return result

        # 2. Place name from /maps/place/<name>/ path (web URLs only)
        place_name = _extract_place_name(expanded_url)
        if place_name:
            result = _lookup_by_name(place_name)
            if result:
                return result

        # 3. Exact place coordinates from !3d/!4d encoded in data parameter
        coords = _extract_coords_from_data(expanded_url) or _extract_coords_from_path(expanded_url)
        if coords:
            return _lookup_by_coords(*coords)

        logger.warning("Could not extract place info from URL: %r", expanded_url)
        return None

    except Exception as exc:
        logger.error("Place lookup failed for URL=%r: %s", url, exc)
        return None


_MOBILE_UA = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"


def _expand_url(url: str) -> str:
    """Follow redirects and return the final URL without downloading the body."""
    with httpx.Client(
        timeout=10.0,
        follow_redirects=True,
        headers={"User-Agent": _MOBILE_UA},
    ) as client:
        req = client.build_request("GET", url)
        resp = client.send(req, stream=True)
        expanded = str(resp.url)
        resp.close()
    return expanded


def _extract_ftid(url: str) -> str | None:
    """
    Extract the place identifier (ftid/CID) that can be passed directly to Place Details.

    Mobile URLs: maps.google.com?...&ftid=0x31cc...:0x789c...
    Web URLs:    ...data=!4m6!3m5!1s0x31cc...:0x789c...
    """
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)

    # Mobile: ftid is a top-level query param
    if "ftid" in qs:
        return qs["ftid"][0]

    # Web: CID encoded in the data parameter as !1s0x...
    m = re.search(r"!1s(0x[0-9a-f]+:[0-9a-f]+)", url)
    if m:
        return m.group(1)

    # Fallback: standard ChIJ... place ID in data parameter
    m = re.search(r"!1s(ChIJ[A-Za-z0-9_\-]+)", url)
    if m:
        return m.group(1)

    return None


def _extract_coords_from_data(url: str) -> tuple[float, float] | None:
    """Extract the place pin coordinates from !3d/!4d encoded in the data parameter."""
    m = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", url)
    return (float(m.group(1)), float(m.group(2))) if m else None


def _extract_coords_from_path(url: str) -> tuple[float, float] | None:
    """Extract map-center coordinates from @lat,lng in the URL path."""
    m = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", url)
    return (float(m.group(1)), float(m.group(2))) if m else None


def _fetch_place_details(place_id: str = None, ftid: str = None) -> dict | None:
    params: dict = {
        "fields": "name,formatted_address,address_components,types,geometry",
        "key": settings.google_geocoding_api_key,
    }
    if place_id:
        params["place_id"] = place_id
    elif ftid:
        params["ftid"] = ftid
    else:
        return None

    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params=params,
        )
    data = resp.json()
    if data.get("status") != "OK":
        logger.warning("place/details status=%s (place_id=%r ftid=%r)", data.get("status"), place_id, ftid)
        return None
    return _parse_place_result(data["result"])


def _lookup_by_name(place_name: str) -> dict | None:
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
            params={
                "input": place_name,
                "inputtype": "textquery",
                "fields": "place_id,name",
                "key": settings.google_geocoding_api_key,
            },
        )
    data = resp.json()
    if data.get("status") != "OK" or not data.get("candidates"):
        logger.warning("findplacefromtext status=%s for name=%r", data.get("status"), place_name)
        return None
    return _fetch_place_details(place_id=data["candidates"][0]["place_id"])


def _lookup_by_coords(lat: float, lng: float) -> dict | None:
    with httpx.Client(timeout=10.0) as client:
        resp = client.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "location": f"{lat},{lng}",
                "rankby": "distance",
                "type": "establishment",
                "key": settings.google_geocoding_api_key,
            },
        )
    data = resp.json()
    if data.get("status") != "OK" or not data.get("results"):
        logger.warning("nearbysearch status=%s for coords=(%r, %r)", data.get("status"), lat, lng)
        return None
    return _fetch_place_details(place_id=data["results"][0]["place_id"])


def _extract_place_name(url: str) -> str | None:
    parsed = urlparse(url)
    if "/maps/place/" not in parsed.path:
        return None
    segment = parsed.path.split("/maps/place/", 1)[1].split("/")[0]
    return unquote_plus(segment) or None


def _normalize_state(name: str) -> str | None:
    if name in _VALID_STATES:
        return name
    return _STATE_ALIASES.get(name.lower())


def _parse_place_result(result: dict) -> dict:
    state = ""
    for comp in result.get("address_components", []):
        if "administrative_area_level_1" in comp.get("types", []):
            state = _normalize_state(comp["long_name"]) or ""
            break

    category = ""
    for t in result.get("types", []):
        if t in _CATEGORY_MAP:
            category = _CATEGORY_MAP[t]
            break

    location = result.get("geometry", {}).get("location", {})

    return {
        "name": result.get("name", ""),
        "address": result.get("formatted_address", ""),
        "state": state,
        "lat": location.get("lat"),
        "lng": location.get("lng"),
        "category": category,
    }
