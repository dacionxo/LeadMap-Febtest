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
}

const MapView: React.FC<MapViewProps> = ({ isActive, listings, loading }) => {
  const [useGoogleMaps, setUseGoogleMaps] = useState<boolean | null>(null);
  const [googleMapsFailed, setGoogleMapsFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Check if Google Maps API key is available
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M';
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZGFjaW9ueG8iLCJhIjoiY21pZTF1cjQ5MDgnMDJrb2w5azk4NDB5MSJ9._yXKxm3HwER9J5GCigVr8A';
    
    // Prefer Google Maps if API key is available, but only if it hasn't failed
    if (googleMapsApiKey && !googleMapsFailed) {
      setUseGoogleMaps(true);
    } else if (mapboxToken) {
      setUseGoogleMaps(false);
    } else {
      // Default to Google Maps with hardcoded key
      setUseGoogleMaps(true);
    }
  }, [googleMapsFailed]);

  // Handle Google Maps error and fallback to Mapbox
  const handleGoogleMapsError = () => {
    console.log('Google Maps failed to load, switching to Mapbox fallback');
    setGoogleMapsFailed(true);
    setUseGoogleMaps(false);
    
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZGFjaW9ueG8iLCJhIjoiY21pZTF1cjQ5MDgnMDJrb2w5azk4NDB5MSJ9._yXKxm3HwER9J5GCigVr8A';
    if (!mapboxToken) {
      console.error('Mapbox token also not available');
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
    const checkTimeout = setTimeout(() => {
      if (typeof window !== 'undefined' && !window.google?.maps && !googleMapsFailed) {
        console.log('Google Maps API not detected, switching to Mapbox');
        handleGoogleMapsError();
      }
    }, 5000); // Check after 5 seconds

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

  // Try Google Maps first (primary) - only if not failed
  if (useGoogleMaps && !googleMapsFailed) {
    return (
      <>
        <GoogleMapsViewEnhanced
          isActive={isActive}
          listings={listings}
          loading={loading}
          onError={handleGoogleMapsError}
        />
      </>
    );
  }

  // Fallback to Mapbox (automatically switches when Google Maps fails)
  return (
    <>
      {googleMapsFailed && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <span className="font-semibold">Note:</span> Using Mapbox as fallback (Google Maps unavailable)
        </div>
      )}
      <MapboxViewFallback
        isActive={isActive}
        listings={listings}
        loading={loading}
      />
    </>
  );
};

export default MapView;

