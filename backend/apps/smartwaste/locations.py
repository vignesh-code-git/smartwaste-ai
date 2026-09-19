"""Finding places anywhere in India and filing them under State → District.

Search-as-you-type uses Photon (built for autocomplete on OpenStreetMap
data). When a place is chosen, one Nominatim reverse lookup names its
district, which Photon does not report reliably for India. Both are free
OpenStreetMap services; results are cached so repeated queries stay local.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

from django.core.cache import cache
from rest_framework.exceptions import APIException, ValidationError

from .models import District, State
from .reference import state_code

USER_AGENT = "SmartWasteAI/1.0 (roadside waste monitoring; local deployment)"

PHOTON_URL = "https://photon.komoot.io/api/"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"

# west, south, east, north
INDIA_BBOX = "68.1,6.5,97.5,35.7"

CACHE_SECONDS = 60 * 60 * 24


class LocationServiceUnavailable(APIException):
    status_code = 503
    default_detail = "Place search is unavailable. Check the server's internet connection."


def _get_json(url, params):
    request = urllib.request.Request(
        f"{url}?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return json.load(response)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise LocationServiceUnavailable() from error


def search_places(query, limit=8):
    """Places in India matching ``query``, most relevant first."""

    key = f"places:{query.lower()}:{limit}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    data = _get_json(PHOTON_URL, {"q": query, "limit": limit * 2, "bbox": INDIA_BBOX, "lang": "en"})

    places = []
    seen = set()
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        if props.get("countrycode") != "IN" or not props.get("name"):
            continue

        longitude, latitude = feature["geometry"]["coordinates"]
        area = props.get("city") or props.get("county") or props.get("district") or ""
        context = ", ".join(part for part in [area if area != props["name"] else "", props.get("state", "")] if part)

        # Photon returns the same place as a point and as a boundary
        dedupe = (props["name"], context)
        if dedupe in seen:
            continue
        seen.add(dedupe)

        places.append({
            "name": props["name"],
            "context": context,
            "kind": (props.get("osm_value") or props.get("type") or "place").replace("_", " "),
            "latitude": round(latitude, 6),
            "longitude": round(longitude, 6),
        })
        if len(places) == limit:
            break

    cache.set(key, places, CACHE_SECONDS)
    return places


def reverse_geocode(latitude, longitude):
    """District, state code and locality for a point in India."""

    key = f"reverse:{latitude:.4f}:{longitude:.4f}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    data = _get_json(NOMINATIM_REVERSE_URL, {
        "lat": latitude,
        "lon": longitude,
        "format": "jsonv2",
        "zoom": 14,
        "addressdetails": 1,
    })
    address = data.get("address", {})

    if address.get("country_code") != "in":
        raise ValidationError("That location is outside India.")

    district = (
        address.get("state_district")
        or address.get("county")
        or address.get("city")
        or address.get("town")
        or ""
    ).removesuffix(" District").removesuffix(" district").strip()

    result = {
        "state": state_code(address.get("ISO3166-2-lvl4")) or state_code(address.get("state")),
        "district": district,
        "locality": address.get("suburb") or address.get("town") or address.get("city") or address.get("village") or "",
    }

    cache.set(key, result, CACHE_SECONDS)
    return result


def resolve_district(state, district_name, latitude=None, longitude=None):
    """The District row for a state (name or code) and district name,
    created the first time monitoring reaches it."""

    code = state_code(state)
    if not code:
        raise ValidationError({"state": f"Unknown state or union territory: {state!r}."})

    district_name = (district_name or "").strip()
    if not district_name:
        raise ValidationError({"district": "A district is required."})

    state_row = State.objects.get(code=code)

    existing = District.objects.filter(state=state_row, name__iexact=district_name).first()
    if existing:
        return existing

    return District.objects.create(
        state=state_row,
        name=district_name,
        latitude=latitude,
        longitude=longitude,
    )
