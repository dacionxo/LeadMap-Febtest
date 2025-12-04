'use client'

import Script from 'next/script'

export default function GoogleMapsScript() {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!googleMapsApiKey) {
    console.error(
      'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing – Google Maps script will not be loaded.'
    )
    return null
  }

  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geometry&loading=async`}
      strategy="lazyOnload"
      onLoad={() => {
        if (typeof window !== 'undefined') {
          ;(window as any).initMap =
            (window as any).initMap ||
            (() => {
              console.log('Google Maps API loaded successfully')
            })
        }
      }}
      onError={(e) => {
        console.error('Failed to load Google Maps API:', e)
      }}
    />
  )
}

