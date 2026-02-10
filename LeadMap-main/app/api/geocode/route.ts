import { NextRequest, NextResponse } from "next/server";

/** Validates and normalizes lat/lng for map display (WGS84). */
function isValidCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = typeof lat === "number" ? lat : Number(lat);
  const lo = typeof lng === "number" ? lng : Number(lng);
  if (Number.isNaN(la) || Number.isNaN(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la, lng: lo };
}

/**
 * GET /api/geocode?q=address+or+city
 * Geocodes an address, city, or zip for the map search bar.
 * Uses Google Geocoding API if key is set, otherwise Mapbox Geocoding API.
 * Returns { lat, lng, formattedAddress } so the map zooms to the searched location.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required (min 2 characters)" },
      { status: 400 }
    );
  }

  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (googleKey) {
    try {
      const encoded = encodeURIComponent(q);
      // Bias to US so addresses resolve to the correct country
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${googleKey}&region=us`;
      const res = await fetch(url);
      if (!res.ok) {
        const fallback = await tryMapboxGeocode(q, mapboxToken);
        return fallback
          ? NextResponse.json(fallback)
          : NextResponse.json(
              { error: "Geocoding failed" },
              { status: 502 }
            );
      }
      const data = await res.json();
      if (data.status === "OK" && data.results?.[0]) {
        const r = data.results[0];
        const loc = r.geometry?.location;
        const latVal = loc && (typeof loc.lat === "number" ? loc.lat : undefined);
        const lngVal = loc && (typeof loc.lng === "number" ? loc.lng : undefined);
        if (latVal == null || lngVal == null) {
          const fallback = await tryMapboxGeocode(q, mapboxToken);
          if (fallback) return NextResponse.json(fallback);
          return NextResponse.json(
            { error: "Invalid geocode response" },
            { status: 502 }
          );
        }
        const coords = isValidCoord(latVal, lngVal);
        if (!coords) {
          const fallback = await tryMapboxGeocode(q, mapboxToken);
          if (fallback) return NextResponse.json(fallback);
          return NextResponse.json(
            { error: "Invalid coordinates" },
            { status: 502 }
          );
        }
        return NextResponse.json({
          lat: coords.lat,
          lng: coords.lng,
          formattedAddress: r.formatted_address ?? q,
        });
      }
      if (data.status === "ZERO_RESULTS") {
        const fallback = await tryMapboxGeocode(q, mapboxToken);
        if (fallback) return NextResponse.json(fallback);
        return NextResponse.json(
          { error: "No results for this address or city" },
          { status: 404 }
        );
      }
      if (data.status === "OVER_QUERY_LIMIT" || data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") {
        const fallback = await tryMapboxGeocode(q, mapboxToken);
        if (fallback) return NextResponse.json(fallback);
      }
    } catch (err) {
      console.warn("[geocode] Google error:", err);
      const fallback = await tryMapboxGeocode(q, mapboxToken);
      if (fallback) return NextResponse.json(fallback);
      return NextResponse.json(
        { error: "Geocoding failed" },
        { status: 502 }
      );
    }
  }

  if (mapboxToken) {
    const result = await tryMapboxGeocode(q, mapboxToken);
    if (result) return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "No geocoding provider configured (Google Maps or Mapbox)" },
    { status: 503 }
  );
}

async function tryMapboxGeocode(
  query: string,
  token: string | undefined
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  if (!token) return null;
  try {
    const encoded = encodeURIComponent(query);
    // country=US to prefer US results
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=1&types=address,place,postcode,locality&country=US`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature?.center || !Array.isArray(feature.center)) return null;
    const [lng, lat] = feature.center;
    const coords = isValidCoord(lat, lng);
    if (!coords) return null;
    return {
      lat: coords.lat,
      lng: coords.lng,
      formattedAddress: feature.place_name ?? query,
    };
  } catch {
    return null;
  }
}
