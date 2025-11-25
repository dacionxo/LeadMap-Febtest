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
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Google Maps API key is available
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M';
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    // Prefer Google Maps if API key is available
    if (googleMapsApiKey) {
      setUseGoogleMaps(true);
    } else if (mapboxToken) {
      setUseGoogleMaps(false);
    } else {
      // Default to Google Maps with hardcoded key
      setUseGoogleMaps(true);
    }
  }, []);

  // Handle Google Maps error and fallback to Mapbox
  const handleGoogleMapsError = () => {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      setUseGoogleMaps(false);
      setMapError('Switched to Mapbox as fallback');
    } else {
      setMapError('Both Google Maps and Mapbox are unavailable. Please configure API keys.');
    }
  };

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

  // Try Google Maps first (primary)
  if (useGoogleMaps) {
    try {
      return (
        <>
          {mapError && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              {mapError}
            </div>
          )}
          <GoogleMapsViewEnhanced
            isActive={isActive}
            listings={listings}
            loading={loading}
          />
        </>
      );
    } catch (error) {
      console.error('Google Maps error, falling back to Mapbox:', error);
      handleGoogleMapsError();
    }
  }

  // Fallback to Mapbox
  return (
    <>
      {mapError && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Using Mapbox as fallback
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

