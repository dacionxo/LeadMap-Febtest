'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  onStreetViewListingClick?: (leadId: string) => void; // NEW: Callback to open property details modal
}

const MapComponent: React.FC<{ 
  leads: Lead[]; 
  onStreetViewClick: (lead: Lead) => void; // CHANGED: Pass full Lead object
  onMapReady: (map: google.maps.Map) => void;
  onError?: () => void;
}> = ({ leads, onStreetViewClick, onMapReady, onError }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  // Store callbacks in refs to avoid dependency issues
  const onMapReadyRef = useRef(onMapReady);
  const onErrorRef = useRef(onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
    onErrorRef.current = onError;
  }, [onMapReady, onError]);

  // Function to immediately open Street View on the map
  const openStreetViewImmediately = useCallback((lat: number, lng: number, mapInstance: google.maps.Map, lead?: Lead) => {
    try {
      if (!mapInstance || typeof window === 'undefined' || !window.google?.maps) {
        console.error('Map instance or Google Maps API not available');
        // Fallback to modal if available
        if (lead) {
          onStreetViewClick(lead);
        }
        return;
      }

      // Get the Street View service
      const streetViewService = new window.google.maps.StreetViewService();
      const panorama = mapInstance.getStreetView();

      // Check if Street View is available at this location
      streetViewService.getPanorama(
        { location: { lat, lng }, radius: 50 },
        (data, status) => {
          if (status === 'OK' && data) {
            // Street View is available - activate it immediately
            panorama.setPosition({ lat, lng });
            panorama.setPov({
              heading: 270, // Default heading (west)
              pitch: 0
            });
            panorama.setVisible(true);
            mapInstance.setStreetView(panorama);
            
            // Center the map on the location and zoom in
            mapInstance.setCenter({ lat, lng });
            mapInstance.setZoom(18);
            
            console.log('Street View opened successfully at', lat, lng);
          } else {
            // Street View not available - open modal as fallback
            console.warn('Street View not available at this location, opening modal instead');
            if (lead) {
              onStreetViewClick(lead);
            } else {
              // Try to find lead by coordinates
              const foundLead = leads.find(l => 
                l.latitude === lat && l.longitude === lng
              );
              if (foundLead) {
                onStreetViewClick(foundLead);
              }
            }
          }
        }
      );
    } catch (err) {
      console.error('Error opening Street View:', err);
      // Fallback: try to open modal
      if (lead) {
        onStreetViewClick(lead);
      } else {
        const foundLead = leads.find(l => 
          l.latitude === lat && l.longitude === lng
        );
        if (foundLead) {
          onStreetViewClick(foundLead);
        }
      }
    }
  }, [leads, onStreetViewClick]);

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

  // Retry state for waiting for Google Maps API
  const [mapInitAttempt, setMapInitAttempt] = useState(0);

  useEffect(() => {
    if (!mapRef.current || isInitializedRef.current || map) return;
    
    // ✅ Safety: only proceed once Maps JS is loaded
    if (typeof window === 'undefined' || !window.google || !window.google.maps) {
      // Try again in 100ms (faster retry), but cap the number of attempts (30 attempts = 3 seconds max)
      if (mapInitAttempt < 30) {
        const id = window.setTimeout(() => setMapInitAttempt(a => a + 1), 100);
        return () => window.clearTimeout(id);
      }
      console.error('Google Maps API not available after waiting');
      if (onErrorRef.current) {
        setTimeout(() => onErrorRef.current?.(), 100);
      }
      return;
    }

    try {
      // Set timeout to detect if map fails to initialize
      // Give Google Maps more time to load before timing out
      initTimeoutRef.current = setTimeout(() => {
        if (!map) {
          console.error('Google Maps failed to initialize within timeout');
          if (onErrorRef.current) onErrorRef.current();
        }
      }, 15000); // 15 second timeout - give more time for API to load

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 28.5383, lng: -81.3792 },
        zoom: 10,
        streetViewControl: true, // Enable Street View Pegman control
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
        rotateControl: true,
        scaleControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      // Handle map resize when container becomes visible
      const handleResize = () => {
        if (mapInstance) {
          window.google.maps.event.trigger(mapInstance, 'resize')
        }
      }

      // Use ResizeObserver to detect when container becomes visible
      if (mapRef.current) {
        const resizeObserver = new ResizeObserver(() => {
          handleResize()
        })
        resizeObserver.observe(mapRef.current)
        
        // Also listen for window resize
        window.addEventListener('resize', handleResize)
      }

      // Check if map instance is valid
      if (!mapInstance) {
        throw new Error('Failed to create map instance');
      }

      setMap(mapInstance);
      onMapReadyRef.current(mapInstance);
      isInitializedRef.current = true;
      
      // Clear timeout on success
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      const infoWindowInstance = new window.google.maps.InfoWindow();
      setInfoWindow(infoWindowInstance);
      
      mapInstance.addListener('click', () => {
        infoWindowInstance.close();
      });

      // Listen for map errors
      mapInstance.addListener('error', (error: any) => {
        console.error('Google Maps error event:', error);
        if (onErrorRef.current) onErrorRef.current();
      });
    } catch (error) {
      console.error('Error initializing Google Maps:', error);
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (onErrorRef.current) {
        setTimeout(() => onErrorRef.current?.(), 100);
      }
    }

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [map, mapInitAttempt]);

  useEffect(() => {
    if (!map || !leads.length) return;

    markers.forEach(marker => marker.setMap(null));

    const newMarkers: google.maps.Marker[] = [];

    // Separate leads with coordinates from those needing geocoding
    const leadsWithCoords: Lead[] = [];
    const leadsNeedingGeocode: Lead[] = [];

    leads.forEach((lead) => {
      if (lead.latitude && lead.longitude) {
        leadsWithCoords.push(lead);
      } else if (lead.address && (lead.city || lead.state)) {
        // Only geocode if we have at least address and city/state
        leadsNeedingGeocode.push(lead);
      }
    });

    // Create markers for leads with coordinates (fast path - instant rendering)
    leadsWithCoords.forEach((lead) => {
      const marker = new window.google.maps.Marker({
        position: { lat: lead.latitude!, lng: lead.longitude! },
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
            window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
              const btn = document.getElementById(`street-view-btn-${lead.id}`);
              if (btn) {
                btn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Close info window first
                  if (infoWindow) {
                    infoWindow.close();
                  }
                  
                  // Immediately open Street View on the map if coordinates are available
                  if (lead.latitude && lead.longitude && map) {
                    openStreetViewImmediately(lead.latitude, lead.longitude, map, lead);
                  } else {
                    // Fallback: open modal if no coordinates
                    onStreetViewClick(lead);
                  }
                });
              }
            });
          }
        });

        newMarkers.push(marker);
    });

    // Geocode leads without coordinates (fallback - only if needed)
    if (leadsNeedingGeocode.length > 0 && typeof window !== 'undefined' && window.google?.maps) {
      // Use a small batch to avoid overwhelming the geocoding API
      const batchSize = 5;
      const batch = leadsNeedingGeocode.slice(0, batchSize);

      batch.forEach(async (lead) => {
        try {
          const address = [lead.address, lead.city, lead.state, lead.zip]
            .filter(Boolean)
            .join(', ');

          if (!address) return;

          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location;
              const marker = new window.google.maps.Marker({
                position: { lat: location.lat(), lng: location.lng() },
                map: map,
                title: `${lead.address}, ${lead.city}, ${lead.state}`,
                icon: getMarkerIcon(lead)
              });

              // Add click listener (same as above)
              marker.addListener('click', () => {
                if (infoWindow) {
                  infoWindow.close();
                }
                
                const addressStr = [lead.address, lead.city, lead.state, lead.zip]
                  .filter(Boolean)
                  .join(', ');
                
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
                    <button id="street-view-btn-geocode-${lead.id}"
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
                  
                  window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                    const btn = document.getElementById(`street-view-btn-geocode-${lead.id}`);
                    if (btn) {
                      btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Close info window first
                        if (infoWindow) {
                          infoWindow.close();
                        }
                        
                        // Get coordinates from geocoded location
                        const position = marker.getPosition();
                        if (position && map) {
                          openStreetViewImmediately(position.lat(), position.lng(), map, lead);
                        } else {
                          // Fallback: open modal
                          onStreetViewClick(lead);
                        }
                      });
                    }
                  });
                }
              });

              newMarkers.push(marker);
              setMarkers([...newMarkers]);

              // Update bounds when new marker is added
              if (newMarkers.length > 0 && map) {
                const bounds = new window.google.maps.LatLngBounds();
                newMarkers.forEach(m => {
                  const pos = m.getPosition();
                  if (pos) bounds.extend(pos);
                });
                map.fitBounds(bounds);
              }
            }
          });
        } catch (error) {
          console.warn(`Failed to geocode ${lead.address}:`, error);
        }
      });
    }

    setMarkers(newMarkers);

    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      map.fitBounds(bounds);
    }
  }, [map, leads, infoWindow, onStreetViewClick, openStreetViewImmediately]);

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
      // Trigger fallback to Mapbox with a longer delay to avoid premature switching
      if (onError) {
        setTimeout(() => {
          console.log('Google Maps wrapper reported failure, triggering fallback');
          onError();
        }, 2000); // Wait 2 seconds before switching to ensure it's a real failure
      }
      return (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      );
    default:
      return <div></div>;
  }
};

const GoogleMapsViewEnhanced: React.FC<GoogleMapsViewEnhancedProps> = ({ isActive, listings, loading, onError, onStreetViewListingClick }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchMarkerRef = useRef<google.maps.Marker | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  // Callback when map is ready - memoized to prevent re-renders
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapInstanceRef.current = map;
  }, []);

  // Existing inline Street View helper (kept for fallback if needed)
  const openInlineStreetView = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    try {
      const panorama = mapInstanceRef.current.getStreetView();
      panorama.setPosition({ lat, lng });
      panorama.setPov({ heading: 0, pitch: 0 });
      panorama.setVisible(true);
      mapInstanceRef.current.setStreetView(panorama);
    } catch (err) {
      console.error('Error opening inline Street View', err);
    }
  }, []);

  // NEW: Central handler for Street View clicks from MapComponent
  // Note: This is now primarily used as a fallback when Street View is not available on the map
  const handleStreetViewClickFromMap = useCallback(
    (lead: Lead) => {
      // If coordinates are available, try to open Street View on map first
      if (lead.latitude && lead.longitude && mapInstanceRef.current) {
        try {
          const streetViewService = new google.maps.StreetViewService();
          const panorama = mapInstanceRef.current.getStreetView();
          
          streetViewService.getPanorama(
            { location: { lat: lead.latitude, lng: lead.longitude }, radius: 50 },
            (data, status) => {
              if (status === 'OK' && data) {
                // Street View available - open it on map
                panorama.setPosition({ lat: lead.latitude!, lng: lead.longitude! });
                panorama.setPov({ heading: 270, pitch: 0 });
                panorama.setVisible(true);
                mapInstanceRef.current?.setStreetView(panorama);
                mapInstanceRef.current?.setCenter({ lat: lead.latitude!, lng: lead.longitude! });
                mapInstanceRef.current?.setZoom(18);
              } else {
                // Street View not available - open modal as fallback
                if (onStreetViewListingClick) {
                  onStreetViewListingClick(lead.id);
                }
              }
            }
          );
        } catch (err) {
          console.error('Error opening Street View:', err);
          // Fallback to modal
          if (onStreetViewListingClick) {
            onStreetViewListingClick(lead.id);
          }
        }
      } else {
        // No coordinates - open modal
        if (onStreetViewListingClick) {
          onStreetViewListingClick(lead.id);
        }
      }
    },
    [onStreetViewListingClick]
  );

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
          onStreetViewClick={handleStreetViewClickFromMap}
          onMapReady={handleMapReady}
          onError={onError}
        />
      </Wrapper>
    </div>
  );
};

export default GoogleMapsViewEnhanced;
