'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports to handle errors gracefully
const GoogleMapsViewEnhanced = dynamic(
  () => import('./GoogleMapsViewEnhanced'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }
);

const MapboxViewFallback = dynamic(
  () => import('./MapboxViewFallback'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }
);

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

interface MapViewProps {
  isActive: boolean;
  listings: Lead[];
  loading: boolean;
  onStreetViewListingClick?: (leadId: string) => void; // NEW: Callback to open property details modal
}

const MapView: React.FC<MapViewProps> = ({ isActive, listings, loading, onStreetViewListingClick }) => {
  const [useGoogleMaps, setUseGoogleMaps] = useState<boolean | null>(null);
  const [googleMapsFailed, setGoogleMapsFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [mapKey, setMapKey] = useState(0); // Key to force remount

  // Reset state when isActive changes to true (component becomes active)
  useEffect(() => {
    if (isActive) {
      // Reset state when map becomes active to ensure fresh initialization
      setGoogleMapsFailed(false);
      setUseGoogleMaps(null);
      setMapKey(prev => prev + 1); // Force remount of map components
    }
  }, [isActive]);

  useEffect(() => {
    // Only initialize if isActive is true
    if (!isActive) return;

    // Google Maps is PRIMARY - always try it first
    // Only use Mapbox as fallback if Google Maps explicitly fails
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M';
    
    // Always prefer Google Maps unless it has already failed
    if (!googleMapsFailed) {
      // Google Maps is primary - use it by default
      setUseGoogleMaps(true);
    } else {
      // Google Maps has failed, fallback to Mapbox
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (mapboxToken) {
        console.log('Using Mapbox as fallback (Google Maps failed)');
        setUseGoogleMaps(false);
      } else {
        // No Mapbox token either, but still try Google Maps (might recover)
        console.warn('No Mapbox token available, attempting Google Maps despite previous failure');
      setUseGoogleMaps(true);
        setGoogleMapsFailed(false); // Reset failure state to retry
      }
    }
  }, [googleMapsFailed, isActive]);

  // Handle Google Maps error and fallback to Mapbox
  const handleGoogleMapsError = () => {
    console.warn('Google Maps failed to load, switching to Mapbox fallback');
    setGoogleMapsFailed(true);
    
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      setUseGoogleMaps(false);
      console.log('Switched to Mapbox fallback');
    } else {
      console.error('Google Maps failed and Mapbox token not available - no map provider available');
      // Keep trying Google Maps even if it failed (might be temporary)
      setUseGoogleMaps(true);
    }
  };

  // Detect Google Maps loading errors from window and console
  useEffect(() => {
    const handleGoogleMapsError = () => {
      if (!googleMapsFailed) {
        console.log('Detected Google Maps error, switching to Mapbox fallback');
        setGoogleMapsFailed(true);
        setUseGoogleMaps(false);
      }
    };

    // Listen for Google Maps initialization errors in console
    const originalError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      const errorMsg = String(message || '');
      const errorSource = String(source || '');
      
      if (
        errorMsg.includes('Google Maps') || 
        errorMsg.includes('maps.googleapis.com') ||
        errorMsg.includes('gm_authFailure') ||
        errorSource.includes('maps.googleapis.com') ||
        errorMsg.includes("didn't load Google Maps correctly")
      ) {
        handleGoogleMapsError();
        return true;
      }
      if (originalError) {
        return originalError(message, source, lineno, colno, error);
      }
      return false;
    };

    // Listen for unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason) {
        const reasonStr = String(event.reason);
        if (
          reasonStr.includes('Google Maps') || 
          reasonStr.includes('maps.googleapis.com') ||
          reasonStr.includes('gm_authFailure')
        ) {
          handleGoogleMapsError();
        }
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    // Check for Google Maps API availability after a delay
    // Give it more time to load before checking
    const checkTimeout = setTimeout(() => {
      if (typeof window !== 'undefined' && !window.google?.maps && !googleMapsFailed) {
        console.log('Google Maps API not detected after delay, switching to Mapbox');
        handleGoogleMapsError();
      }
    }, 8000); // Check after 8 seconds - give Google Maps more time to load

    // Watch for Google Maps error messages in the DOM
    const observer = new MutationObserver((mutations) => {
      if (googleMapsFailed) return; // Already failed, no need to check
      
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const text = element.textContent || '';
            const innerHTML = element.innerHTML || '';
            
            if (
              text.includes("didn't load Google Maps correctly") || 
              text.includes('Google Maps JavaScript API error') ||
              text.includes('gm_authFailure') ||
              text.includes('Oops! Something went wrong') ||
              innerHTML.includes("didn't load Google Maps correctly")
            ) {
              console.log('Detected Google Maps error message in DOM, switching to Mapbox');
              handleGoogleMapsError();
              observer.disconnect();
              return;
            }
          }
        }
      }
    });

    // Start observing the document for changes
    if (typeof document !== 'undefined') {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    return () => {
      window.onerror = originalError;
      window.removeEventListener('unhandledrejection', handleRejection);
      clearTimeout(checkTimeout);
      observer.disconnect();
    };
  }, [googleMapsFailed]);

  if (useGoogleMaps === null) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing map...</p>
        </div>
      </div>
    );
  }

  // Don't render map if not active
  if (!isActive) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Map is not active</p>
      </div>
    );
  }

  // PRIMARY: Try Google Maps first (with Street View support)
  // Only use Mapbox if Google Maps has explicitly failed
  if (useGoogleMaps && !googleMapsFailed) {
    return (
      <GoogleMapsViewEnhanced
        key={`google-${mapKey}`}
        isActive={isActive}
        listings={listings}
        loading={loading}
        onError={handleGoogleMapsError}
        onStreetViewListingClick={onStreetViewListingClick}
      />
    );
  }

  // FALLBACK: Use Mapbox only when Google Maps has failed
  if (!useGoogleMaps || googleMapsFailed) {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
  return (
    <MapboxViewFallback
      key={`mapbox-${mapKey}`}
      isActive={isActive}
      listings={listings}
      loading={loading}
    />
      );
    } else {
      // No Mapbox token - show error message
      return (
        <div className="flex items-center justify-center h-96 bg-yellow-50 rounded-lg">
          <div className="text-center">
            <div className="text-yellow-600 text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Map Unavailable</h3>
            <p className="text-yellow-600 mb-4">
              Google Maps failed to load and Mapbox is not configured.
            </p>
            <p className="text-sm text-yellow-500">
              Please check your Google Maps API key configuration.
            </p>
          </div>
        </div>
      );
    }
  }

  // Default fallback (shouldn't reach here)
  return (
    <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Initializing map...</p>
      </div>
    </div>
  );
};

export default MapView;

