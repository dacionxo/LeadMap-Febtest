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
  fullScreen?: boolean;
}

const MapComponent: React.FC<{ 
  leads: Lead[]; 
  onStreetViewClick: (lead: Lead) => void; // CHANGED: Pass full Lead object
  onMapReady: (map: google.maps.Map) => void;
  onError?: () => void;
  fullHeight?: boolean;
}> = ({ leads, onStreetViewClick, onMapReady, onError, fullHeight }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [zoomLevel, setZoomLevel] = useState(4);
  const leadsRef = useRef<Lead[]>([]);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  // Store callbacks in refs to avoid dependency issues
  const onMapReadyRef = useRef(onMapReady);
  const onErrorRef = useRef(onError);

  // Zoom threshold: >= state level show price pill, < state level show home pin (nationwide)
  const STATE_ZOOM_LEVEL = 6;
  
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

  // Build property details popup HTML (1:1 card: image, For Sale, price, address, Material Symbols, marker tip). Single card only; no scroll.
  const buildPropertyPopupHTML = (
    lead: Lead,
    opts: { streetViewBtnId: string; closeBtnId: string }
  ): string => {
    const primary = '#6366f1';
    const imgSrc =
      lead.primary_photo ||
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAHx1cX5YzK46YGrGO1wOmFsj9vY1F5FShgxiUm7ngkY9NjUN4QMRoG1P7qgn8LR-cJQVi3rR5hpxU3XqOipYwRIdzfw0uHgvaZyAz89vHlZJgb-PxQmYwEfqci-niVXH3xvw7hs-VjFZx9FziiPFg-SoF4F7K4-lqGSSEdwjqosG1PI1rbg8RMUh-qSa4gs5wC7YQvJK02f6Zgb8wJKaUwwuOKAV_IPE0-snAXIcS-B3SPawMf_OjpTl9RVeo6KX4JeBSL2n1UJnC1';
    const priceStr = lead.price
      ? `$${lead.price.toLocaleString()}`
      : '—';
    const address = lead.address || 'Address not available';
    const cityStateZip = [lead.city, lead.state, lead.zip].filter(Boolean).join(', ');
    const bedsStr = lead.beds
      ? `${lead.beds} Bed${lead.beds !== 1 ? 's' : ''}`
      : '—';
    const sqftStr = lead.sqft
      ? `${lead.sqft.toLocaleString()} sqft`
      : '—';
    const viewUrl = lead.url || '#';
    const safeAddress = address.replace(/</g, '&lt;');
    const safeCity = cityStateZip.replace(/</g, '&lt;');
    return `
    <div class="property-details-popup-root" style="position:relative;width:100%;max-width:144px;font-family:Inter,system-ui,sans-serif;overflow:hidden;">
      <div style="position:relative;background:#fff;border-radius:7px;box-shadow:0 15px 30px -7px rgba(0,0,0,0.25);overflow:hidden;border:1px solid rgba(226,232,240,0.6);">
        <button id="${opts.closeBtnId}" type="button" style="position:absolute;top:6px;right:6px;z-index:20;display:flex;align-items:center;justify-content:center;width:17px;height:17px;background:rgba(255,255,255,0.9);backdrop-filter:blur(6px);border-radius:9999px;border:1px solid rgba(0,0,0,0.05);cursor:pointer;color:#64748b;padding:0;" title="Close" aria-label="Close">
          <span class="material-symbols-outlined" style="font-size:10px;">close</span>
        </button>
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
              <button id="${opts.streetViewBtnId}" type="button" style="padding:5px;color:#64748b;background:transparent;border:none;border-radius:5px;cursor:pointer;display:flex;" title="Street View" aria-label="Street View">
                <span class="material-symbols-outlined" style="font-size:11px;">map</span>
              </button>
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

  // Format price for marker label: $1.2M, $850k, $675k
  const formatPrice = (price: number): string => {
    if (!price || price <= 0) return '—';
    if (price >= 1e6) return `$${(price / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
    if (price >= 1e3) return `$${Math.round(price / 1e3)}k`;
    return `$${price}`;
  };

  // Property price marker: pill with dynamic price and pointed bottom (default + active styles)
  const getMarkerIcon = (lead: Lead, isActive = false) => {
    const priceLabel = formatPrice(lead.price);
    const primary = '#0F62FE';
    const surfaceLight = '#FFFFFF';
    const borderSlate = '#e2e8f0';
    const textSlate = '#1e293b';
    const bg = isActive ? primary : surfaceLight;
    const textColor = isActive ? '#ffffff' : textSlate;
    const borderColor = isActive ? '#3b82f6' : borderSlate;
    // Pill width scales with label length; min width for short labels
    const pillW = Math.max(56, priceLabel.length * 10);
    const pillH = 24;
    const pointSize = 6;
    const totalH = pillH + pointSize;
    const totalW = pillW + 8;
    const cx = totalW / 2;
    const svg = `
      <svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="markerShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-opacity="0.12"/>
          </filter>
        </defs>
        <!-- Pill body (rounded rect) -->
        <rect x="4" y="0" width="${pillW}" height="${pillH}" rx="12" ry="12" fill="${bg}" stroke="${borderColor}" stroke-width="1" filter="url(#markerShadow)"/>
        <!-- Pin point (diamond) -->
        <path d="M${cx} ${totalH} L${cx - pointSize} ${pillH} L${cx} ${pillH + pointSize * 0.6} L${cx + pointSize} ${pillH} Z" fill="${bg}" stroke="${borderColor}" stroke-width="1"/>
        <!-- Price text -->
        <text x="${cx}" y="${pillH / 2 + 4}" text-anchor="middle" fill="${textColor}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="${isActive ? '700' : '600'}">${priceLabel}</text>
      </svg>
    `;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(totalW, totalH),
      anchor: new google.maps.Point(cx, totalH),
    };
  };

  // Home pin for zoomed-out (nationwide) view: circle + home icon + pointed bottom
  const getHomePinIcon = () => {
    const primary = '#0F62FE';
    const size = 64;
    const tipH = 10;
    const totalH = size + tipH;
    const cx = size / 2;
    // Simple house path (roof + body)
    const housePath = 'M32 18 L50 32 L50 52 L14 52 L14 32 Z M32 28 L32 44 L42 44 L42 36 L32 36 Z';
    const svg = `
      <svg width="${size}" height="${totalH}" viewBox="0 0 ${size} ${totalH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="homePinShadow" x="-30%" y="-20%" width="160%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.12"/>
            <feDropShadow dx="0" dy="2" stdDeviation="1" flood-opacity="0.08"/>
          </filter>
        </defs>
        <!-- Pin tip (diamond) -->
        <path d="M${cx} ${totalH} L${cx - 10} ${size} L${cx} ${size + 4} L${cx + 10} ${size} Z" fill="${primary}" stroke="white" stroke-width="2" filter="url(#homePinShadow)"/>
        <!-- Circle -->
        <circle cx="${cx}" cy="32" r="28" fill="${primary}" stroke="white" stroke-width="4" filter="url(#homePinShadow)"/>
        <!-- Home icon -->
        <path d="${housePath}" fill="white" stroke="none"/>
      </svg>
    `;
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(size, totalH),
      anchor: new google.maps.Point(cx, totalH),
    };
  };

  const getIconForZoom = (lead: Lead, zoom: number) =>
    zoom >= STATE_ZOOM_LEVEL ? getMarkerIcon(lead) : getHomePinIcon();

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

      // Continental US bounds - lock map to United States
      const usBounds = {
        north: 49.38,
        south: 24.52,
        west: -125.0,
        east: -66.95,
      };
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 39.8283, lng: -98.5795 }, // Geographic center of contiguous US
        zoom: 4,
        restriction: {
          latLngBounds: usBounds,
          strictBounds: false, // Allow some flexibility at edges
        },
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

      setZoomLevel(mapInstance.getZoom() ?? 4);
      mapInstance.addListener('zoom_changed', () => {
        const z = mapInstance.getZoom();
        if (typeof z === 'number') setZoomLevel(z);
      });
      
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

    leadsRef.current = [];
    // Create markers for leads with coordinates (fast path - instant rendering)
    leadsWithCoords.forEach((lead) => {
      const marker = new window.google.maps.Marker({
        position: { lat: lead.latitude!, lng: lead.longitude! },
          map: map,
          title: `${lead.address}, ${lead.city}, ${lead.state}`,
          icon: getIconForZoom(lead, zoomLevel)
        });
      leadsRef.current.push(lead);

        marker.addListener('click', () => {
          if (infoWindow) {
            infoWindow.close();
          }
          const streetViewBtnId = `street-view-btn-${lead.id}`;
          const closeBtnId = `close-btn-${lead.id}`;
          const contentDiv = document.createElement('div');
          contentDiv.innerHTML = buildPropertyPopupHTML(lead, {
            streetViewBtnId,
            closeBtnId,
          });
          if (infoWindow) {
            infoWindow.setContent(contentDiv);
            infoWindow.open(map, marker);
            window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
              const closeBtn = document.getElementById(closeBtnId);
              if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                  if (infoWindow) infoWindow.close();
                });
              }
              const streetViewBtn = document.getElementById(streetViewBtnId);
              if (streetViewBtn) {
                streetViewBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (infoWindow) infoWindow.close();
                  if (lead.latitude && lead.longitude && map) {
                    openStreetViewImmediately(lead.latitude, lead.longitude, map, lead);
                  } else {
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
                icon: getIconForZoom(lead, zoomLevel)
              });
              leadsRef.current.push(lead);

              marker.addListener('click', () => {
                if (infoWindow) infoWindow.close();
                const streetViewBtnId = `street-view-btn-geocode-${lead.id}`;
                const closeBtnId = `close-btn-geocode-${lead.id}`;
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = buildPropertyPopupHTML(lead, {
                  streetViewBtnId,
                  closeBtnId,
                });
                if (infoWindow) {
                  infoWindow.setContent(contentDiv);
                  infoWindow.open(map, marker);
                  window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                    const closeBtn = document.getElementById(closeBtnId);
                    if (closeBtn) {
                      closeBtn.addEventListener('click', () => {
                        if (infoWindow) infoWindow.close();
                      });
                    }
                    const streetViewBtn = document.getElementById(streetViewBtnId);
                    if (streetViewBtn) {
                      streetViewBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (infoWindow) infoWindow.close();
                        const position = marker.getPosition();
                        if (position && map) {
                          openStreetViewImmediately(position.lat(), position.lng(), map, lead);
                        } else {
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
  }, [map, leads, infoWindow, onStreetViewClick, openStreetViewImmediately, zoomLevel]);

  // Update all marker icons when zoom level changes (home pin vs price pill)
  useEffect(() => {
    if (!map || markers.length === 0) return;
    const leads = leadsRef.current;
    markers.forEach((m, i) => {
      const lead = leads[i];
      if (lead) m.setIcon(getIconForZoom(lead, zoomLevel));
    });
  }, [map, zoomLevel, markers]);

  return (
    <div
      ref={mapRef}
      className={fullHeight ? 'h-full' : undefined}
      style={{ width: '100%', height: fullHeight ? '100%' : '600px' }}
    />
  );
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

const GoogleMapsViewEnhanced: React.FC<GoogleMapsViewEnhancedProps> = ({ isActive, listings, loading, onError, onStreetViewListingClick, fullScreen }) => {
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
    <div className={fullScreen ? 'w-full h-full min-h-0' : 'w-full'}>
      {!fullScreen && (
        <>
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
        </>
      )}

      <div className={fullScreen ? 'h-full min-h-0' : undefined}>
        <Wrapper apiKey={GOOGLE_MAPS_API_KEY} render={(status) => render(status, onError)}>
          <MapComponent 
            leads={listings} 
            onStreetViewClick={handleStreetViewClickFromMap}
            onMapReady={handleMapReady}
            onError={onError}
            fullHeight={fullScreen}
          />
        </Wrapper>
      </div>
    </div>
  );
};

export default GoogleMapsViewEnhanced;
