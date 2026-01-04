/**
 * Device and User Agent Parsing Utilities
 * Extracts device type, browser, and OS from user agent strings
 * Following Mautic patterns for device analytics
 */

/**
 * Device type detection result
 */
export interface DeviceInfo {
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown'
  browser: string | null
  os: string | null
  browserVersion?: string
  osVersion?: string
}

/**
 * Parse user agent to extract device information
 * Following Mautic device detection patterns
 */
export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
  if (!userAgent) {
    return {
      deviceType: 'unknown',
      browser: null,
      os: null
    }
  }

  const ua = userAgent.toLowerCase()

  // Detect device type
  let deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown' = 'unknown'
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'tablet'
  } else if (/Mobile|Android|iP(hone|od)|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    deviceType = 'mobile'
  } else {
    deviceType = 'desktop'
  }

  // Detect browser
  let browser: string | null = null
  let browserVersion: string | undefined

  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome'
    const match = ua.match(/chrome\/([\d.]+)/)
    browserVersion = match ? match[1] : undefined
  } else if (ua.includes('firefox')) {
    browser = 'Firefox'
    const match = ua.match(/firefox\/([\d.]+)/)
    browserVersion = match ? match[1] : undefined
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari'
    const match = ua.match(/version\/([\d.]+)/)
    browserVersion = match ? match[1] : undefined
  } else if (ua.includes('edg')) {
    browser = 'Edge'
    const match = ua.match(/edg\/([\d.]+)/)
    browserVersion = match ? match[1] : undefined
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera'
    const match = ua.match(/(?:opera|opr)\/([\d.]+)/)
    browserVersion = match ? match[1] : undefined
  } else if (ua.includes('msie') || ua.includes('trident')) {
    browser = 'Internet Explorer'
  }

  // Detect OS
  let os: string | null = null
  let osVersion: string | undefined

  if (ua.includes('windows')) {
    os = 'Windows'
    if (ua.includes('windows nt 10')) {
      osVersion = '10'
    } else if (ua.includes('windows nt 6.3')) {
      osVersion = '8.1'
    } else if (ua.includes('windows nt 6.2')) {
      osVersion = '8'
    } else if (ua.includes('windows nt 6.1')) {
      osVersion = '7'
    }
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    os = 'macOS'
    const match = ua.match(/mac os x ([\d_]+)/)
    if (match) {
      osVersion = match[1].replace(/_/g, '.')
    }
  } else if (ua.includes('linux')) {
    os = 'Linux'
  } else if (ua.includes('android')) {
    os = 'Android'
    const match = ua.match(/android ([\d.]+)/)
    osVersion = match ? match[1] : undefined
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS'
    const match = ua.match(/os ([\d_]+)/)
    if (match) {
      osVersion = match[1].replace(/_/g, '.')
    }
  }

  return {
    deviceType,
    browser,
    os,
    browserVersion,
    osVersion
  }
}

/**
 * Get location data from IP address (placeholder for future geolocation service)
 * In production, integrate with a geolocation service like MaxMind GeoIP2
 */
export interface LocationData {
  country?: string
  city?: string
  timezone?: string
  latitude?: number
  longitude?: number
}

/**
 * Parse location from IP (placeholder - implement with actual geolocation service)
 */
export async function getLocationFromIp(ipAddress: string | null | undefined): Promise<LocationData | null> {
  if (!ipAddress) {
    return null
  }

  // TODO: Integrate with geolocation service
  // For now, return null - this should be implemented with:
  // - MaxMind GeoIP2
  // - ipapi.co
  // - ip-api.com
  // - Or similar service

  return null
}


