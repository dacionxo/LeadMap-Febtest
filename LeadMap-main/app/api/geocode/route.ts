import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geocode?q=address+or+city
 * Geocodes an address, city, or zip for the map search bar.
 * Uses Google Geocoding API if key is set, otherwise Mapbox Geocoding API.
 * Returns { lat, lng, formattedAddress } for the map to fly to.
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
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${googleKey}`
      );
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
        const loc = r.geometry.location;
        return NextResponse.json({
          lat: loc.lat,
          lng: loc.lng,
          formattedAddress: r.formatted_address ?? q,
        });
      }
      if (data.status === "ZERO_RESULTS") {
        return NextResponse.json(
          { error: "No results for this address or city" },
          { status: 404 }
        );
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
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=1&types=address,place,postcode,locality`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature?.center) return null;
    const [lng, lat] = feature.center;
    return {
      lat,
      lng,
      formattedAddress: feature.place_name ?? query,
    };
  } catch {
    return null;
  }
}
