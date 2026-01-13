'use client'

import Script from 'next/script'
import { useEffect } from 'react'

export default function GoogleMapsScript() {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Add resource hints for faster loading
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Preconnect to Google Maps domains for faster loading
    const preconnect = document.createElement('link')
    preconnect.rel = 'preconnect'
    preconnect.href = 'https://maps.googleapis.com'
    preconnect.crossOrigin = 'anonymous'
    document.head.appendChild(preconnect)

    const preconnect2 = document.createElement('link')
    preconnect2.rel = 'preconnect'
    preconnect2.href = 'https://maps.gstatic.com'
    preconnect2.crossOrigin = 'anonymous'
    document.head.appendChild(preconnect2)

    // DNS prefetch for additional performance
    const dnsPrefetch = document.createElement('link')
    dnsPrefetch.rel = 'dns-prefetch'
    dnsPrefetch.href = 'https://maps.googleapis.com'
    document.head.appendChild(dnsPrefetch)

    const dnsPrefetch2 = document.createElement('link')
    dnsPrefetch2.rel = 'dns-prefetch'
    dnsPrefetch2.href = 'https://maps.gstatic.com'
    document.head.appendChild(dnsPrefetch2)

    return () => {
      // Cleanup on unmount (though these are safe to leave)
      document.head.removeChild(preconnect)
      document.head.removeChild(preconnect2)
      document.head.removeChild(dnsPrefetch)
      document.head.removeChild(dnsPrefetch2)
    }
  }, [])

  if (!googleMapsApiKey) {
    console.error(
      'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing – Google Maps script will not be loaded.'
    )
    return null
  }

  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geometry,streetView&loading=async`}
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined') {
          ;(window as any).initMap =
            (window as any).initMap ||
            (() => {
              console.log('Google Maps API loaded successfully with Street View support')
            })
        }
      }}
      onError={(e) => {
        console.error('Failed to load Google Maps API:', e)
      }}
    />
  )
}

