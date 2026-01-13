# Google Maps & Street View Setup Guide

This guide ensures your LeadMap application properly integrates Google Maps API and Street View functionality.

## ✅ Implementation Status

### Completed Features
- ✅ Google Maps JavaScript API integration
- ✅ Street View library loading
- ✅ Interactive Street View panorama in property modals
- ✅ Street View controls on map (Pegman)
- ✅ Street View button in map markers
- ✅ Error handling and fallbacks
- ✅ Map page integration with Street View callbacks

## 📋 Prerequisites

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing (required for Google Maps APIs)

### 2. Enable Required APIs

Enable the following APIs in **APIs & Services > Library**:

- ✅ **Maps JavaScript API** (Required)
- ✅ **Street View Static API** (Required for Street View)
- ✅ **Geocoding API** (Required for address geocoding)
- ✅ **Places API** (Required for search functionality)

### 3. Create API Key

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy your API key

### 4. Configure API Key Restrictions (Recommended)

For security, restrict your API key:

**Application Restrictions:**
- Select **HTTP referrers (web sites)**
- Add your domain(s):
  - `http://localhost:3000/*` (for development)
  - `https://yourdomain.com/*` (for production)

**API Restrictions:**
- Select **Restrict key**
- Check only:
  - ✅ Maps JavaScript API
  - ✅ Street View Static API
  - ✅ Geocoding API
  - ✅ Places API

## 🔧 Environment Configuration

### Add API Key to `.env.local`

Create or update `.env.local` in your project root:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

**Important:** 
- The key must start with `NEXT_PUBLIC_` to be accessible in the browser
- Never commit `.env.local` to version control
- Restart your development server after adding the key

## 🗺️ Map Features

### Main Map Component (`/dashboard/map`)

The map page includes:
- **Interactive Google Map** with all listings as markers
- **Street View Pegman Control** - drag to enter Street View
- **Street View Button** in marker info windows
- **Property Detail Modal** with full Street View panorama

### Street View Integration Points

1. **Map Markers**: Click any marker → Click "Street View" button → Opens property modal with Street View
2. **Pegman Control**: Drag the orange Pegman icon onto the map to enter Street View mode
3. **Property Modals**: Full interactive Street View panorama with controls

## 🛠️ Technical Implementation

### Google Maps Script Loading

The Google Maps API is loaded in `components/GoogleMapsScript.tsx`:

```typescript
src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places,geometry,streetView&loading=async`}
```

**Libraries loaded:**
- `places` - For address search and autocomplete
- `geometry` - For geocoding and distance calculations
- `streetView` - For Street View functionality

### Map Initialization

Street View controls are enabled in `components/GoogleMapsViewEnhanced.tsx`:

```typescript
const mapInstance = new window.google.maps.Map(mapRef.current, {
  streetViewControl: true, // Enable Street View Pegman control
  // ... other options
});
```

### Street View Panorama Component

The interactive Street View component is in `app/dashboard/prospect-enrich/components/LeadDetailModal.tsx`:

- Automatically geocodes addresses if coordinates are missing
- Handles API loading states
- Provides error messages and fallbacks
- Full 360° navigation with controls

## 🧪 Testing

### Test Checklist

1. **Map Loading**
   - [ ] Map displays with all property markers
   - [ ] Street View Pegman control is visible
   - [ ] No console errors

2. **Street View from Map**
   - [ ] Click a marker → Info window appears
   - [ ] Click "Street View" button → Property modal opens
   - [ ] Street View panorama loads in modal

3. **Street View Pegman**
   - [ ] Drag Pegman onto map → Street View activates
   - [ ] Can navigate in Street View
   - [ ] Can exit Street View

4. **Error Handling**
   - [ ] Missing coordinates → Geocoding works
   - [ ] No Street View available → Error message shown
   - [ ] API key invalid → Appropriate error displayed

## 🐛 Troubleshooting

### Map Not Loading

**Symptoms:** Blank map area, console errors

**Solutions:**
1. Verify API key is set in `.env.local`
2. Check API key restrictions allow your domain
3. Ensure Maps JavaScript API is enabled
4. Check browser console for specific error messages
5. Verify API key has billing enabled

### Street View Not Working

**Symptoms:** Street View button does nothing, panorama doesn't load

**Solutions:**
1. Verify `streetView` library is loaded (check script URL)
2. Check Street View Static API is enabled
3. Verify coordinates are available for the property
4. Check browser console for errors
5. Test with a known location (e.g., Times Square, NYC)

### Geocoding Failures

**Symptoms:** Properties without coordinates don't appear on map

**Solutions:**
1. Verify Geocoding API is enabled
2. Check API key has Geocoding API access
3. Verify address format is correct
4. Check API quota limits

## 📊 API Usage & Quotas

### Free Tier Limits (per month)

- **Maps JavaScript API**: 28,000 map loads
- **Street View Static API**: 28,000 requests
- **Geocoding API**: 40,000 requests
- **Places API**: Varies by endpoint

### Monitoring Usage

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services > Dashboard**
3. View usage metrics for each API

## 🔒 Security Best Practices

1. **Restrict API Keys**: Always use HTTP referrer restrictions
2. **Rotate Keys**: Regularly rotate API keys
3. **Monitor Usage**: Set up billing alerts
4. **Never Expose**: Don't commit API keys to version control
5. **Use Environment Variables**: Always use `.env.local` for keys

## 📚 Additional Resources

- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [Street View Static API Documentation](https://developers.google.com/maps/documentation/streetview)
- [Geocoding API Documentation](https://developers.google.com/maps/documentation/geocoding)
- [Places API Documentation](https://developers.google.com/maps/documentation/places)

## 🎯 Quick Start Checklist

- [ ] Create Google Cloud project
- [ ] Enable required APIs (Maps JS, Street View, Geocoding, Places)
- [ ] Create and restrict API key
- [ ] Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to `.env.local`
- [ ] Restart development server
- [ ] Test map loading
- [ ] Test Street View functionality
- [ ] Verify error handling works

## ✅ Verification

After setup, verify everything works:

1. Navigate to `/dashboard/map`
2. Map should load with property markers
3. Click a marker → Click "Street View" button
4. Property modal should open with interactive Street View
5. Drag Pegman onto map → Street View should activate

If all steps work, your Google Maps and Street View integration is complete! 🎉
