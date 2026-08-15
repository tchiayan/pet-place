import logging
from urllib.parse import urlparse, unquote_plus

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
    """
    if not settings.google_geocoding_api_key:
        logger.warning("GOOGLE_GEOCODING_API_KEY not configured")
        return None

    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            resp = client.head(url)
            expanded_url = str(resp.url)

        place_name = _extract_place_name(expanded_url)
        if not place_name:
            logger.warning("Could not extract place name from URL: %r", expanded_url)
            return None

        with httpx.Client(timeout=10.0) as client:
            find_resp = client.get(
                "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
                params={
                    "input": place_name,
                    "inputtype": "textquery",
                    "fields": "place_id,name",
                    "key": settings.google_geocoding_api_key,
                },
            )
        find_data = find_resp.json()
        if find_data.get("status") != "OK" or not find_data.get("candidates"):
            logger.warning("findplacefromtext status=%s for name=%r", find_data.get("status"), place_name)
            return None

        place_id = find_data["candidates"][0]["place_id"]

        with httpx.Client(timeout=10.0) as client:
            details_resp = client.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "fields": "name,formatted_address,address_components,types,geometry",
                    "key": settings.google_geocoding_api_key,
                },
            )
        details_data = details_resp.json()
        if details_data.get("status") != "OK":
            logger.warning("place/details status=%s for place_id=%r", details_data.get("status"), place_id)
            return None

        return _parse_place_result(details_data["result"])

    except Exception as exc:
        logger.error("Place lookup failed for URL=%r: %s", url, exc)
        return None


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
