# Vercel Deployment Guide - Google Maps API Key

## 🔑 Adding Google Maps API Key to Vercel

### Step-by-Step Instructions

#### 1. Access Your Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **LeadMap** project
3. Click on **Settings** in the top navigation

#### 2. Add Environment Variable

1. In the Settings menu, click **Environment Variables**
2. Click **Add New** button
3. Fill in the form:
   - **Name:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **Value:** `AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M`
   - **Environment:** Select all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

4. Click **Save**

#### 3. Redeploy Your Application

After adding the environment variable, you need to redeploy:

**Option A: Automatic Redeploy**
- Vercel will automatically detect the new environment variable
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment
- Or push a new commit to trigger automatic deployment

**Option B: Manual Redeploy**
1. Go to **Deployments** tab
2. Click the **⋯** (three dots) menu on your latest deployment
3. Select **Redeploy**
4. Confirm the redeploy

#### 4. Verify the Deployment

After redeployment:

1. Check the deployment logs for any errors
2. Visit your deployed site
3. Navigate to `/dashboard/map`
4. Verify the map loads correctly
5. Check browser console (F12) for any API key errors

## 🔒 Security Best Practices

### ⚠️ Important Security Notes

1. **API Key Restrictions**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services > Credentials**
   - Click on your API key
   - Under **Application restrictions**, select **HTTP referrers**
   - Add your Vercel domain(s):
     ```
     https://your-project.vercel.app/*
     https://your-custom-domain.com/*
     ```

2. **API Restrictions**
   - Under **API restrictions**, select **Restrict key**
   - Only enable:
     - ✅ Maps JavaScript API
     - ✅ Street View Static API
     - ✅ Geocoding API
     - ✅ Places API

3. **Never Commit API Keys**
   - ✅ Already using `.env.local` (not committed)
   - ✅ Using environment variables in Vercel
   - ❌ Never hardcode in source code
   - ❌ Never commit `.env` files

## 📋 Environment Variables Checklist

### Required for Google Maps

- [x] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Your Google Maps API key

### Optional (if using Mapbox fallback)

- [ ] `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - Mapbox token (optional)

## 🧪 Testing After Deployment

### 1. Test Map Loading
```
✅ Navigate to /dashboard/map
✅ Map should load with all property markers
✅ No console errors about API key
```

### 2. Test Street View
```
✅ Click a marker on the map
✅ Click "Street View" button
✅ Property modal should open with Street View
✅ Street View should load and be interactive
```

### 3. Test Search Functionality
```
✅ Use the search bar on the map
✅ Search for an address
✅ Map should navigate to the location
```

## 🐛 Troubleshooting

### Map Not Loading

**Symptoms:** Blank map, console errors about API key

**Solutions:**
1. Verify environment variable is set in Vercel
2. Check variable name is exactly `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Ensure it's enabled for the correct environment (Production/Preview)
4. Redeploy after adding the variable
5. Check browser console for specific error messages

### API Key Invalid Error

**Symptoms:** Console shows "This API key is not valid"

**Solutions:**
1. Verify API key is correct in Vercel
2. Check API key restrictions in Google Cloud Console
3. Ensure your Vercel domain is added to HTTP referrer restrictions
4. Verify required APIs are enabled in Google Cloud Console

### Street View Not Working

**Symptoms:** Street View button does nothing or shows error

**Solutions:**
1. Verify `streetView` library is loaded (check script URL)
2. Check Street View Static API is enabled
3. Verify API key has access to Street View Static API
4. Check browser console for specific errors

## 📊 Monitoring API Usage

### Check API Usage in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services > Dashboard**
3. View usage metrics for:
   - Maps JavaScript API
   - Street View Static API
   - Geocoding API
   - Places API

### Set Up Billing Alerts

1. Go to **Billing** in Google Cloud Console
2. Set up budget alerts
3. Configure notifications for API usage thresholds

## 🔄 Updating the API Key

If you need to update the API key:

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Find `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Click **Edit**
4. Update the value
5. Click **Save**
6. Redeploy your application

## 📝 Quick Reference

### Environment Variable Name
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

### Your API Key
```
AIzaSyCZ0i53LQCnvju3gZYXW5ZQe_IfgWBDM9M
```

### Vercel Settings Path
```
Project → Settings → Environment Variables
```

### Google Cloud Console Path
```
APIs & Services → Credentials → [Your API Key]
```

## ✅ Deployment Checklist

- [ ] API key added to Vercel environment variables
- [ ] Environment variable enabled for all environments
- [ ] Application redeployed
- [ ] Map loads correctly on deployed site
- [ ] Street View functionality works
- [ ] API key restrictions configured in Google Cloud Console
- [ ] Billing alerts set up (optional but recommended)

## 🎯 Next Steps

1. **Add the environment variable** in Vercel (see steps above)
2. **Redeploy** your application
3. **Test** the map functionality
4. **Configure API key restrictions** in Google Cloud Console
5. **Monitor** API usage

Your Google Maps integration should now work perfectly on Vercel! 🚀
