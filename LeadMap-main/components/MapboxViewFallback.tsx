"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import React, { useEffect, useRef, useState } from "react";

interface Lead {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  price_drop_percent: number;
  days_on_market: number;
  url: string;
  latitude?: number;
  longitude?: number;
  property_type?: string;
  beds?: number;
  sqft?: number;
  year_built?: number;
  description?: string;
  agent_name?: string;
  agent_email?: string;
  primary_photo?: string;
  expired?: boolean;
  geo_source?: string | null;
  owner_email?: string;
  enrichment_confidence?: number | null;
}

interface MapboxViewFallbackProps {
  isActive: boolean;
  listings: Lead[];
  loading: boolean;
  fullScreen?: boolean;
}

const MapboxViewFallback: React.FC<MapboxViewFallbackProps> = ({
  isActive,
  listings,
  loading,
  fullScreen,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const searchMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geocodedLeads, setGeocodedLeads] = useState<
    Map<string, { lat: number; lng: number }>
  >(new Map());
  const [geocodingCount, setGeocodingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const geocodingInProgress = useRef<Set<string>>(new Set());

  // Format price for marker label: $1.2M, $850k, $675k
  const formatPrice = (price: number): string => {
    if (!price || price <= 0) return "—";
    if (price >= 1e6)
      return `$${(price / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (price >= 1e3) return `$${Math.round(price / 1e3)}k`;
    return `$${price}`;
  };

  // Property price marker: pill with dynamic price and pointed bottom (default + active styles)
  const createMarkerHTML = (lead: Lead, isActive = false): string => {
    const priceLabel = formatPrice(lead.price);
    const primary = "#0F62FE";
    const surfaceLight = "#FFFFFF";
    const borderSlate = "#e2e8f0";
    const textSlate = "#1e293b";
    const bg = isActive ? primary : surfaceLight;
    const textColor = isActive ? "#ffffff" : textSlate;
    const borderColor = isActive ? "#3b82f6" : borderSlate;
    const boxShadow = isActive
      ? "0 8px 20px -4px rgba(15, 98, 254, 0.4), 0 0 0 2px rgba(15, 98, 254, 0.2)"
      : "0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.08)";

    return `
      <div style="
        position: relative;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: relative;
          z-index: 1;
          background: ${bg};
          color: ${textColor};
          padding: 6px 12px;
          border-radius: 9999px;
          font-family: Inter, system-ui, sans-serif;
          font-size: ${isActive ? "14px" : "13px"};
          font-weight: ${isActive ? "700" : "600"};
          border: 1px solid ${borderColor};
          box-shadow: ${boxShadow};
          box-sizing: border-box;
          white-space: nowrap;
        ">${priceLabel}</div>
        <div style="
          position: absolute;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          bottom: -6px;
          width: 12px;
          height: 12px;
          background: ${bg};
          border-right: 1px solid ${borderColor};
          border-bottom: 1px solid ${borderColor};
          z-index: 0;
        "></div>
      </div>
    `;
  };

  const markerZoomThreshold = 6;

  // Nationwide marker: circular home pin for zoomed-out view
  const createNationwideMarkerHTML = (): string => {
    return `
      <div style="
        position: relative;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: relative;
          z-index: 1;
          width: 64px;
          height: 64px;
          background: #0F62FE;
          border-radius: 9999px;
          box-shadow: 0 12px 24px -4px rgba(15, 98, 254, 0.3), 0 8px 16px -4px rgba(15, 98, 254, 0.2);
          border: 4px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        ">
          <span class="material-symbols-outlined" style="font-size:28px;color:#ffffff;line-height:1;">home</span>
        </div>
        <div style="
          position: absolute;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
          bottom: -8px;
          width: 20px;
          height: 20px;
          background: #0F62FE;
          border-right: 4px solid #ffffff;
          border-bottom: 4px solid #ffffff;
          border-radius: 2px;
          box-sizing: border-box;
          z-index: 0;
        "></div>
        <div style="
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: -12px;
          width: 16px;
          height: 8px;
          background: rgba(0, 0, 0, 0.2);
          filter: blur(3px);
          border-radius: 9999px;
          z-index: -1;
        "></div>
      </div>
    `;
  };

  const getMarkerHTMLForZoom = (lead: Lead, zoomLevel: number | null) => {
    if (!zoomLevel || zoomLevel < markerZoomThreshold) return createNationwideMarkerHTML();
    return createMarkerHTML(lead);
  };

  // Property details popup card (1:1: image, For Sale, price, address, Material Symbols, beds/sqft, marker tip). Single card only; no scroll.
  const createPopupContent = (lead: Lead): string => {
    const primary = "#6366f1";
    const imgSrc =
      lead.primary_photo ||
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAHx1cX5YzK46YGrGO1wOmFsj9vY1F5FShgxiUm7ngkY9NjUN4QMRoG1P7qgn8LR-cJQVi3rR5hpxU3XqOipYwRIdzfw0uHgvaZyAz89vHlZJgb-PxQmYwEfqci-niVXH3xvw7hs-VjFZx9FziiPFg-SoF4F7K4-lqGSSEdwjqosG1PI1rbg8RMUh-qSa4gs5wC7YQvJK02f6Zgb8wJKaUwwuOKAV_IPE0-snAXIcS-B3SPawMf_OjpTl9RVeo6KX4JeBSL2n1UJnC1";
    const priceStr = lead.price ? `$${lead.price.toLocaleString()}` : "—";
    const address = lead.address || "Address not available";
    const cityStateZip = [lead.city, lead.state, lead.zip]
      .filter(Boolean)
      .join(", ");
    const bedsStr = lead.beds
      ? `${lead.beds} Bed${lead.beds !== 1 ? "s" : ""}`
      : "—";
    const sqftStr = lead.sqft
      ? `${lead.sqft.toLocaleString()} sqft`
      : "—";
    const viewUrl = lead.url || "#";
    const safeAddress = address.replace(/</g, "&lt;");
    const safeCity = cityStateZip.replace(/</g, "&lt;");
    return `
    <div class="property-details-popup-root" style="position:relative;width:100%;max-width:144px;font-family:Inter,system-ui,sans-serif;overflow:hidden;">
      <div style="position:relative;background:#fff;border-radius:7px;box-shadow:0 15px 30px -7px rgba(0,0,0,0.25);overflow:hidden;border:1px solid rgba(226,232,240,0.6);">
        <div style="width:100%;aspect-ratio:1;background:#f1f5f9;overflow:hidden;position:relative;">
          <img alt="Property" src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22 viewBox=%220 0 240 240%22%3E%3Crect fill=%22%23e2e8f0%22 width=%22240%22 height=%22240%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%2294a3b8%22 font-size=%2214%22%3ENo image%3C/text%3E%3C/svg%3E'"/>
          <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.05),transparent);pointer-events:none;"></div>
        </div>
        <div style="padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:5px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:7px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${primary};margin-bottom:2px;">For Sale</div>
              <h2 style="margin:0;font-size:11px;font-weight:700;color:#0f172a;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${priceStr}</h2>
            </div>
            <div style="display:flex;gap:2px;">
              <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" style="padding:5px;color:#64748b;background:transparent;border:none;border-radius:5px;cursor:pointer;text-decoration:none;display:flex;" title="View Details" aria-label="View Details">
                <span class="material-symbols-outlined" style="font-size:11px;">visibility</span>
              </a>
              <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" style="padding:5px;color:#64748b;background:transparent;border:none;border-radius:5px;cursor:pointer;text-decoration:none;display:flex;" title="Street View" aria-label="Street View">
                <span class="material-symbols-outlined" style="font-size:11px;">map</span>
              </a>
            </div>
          </div>
          <div style="margin-top:5px;">
            <p style="margin:0;font-size:8px;font-weight:500;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeAddress}</p>
            <p style="margin:1px 0 0 0;font-size:7px;color:#64748b;">${safeCity}</p>
          </div>
          <div style="margin-top:10px;padding-top:7px;border-top:1px solid rgba(241,245,249,0.8);display:flex;align-items:center;justify-content:space-between;font-size:7px;font-weight:500;color:#64748b;">
            <div style="display:flex;align-items:center;gap:4px;"><span class="material-symbols-outlined" style="font-size:8px;opacity:0.7;">bed</span><span>${bedsStr}</span></div>
            <div style="width:2px;height:2px;background:#cbd5e1;border-radius:9999px;"></div>
            <div style="display:flex;align-items:center;gap:4px;"><span class="material-symbols-outlined" style="font-size:8px;opacity:0.7;">square_foot</span><span>${sqftStr}</span></div>
          </div>
        </div>
      </div>
      <div class="marker-tip" style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%) rotate(45deg);width:10px;height:10px;background:#fff;border-right:1px solid rgba(226,232,240,0.6);border-bottom:1px solid rgba(226,232,240,0.6);"></div>
    </div>
    `;
  };

  // Initialize map - re-initialize when isActive becomes true
  useEffect(() => {
    if (!isActive || !mapContainer.current) {
      // Clean up if not active
      if (map.current) {
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];
        if (searchMarker.current) {
          searchMarker.current.remove();
          searchMarker.current = null;
        }
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
      return;
    }

    // If map already exists, don't re-initialize unless it was cleaned up
    if (map.current) return;

    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!MAPBOX_TOKEN) {
      console.error("Mapbox access token not found");
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Clear any existing markers before creating new map
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    if (searchMarker.current) {
      searchMarker.current.remove();
      searchMarker.current = null;
    }

    // Continental US bounds - lock map to United States [sw, ne]
    const usBounds = [
      [-125.0, 24.52], // Southwest [lng, lat]
      [-66.95, 49.38], // Northeast [lng, lat]
    ] as [mapboxgl.LngLatLike, mapboxgl.LngLatLike];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283], // Geographic center of contiguous US [lng, lat]
      zoom: 4,
      maxBounds: usBounds,
    });

    map.current.on("load", () => {
      setMapLoaded(true);
    });
    map.current.on("zoomend", () => {
      if (!map.current) return;
      const zoomLevel = map.current.getZoom();
      markers.current.forEach((marker) => {
        const el = marker.getElement() as unknown as { __lead?: Lead; innerHTML?: string };
        const lead = el.__lead;
        if (!lead) return;
        if (typeof el.innerHTML === "string") {
          el.innerHTML = getMarkerHTMLForZoom(lead, zoomLevel);
        }
      });
    });

    // Cleanup
    return () => {
      if (searchMarker.current) {
        searchMarker.current.remove();
        searchMarker.current = null;
      }
      if (map.current) {
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, [isActive]);

  // Search for addresses using Mapbox Geocoding API
  const searchAddress = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!MAPBOX_TOKEN) return;

    setIsSearching(true);

    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=address,place,poi`
      );

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setSearchResults(data.features || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search result selection
  const handleSearchResultClick = (result: any) => {
    if (!map.current) return;

    const [lng, lat] = result.center;
    const placeName = result.place_name || result.text || "Searched Location";

    // Remove previous search marker
    if (searchMarker.current) {
      searchMarker.current.remove();
    }

    // Create new search marker (different style from property markers)
    const el = document.createElement("div");
    el.innerHTML = `
      <div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #ff6b6b;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
      ">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: white;
        "></div>
      </div>
    `;

    searchMarker.current = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h3 style="margin: 0 0 4px 0; color: #1f2937; font-size: 14px; font-weight: 600;">
                ${placeName}
              </h3>
            </div>
          `)
      )
      .addTo(map.current);

    // Open popup
    searchMarker.current.togglePopup();

    // Fly to location
    map.current.flyTo({
      center: [lng, lat],
      zoom: 14,
      duration: 1500,
    });

    // Close search results
    setShowSearchResults(false);
    setSearchQuery(placeName);
  };

  // Geocode address using Mapbox Geocoding API
  const geocodeAddress = async (
    lead: Lead,
    cached: Map<string, { lat: number; lng: number }>
  ): Promise<{ lat: number; lng: number } | null> => {
    const addressKey =
      `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`.trim();

    // Check if already geocoded
    if (cached.has(addressKey)) {
      return cached.get(addressKey)!;
    }

    // Check if geocoding is in progress
    if (geocodingInProgress.current.has(addressKey)) {
      return null;
    }

    // Skip if address is not available
    if (
      !lead.address ||
      lead.address === "Address not available" ||
      !lead.city ||
      !lead.state
    ) {
      return null;
    }

    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!MAPBOX_TOKEN) return null;

    geocodingInProgress.current.add(addressKey);

    try {
      const query = encodeURIComponent(
        `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`.trim()
      );
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );

      if (!response.ok) {
        throw new Error("Geocoding failed");
      }

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const coords = { lat, lng };

        // Cache the result
        setGeocodedLeads((prev) => new Map(prev).set(addressKey, coords));
        setGeocodingCount((prev) => Math.max(0, prev - 1));
        return coords;
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setGeocodingCount((prev) => Math.max(0, prev - 1));
    } finally {
      geocodingInProgress.current.delete(addressKey);
    }

    return null;
  };

  // Update markers when listings change
  useEffect(() => {
    if (!map.current || !mapLoaded) {
      return;
    }

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (!listings.length) {
      return;
    }

    // Create bounds to fit all markers
    const bounds = new mapboxgl.LngLatBounds();

    // Process leads with coordinates first
    const leadsWithCoords: Lead[] = [];
    const leadsWithoutCoords: Lead[] = [];

    listings.forEach((lead) => {
      if (lead.latitude && lead.longitude) {
        leadsWithCoords.push(lead);
      } else if (
        lead.address &&
        lead.address !== "Address not available" &&
        lead.city &&
        lead.state
      ) {
        leadsWithoutCoords.push(lead);
      }
    });

    // Add markers for leads with coordinates immediately
    leadsWithCoords.forEach((lead) => {
      const el = document.createElement("div");
      el.innerHTML = getMarkerHTMLForZoom(lead, map.current?.getZoom() ?? null);
      (el as unknown as { __lead?: Lead }).__lead = lead;
      el.style.cursor = "pointer";

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lead.longitude!, lead.latitude!])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, className: "map-property-popup" }).setHTML(
            createPopupContent(lead)
          )
        )
        .addTo(map.current!);

      markers.current.push(marker);
      bounds.extend([lead.longitude!, lead.latitude!]);
    });

    // Fit map to show markers with coordinates first
    if (leadsWithCoords.length > 0) {
      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15,
      });
    }

    // Geocode and add markers for leads without coordinates asynchronously
    if (leadsWithoutCoords.length > 0) {
      setGeocodingCount(leadsWithoutCoords.length);

      // Get current cached geocodes
      const currentCache = geocodedLeads;

      Promise.all(
        leadsWithoutCoords.map(async (lead) => {
          const coords = await geocodeAddress(lead, currentCache);
          return { lead, coords };
        })
      )
        .then((results) => {
          setGeocodingCount(0);
          if (!map.current) return;

          const newBounds = new mapboxgl.LngLatBounds();

          // Extend bounds with existing markers
          markers.current.forEach((marker) => {
            const lngLat = marker.getLngLat();
            newBounds.extend([lngLat.lng, lngLat.lat]);
          });

          // Add markers for geocoded leads
          results.forEach(({ lead, coords }) => {
            if (coords && map.current) {
              const el = document.createElement("div");
              el.innerHTML = getMarkerHTMLForZoom(lead, map.current?.getZoom() ?? null);
              (el as unknown as { __lead?: Lead }).__lead = lead;
              el.style.cursor = "pointer";

              const marker = new mapboxgl.Marker(el)
                .setLngLat([coords.lng, coords.lat])
                .setPopup(
                  new mapboxgl.Popup({ offset: 25, className: "map-property-popup" }).setHTML(
                    createPopupContent(lead)
                  )
                )
                .addTo(map.current!);

              markers.current.push(marker);
              newBounds.extend([coords.lng, coords.lat]);
            }
          });

          // Update map bounds to include all markers
          if (markers.current.length > 0) {
            map.current.fitBounds(newBounds, {
              padding: { top: 50, bottom: 50, left: 50, right: 50 },
              maxZoom: 15,
            });
          }
        })
        .catch((error) => {
          console.error("Error geocoding addresses:", error);
          setGeocodingCount(0);
        });
    }
  }, [mapLoaded, listings]);

  if (!isActive) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Switch to Map view to see leads</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-96 bg-yellow-50 rounded-lg">
        <div className="text-center">
          <div className="text-yellow-600 text-6xl mb-4">🔑</div>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            Mapbox Access Token Required
          </h3>
          <p className="text-yellow-600 mb-4">
            Please add your Mapbox access token to the environment variables.
          </p>
          <div className="bg-yellow-100 p-4 rounded-lg text-left text-sm">
            <p className="font-semibold mb-2">Add to your .env.local file:</p>
            <code className="block bg-white p-2 rounded border">
              NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={fullScreen ? "w-full h-full min-h-0" : "w-full"}>
      {!fullScreen && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Property Map</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {listings.length} propert{listings.length !== 1 ? "ies" : "y"} found
                {geocodingCount > 0 && (
                  <span className="ml-2 text-blue-600">
                    (Geocoding {geocodingCount} address
                    {geocodingCount !== 1 ? "es" : ""}...)
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Expired</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Geo</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Enriched</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span>Default</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4 relative">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchAddress(e.target.value);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding results to allow click
                  setTimeout(() => setShowSearchResults(false), 200);
                }}
                placeholder="Search for an address or location..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </div>
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSearchResultClick(result)}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    style={{
                      fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    }}
                  >
                    <div className="font-medium text-gray-900 text-sm">
                      {result.text || result.place_name}
                    </div>
                    {result.place_name && result.place_name !== result.text && (
                      <div className="text-xs text-gray-500 mt-1">
                        {result.place_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showSearchResults &&
              searchResults.length === 0 &&
              searchQuery.length >= 3 &&
              !isSearching && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
                  No results found
                </div>
              )}
          </div>
        </>
      )}

      <div
        ref={mapContainer}
        className={fullScreen ? "h-full" : undefined}
        style={{
          width: "100%",
          height: fullScreen ? "100%" : "600px",
          borderRadius: fullScreen ? "0" : "8px",
          overflow: "hidden",
          position: "relative",
        }}
      />
    </div>
  );
};

export default MapboxViewFallback;
