'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

// Extend window type for Google Maps
declare global {
  interface Window {
    google?: {
      maps: typeof google.maps;
    };
  }
}

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

interface GoogleMapsViewEnhancedProps {
  isActive: boolean;
  listings: Lead[];
  loading: boolean;
  onError?: () => void;
}

const MapComponent: React.FC<{ 
  leads: Lead[]; 
  onStreetViewClick: (lat: number, lng: number, address: string) => void;
  onMapReady: (map: google.maps.Map) => void;
  onError?: () => void;
}> = ({ leads, onStreetViewClick, onMapReady, onError }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to get marker color based on lead type
  const getMarkerColor = (lead: Lead) => {
    if (lead.expired) return '#ef4444';
    if (lead.geo_source) return '#3b82f6';
    if (lead.owner_email || (lead.enrichment_confidence && lead.enrichment_confidence > 0)) return '#10b981';
    return '#8b5cf6';
  };

  // Function to get marker icon
  const getMarkerIcon = (lead: Lead) => {
    const color = getMarkerColor(lead);
    const symbol = lead.expired ? '!' : 
                   lead.geo_source ? '📍' : 
                   (lead.owner_email || lead.enrichment_confidence) ? '✓' : '🏠';
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="9" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
          <text x="10" y="13" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${symbol}</text>
        </svg>
      `),
      scaledSize: new google.maps.Size(20, 20),
      anchor: new google.maps.Point(10, 10)
    };
  };

  useEffect(() => {
    if (!mapRef.current || map) return;

    // Check if google.maps is available
    if (typeof window === 'undefined' || !window.google || !window.google.maps) {
      console.error('Google Maps API not loaded');
      if (onError) {
        setTimeout(() => onError(), 100);
      }
      return;
    }

    try {
      // Set timeout to detect if map fails to initialize
      initTimeoutRef.current = setTimeout(() => {
        if (!map) {
          console.error('Google Maps failed to initialize within timeout');
          if (onError) onError();
        }
      }, 10000); // 10 second timeout

      const mapInstance = new google.maps.Map(mapRef.current, {
        center: { lat: 28.5383, lng: -81.3792 },
        zoom: 10,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Check if map instance is valid
      if (!mapInstance) {
        throw new Error('Failed to create map instance');
      }

      setMap(mapInstance);
      onMapReady(mapInstance);
      
      // Clear timeout on success
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      const infoWindowInstance = new google.maps.InfoWindow();
      setInfoWindow(infoWindowInstance);
      
      mapInstance.addListener('click', () => {
        infoWindowInstance.close();
      });

      // Listen for map errors
      mapInstance.addListener('error', (error: any) => {
        console.error('Google Maps error event:', error);
        if (onError) onError();
      });
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (onError) {
        setTimeout(() => onError(), 100);
      }
    }

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [onMapReady, onError, map]);

  useEffect(() => {
    if (!map || !leads.length) return;

    markers.forEach(marker => marker.setMap(null));

    const newMarkers: google.maps.Marker[] = [];

    leads.forEach((lead) => {
      if (lead.latitude && lead.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: lead.latitude, lng: lead.longitude },
          map: map,
          title: `${lead.address}, ${lead.city}, ${lead.state}`,
          icon: getMarkerIcon(lead)
        });

        marker.addListener('click', () => {
          if (infoWindow) {
            infoWindow.close();
          }
          
          const address = [lead.address, lead.city, lead.state, lead.zip]
            .filter(Boolean)
            .join(', ');
          
          // Create a div for the info window content
          const contentDiv = document.createElement('div');
          contentDiv.style.padding = '8px';
          contentDiv.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          contentDiv.style.maxWidth = '300px';
          
          contentDiv.innerHTML = `
            <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px; font-weight: 600;">
              ${lead.address || 'Address not available'}
            </h3>
            <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
              ${lead.city}, ${lead.state} ${lead.zip || ''}
            </p>
            <div style="display: flex; gap: 12px; margin: 8px 0;">
              <div>
                <span style="color: #059669; font-weight: bold; font-size: 18px;">
                  $${lead.price.toLocaleString()}
                </span>
                ${lead.price_drop_percent > 0 ? `
                  <span style="color: #dc2626; font-size: 14px; margin-left: 4px;">
                    (${lead.price_drop_percent.toFixed(1)}% off)
                  </span>
                ` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 12px; margin: 8px 0; font-size: 14px; color: #6b7280;">
              ${lead.beds ? `<span>${lead.beds} bed${lead.beds !== 1 ? 's' : ''}</span>` : ''}
              ${lead.sqft ? `<span>${lead.sqft.toLocaleString()} sqft</span>` : ''}
              ${lead.year_built ? `<span>Built ${lead.year_built}</span>` : ''}
            </div>
            ${lead.days_on_market > 0 ? `
              <p style="margin: 4px 0 0 0; color: #f59e0b; font-size: 14px;">
                ${lead.days_on_market} days on market
              </p>
            ` : ''}
            <div style="margin-top: 12px; display: flex; gap: 8px;">
              <a href="${lead.url}" target="_blank" rel="noopener noreferrer" 
                 style="display: inline-block; background: #3b82f6; color: white; 
                        padding: 6px 12px; border-radius: 4px; text-decoration: none; 
                        font-size: 14px; font-weight: 500;">
                View Property
              </a>
              <button id="street-view-btn-${lead.id}"
                 style="background: #10b981; color: white; border: none;
                        padding: 6px 12px; border-radius: 4px; cursor: pointer; 
                        font-size: 14px; font-weight: 500;">
                Street View
              </button>
            </div>
          `;
          
          if (infoWindow) {
            infoWindow.setContent(contentDiv);
            infoWindow.open(map, marker);
            
            // Add event listener to Street View button after info window is open
            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
              const btn = document.getElementById(`street-view-btn-${lead.id}`);
              if (btn) {
                btn.addEventListener('click', () => {
                  onStreetViewClick(lead.latitude!, lead.longitude!, address);
                });
              }
            });
          }
        });

        newMarkers.push(marker);
      }
    });

    setMarkers(newMarkers);

    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      map.fitBounds(bounds);
    }
  }, [map, leads, infoWindow, onStreetViewClick]);

  return <div ref={mapRef} style={{ width: '100%', height: '600px' }} />;
};

const render = (status: Status, onError?: () => void): React.ReactElement => {
  switch (status) {
    case Status.LOADING:
      return (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Google Maps...</p>
          </div>
        </div>
      );
    case Status.FAILURE:
      // Trigger fallback to Mapbox
      if (onError) {
        setTimeout(() => onError(), 100);
      }
      return (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Switching to Mapbox...</p>
          </div>
        </div>
      );
    default:
      return <div></div>;
  }
};

const GoogleMapsViewEnhanced: React.FC<GoogleMapsViewEnhancedProps> = ({ isActive, listings, loading, onError }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchMarkerRef = useRef<google.maps.Marker | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  // Callback when map is ready
  const handleMapReady = (map: google.maps.Map) => {
    mapInstanceRef.current = map;
  };

  // Handle Street View click
  const handleStreetViewClick = (lat: number, lng: number, address: string) => {
    const streetViewApiKey = process.env.NEXT_PUBLIC_GOOGLE_STREET_VIEW_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBkD3srgAqEHFM4DbU-dv6Zc4EEoB5yhBU';
    const encodedLocation = encodeURIComponent(`${lat},${lng}`);
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodedLocation}&heading=0&pitch=0&fov=90`;
    
    // Open Street View in new tab
    window.open(url, '_blank');
  };

  // Search for addresses using Google Places API
  const searchAddress = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M';
    if (!GOOGLE_MAPS_API_KEY) return;

    setIsSearching(true);

    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}&types=address`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data.predictions || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search result selection
  const handleSearchResultClick = async (prediction: any) => {
    const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M';
    
    try {
      const detailsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      if (!detailsResponse.ok) return;
      
      const detailsData = await detailsResponse.json();
      const location = detailsData.result.geometry.location;
      
      // Navigate map to location
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: location.lat, lng: location.lng });
        mapInstanceRef.current.setZoom(15);
        
        if (searchMarkerRef.current) {
          searchMarkerRef.current.setMap(null);
        }
        
        searchMarkerRef.current = new google.maps.Marker({
          position: { lat: location.lat, lng: location.lng },
          map: mapInstanceRef.current,
          title: prediction.description,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
          }
        });
      }
      
      setShowSearchResults(false);
      setSearchQuery(prediction.description);
    } catch (error) {
      console.error('Error getting place details:', error);
    }
  };

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

  const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M';

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex items-center justify-center h-96 bg-yellow-50 rounded-lg">
        <div className="text-center">
          <div className="text-yellow-600 text-6xl mb-4">🔑</div>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Google Maps API Key Required</h3>
          <p className="text-yellow-600 mb-4">
            Please add your Google Maps API key to the environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Property Map</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {listings.length} propert{listings.length !== 1 ? 'ies' : 'y'} found
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
              setTimeout(() => setShowSearchResults(false), 200);
            }}
            placeholder="Search for an address or location..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              >
                <div className="font-medium text-gray-900 text-sm">
                  {result.description}
                </div>
              </div>
            ))}
          </div>
        )}

        {showSearchResults && searchResults.length === 0 && searchQuery.length >= 3 && !isSearching && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
            No results found
          </div>
        )}
      </div>
      
      <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={(status) => render(status, onError)}>
        <MapComponent 
          leads={listings} 
          onStreetViewClick={handleStreetViewClick}
          onMapReady={handleMapReady}
          onError={onError}
        />
      </Wrapper>
    </div>
  );
};

export default GoogleMapsViewEnhanced;
