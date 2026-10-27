// Geocoding via Google Places Text Search (same key/API as yourguide).
// Env-gated like lib/notify.ts: without GOOGLE_PLACES_API_KEY every call
// returns null and the map simply has fewer pins — nothing breaks.
export async function geocodeSchool(opts: {
  name: string;
  city?: string | null;
  country: string;
}): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log(`[geocode skipped — GOOGLE_PLACES_API_KEY not set] ${opts.name}`);
    return null;
  }

  const query = [opts.name, opts.city, opts.country].filter(Boolean).join(", ");
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    );
    if (!res.ok) {
      console.error(`[geocode failed] ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      status: string;
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    let location = data.results?.[0]?.geometry?.location;

    // School names often don't resolve as places — fall back to the city.
    if (!location && (opts.city || opts.country)) {
      const fallback = [opts.city, opts.country].filter(Boolean).join(", ");
      const res2 = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(fallback)}&key=${apiKey}`
      );
      if (res2.ok) {
        const data2 = (await res2.json()) as typeof data;
        location = data2.results?.[0]?.geometry?.location;
      }
    }
    return location ?? null;
  } catch (err) {
    console.error("[geocode failed]", err);
    return null;
  }
}

// Geocode any free text — a postcode, "south London", a town. Same key and
// gating as geocodeSchool. Used by the admin "near" filter.
export async function geocodeText(query: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const q = query.trim();
  if (!apiKey || !q) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    return data.results?.[0]?.geometry?.location ?? null;
  } catch (err) {
    console.error("[geocode failed]", err);
    return null;
  }
}
