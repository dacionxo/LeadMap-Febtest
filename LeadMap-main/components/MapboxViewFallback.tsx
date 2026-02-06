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

  // Function to get marker color based on lead type
  const getMarkerColor = (lead: Lead): string => {
    if (lead.expired) return "#ef4444"; // Red for expired leads
    if (lead.geo_source) return "#3b82f6"; // Blue for geo-sourced leads
    if (
      lead.owner_email ||
      (lead.enrichment_confidence && lead.enrichment_confidence > 0)
    )
      return "#10b981"; // Green for enriched leads
    return "#8b5cf6"; // Purple for default/probate leads
  };

  // Function to create marker HTML
  const createMarkerHTML = (lead: Lead): string => {
    const color = getMarkerColor(lead);
    const symbol = lead.expired
      ? "!"
      : lead.geo_source
        ? "📍"
        : lead.owner_email || lead.enrichment_confidence
          ? "✓"
          : "🏠";

    return `
      <div style="
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: ${color};
        border: 1.5px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: bold;
        color: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        cursor: pointer;
        line-height: 1;
      ">${symbol}</div>
    `;
  };

  // Function to create popup content
  const createPopupContent = (lead: Lead): string => {
    return `
      <div style="padding: 8px; max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600;">
          ${lead.address || "Address not available"}
        </h3>
        ${
          lead.city && lead.state
            ? `
          <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
            ${lead.city}, ${lead.state} ${lead.zip || ""}
          </p>
        `
            : ""
        }
        <div style="display: flex; gap: 12px; margin: 8px 0;">
          <div>
            <span style="color: #059669; font-weight: bold; font-size: 18px;">
              $${lead.price.toLocaleString()}
            </span>
            ${
              lead.price_drop_percent > 0
                ? `
              <span style="color: #dc2626; font-size: 14px; margin-left: 4px;">
                (${lead.price_drop_percent.toFixed(1)}% off)
              </span>
            `
                : ""
            }
          </div>
        </div>
        <div style="display: flex; gap: 12px; margin: 8px 0; font-size: 14px; color: #6b7280;">
          ${lead.beds ? `<span>${lead.beds} bed${lead.beds !== 1 ? "s" : ""}</span>` : ""}
          ${lead.sqft ? `<span>${lead.sqft.toLocaleString()} sqft</span>` : ""}
          ${lead.year_built ? `<span>Built ${lead.year_built}</span>` : ""}
        </div>
        ${
          lead.days_on_market > 0
            ? `
          <p style="margin: 4px 0 0 0; color: #f59e0b; font-size: 14px;">
            ${lead.days_on_market} days on market
          </p>
        `
            : ""
        }
        ${
          lead.description
            ? `
          <p style="margin: 8px 0 0 0; color: #374151; font-size: 13px; line-height: 1.4;">
            ${lead.description.substring(0, 150)}${lead.description.length > 150 ? "..." : ""}
          </p>
        `
            : ""
        }
        <div style="margin-top: 12px;">
          <a href="${lead.url}" target="_blank" rel="noopener noreferrer" 
             style="display: inline-block; background: #3b82f6; color: white; 
                    padding: 6px 12px; border-radius: 4px; text-decoration: none; 
                    font-size: 14px; font-weight: 500;">
            View Property
          </a>
        </div>
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

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-81.3792, 28.5383], // Orlando, FL center [lng, lat]
      zoom: 10,
    });

    map.current.on("load", () => {
      setMapLoaded(true);
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
      el.innerHTML = createMarkerHTML(lead);
      el.style.cursor = "pointer";

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lead.longitude!, lead.latitude!])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(createPopupContent(lead))
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
              el.innerHTML = createMarkerHTML(lead);
              el.style.cursor = "pointer";

              const marker = new mapboxgl.Marker(el)
                .setLngLat([coords.lng, coords.lat])
                .setPopup(
                  new mapboxgl.Popup({ offset: 25 }).setHTML(
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
