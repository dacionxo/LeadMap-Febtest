# Chrome Extension Additional Reference Index

This document contains additional Chrome Extension development documentation covering build tools, error handling, version control, offline functionality, and update mechanisms. Use this alongside `CHROME_EXTENSION_REFERENCE.md` for comprehensive development guidance.

## Table of Contents

1. [Build Tools & Development Setup](#build-tools--development-setup)
2. [Error Handling & Logging](#error-handling--logging)
3. [Version Control & Change Management](#version-control--change-management)
4. [Offline Functionality](#offline-functionality)
5. [Update Mechanisms](#update-mechanisms)

---

## Build Tools & Development Setup

### Vite for Chrome Extensions

**Vite Plugin Web Extension**:
- Official Plugin: https://v2.vite-plugin-web-extension.aklinker1.io/
- Scaffold project: `npm create vite-plugin-web-extension`
- Features:
  - Automatic building from `manifest.json`
  - Hot Module Replacement (HMR)
  - TypeScript support out of the box

**Boilerplates**:
- **React + Vite + TypeScript**: Minimalist boilerplate with React, TypeScript, and Tailwind CSS
  - GitHub: https://github.com/JohnBra/vite-web-extension
- **Vue + Vite + TypeScript**: Starter template with Vue 3, TypeScript, and Vite
  - GitHub: https://github.com/elwin013/vitaly-extension

**CRXJS**:
- Vite-based plugin for browser extensions
- Hot module replacement for content scripts
- Simple configuration
- Website: https://ithy.com/article/create-browser-extension-frameworks-7k7wp7rp

### Webpack for Chrome Extensions

**Manual Setup**:
- Configure Webpack to bundle extension scripts and assets
- Separate configurations for development and production
- Handle background scripts, content scripts, and popup pages
- Example: https://rasikawarade.github.io/think-rethink-reinforce/chrome-extension/webpack/javascript/2022/01/30/chrome-webpack.html

**Boilerplates**:
- **React + Webpack**: Integrates React with Webpack
  - GitHub Gist: https://gist.github.com/ayastreb/8f094c7ea17eb36cb1e6b5b9db9042c0

### Rollup for Chrome Extensions

**Rollup Plugin Chrome Extension**:
- Uses `manifest.json` as input
- Bundles or copies every file listed in manifest
- Minimal configuration required
- Documentation: https://www.extend-chrome.dev/rollup-plugin

### Video Tutorials

- **Building a Chrome Extension in TypeScript and Vite**: 
  - YouTube: https://www.youtube.com/watch?v=GGi7Brsf7js
- **Build a Chrome Extension With React & Webpack**:
  - YouTube: https://www.youtube.com/watch?v=8OCEfOKzpAw

---

## Error Handling & Logging

### Comprehensive Error Handling

**Try-Catch Blocks**:
```typescript
try {
  // Extension logic here
  await chrome.storage.local.set({ key: 'value' });
} catch (error) {
  console.error('An error occurred:', error);
  // Handle error appropriately
}
```

**Check chrome.runtime.lastError**:
```typescript
chrome.someAPI(params, (result) => {
  if (chrome.runtime.lastError) {
    console.error('Error:', chrome.runtime.lastError.message);
    return;
  }
  // Proceed with result
  processResult(result);
});
```

**Async/Await Pattern**:
```typescript
async function safeChromeAPICall() {
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.someAPI(params, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
    return result;
  } catch (error) {
    console.error('API call failed:', error);
    return null;
  }
}
```

### Chrome Developer Tools for Debugging

**Inspect Background Scripts**:
1. Navigate to `chrome://extensions/`
2. Find your extension
3. Click "background page" link under "Inspect views"
4. Use DevTools to debug service worker

**Debug Content Scripts**:
1. Open target web page
2. Open Chrome DevTools
3. Set breakpoints in Sources panel
4. Use `console.log()` for monitoring
5. Select extension's content script from context menu

### Logging Best Practices

**Use Appropriate Log Levels**:
```typescript
// Informational messages
console.info('Extension initialized');

// Warnings
console.warn('Storage quota approaching limit');

// Errors
console.error('Failed to save data:', error);

// Debug (remove in production)
console.debug('Current state:', state);
```

**Structured Logging**:
```typescript
interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  context?: Record<string, any>;
}

function log(entry: LogEntry) {
  const logMessage = `[${entry.level.toUpperCase()}] ${new Date(entry.timestamp).toISOString()}: ${entry.message}`;
  
  switch (entry.level) {
    case 'error':
      console.error(logMessage, entry.context);
      break;
    case 'warn':
      console.warn(logMessage, entry.context);
      break;
    case 'debug':
      console.debug(logMessage, entry.context);
      break;
    default:
      console.info(logMessage, entry.context);
  }
}
```

### Privacy and Security in Logging

**Best Practices**:
- **Never log sensitive information**: PII, passwords, tokens, API keys
- **Implement log rotation**: Manage file sizes for large log volumes
- **Sanitize data**: Remove sensitive fields before logging
- **Use production logging levels**: Disable debug logs in production

**Example**:
```typescript
function sanitizeForLogging(data: any): any {
  const sensitiveFields = ['password', 'token', 'apiKey', 'ssn'];
  const sanitized = { ...data };
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

// Usage
log({
  level: 'info',
  message: 'User data saved',
  context: sanitizeForLogging(userData)
});
```

### Error Tracking Tools

**Error Tracker Extension**:
- Automatically detects and reports errors
- Provides detailed information and screenshots
- Chrome Web Store: https://chromewebstore.google.com/detail/error-tracker/hojfdodhmkccbjhkohehbbmglmhigdac

**Custom Error Tracking**:
```typescript
async function trackError(error: Error, context?: Record<string, any>) {
  try {
    // Send to error tracking service
    await fetch('https://your-error-tracking-service.com/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        context: sanitizeForLogging(context),
        timestamp: Date.now(),
        extensionVersion: chrome.runtime.getManifest().version
      })
    });
  } catch (trackingError) {
    console.error('Failed to track error:', trackingError);
  }
}
```

### Testing Error Scenarios

**Cross-Platform Testing**:
- Test across different operating systems
- Test across different Chrome versions
- Test across different screen resolutions
- Simulate network failures
- Test with limited permissions

**API Failure Simulation**:
- Use tools like API Interceptor to simulate failures
- Test error handling in complex user flows
- Verify graceful degradation

---

## Version Control & Change Management

### Git Workflow for Extensions

**Branching Strategy (Git Flow)**:
```
main/master          → Production-ready code
develop              → Integration branch
feature/*            → New features
bugfix/*             → Bug fixes
hotfix/*             → Urgent production fixes
release/*            → Release preparation
```

**Example Workflow**:
```bash
# Create feature branch
git checkout -b feature/new-feature develop

# Work on feature
git commit -m "Add new feature"

# Merge to develop
git checkout develop
git merge feature/new-feature

# Create release branch
git checkout -b release/1.2.0 develop

# Finalize release
git checkout main
git merge release/1.2.0
git tag -a v1.2.0 -m "Release version 1.2.0"
```

### Semantic Versioning

**Version Format**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

**Update manifest.json**:
```json
{
  "manifest_version": 3,
  "version": "1.2.0",
  "name": "My Extension"
}
```

**Version Management Script**:
```typescript
// scripts/version.ts
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function updateVersion(type: 'major' | 'minor' | 'patch') {
  const manifestPath = join(__dirname, '../manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  const [major, minor, patch] = manifest.version.split('.').map(Number);
  
  let newVersion: string;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  manifest.version = newVersion;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Version updated to ${newVersion}`);
}
```

### Continuous Integration and Deployment

**GitHub Actions Example**:
```yaml
name: Build and Deploy Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build extension
        run: npm run build
      
      - name: Package extension
        run: zip -r extension.zip dist/
      
      - name: Upload to Chrome Web Store
        uses: getoslash/chrome-webstore-cli@v1
        with:
          extension-id: ${{ secrets.EXTENSION_ID }}
          client-id: ${{ secrets.CLIENT_ID }}
          client-secret: ${{ secrets.CLIENT_SECRET }}
          refresh-token: ${{ secrets.REFRESH_TOKEN }}
          zip-file: extension.zip
```

**Automated Testing**:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "build": "webpack --mode production",
    "package": "zip -r extension.zip dist/"
  }
}
```

### Release Management

**Git Tags for Releases**:
```bash
# Create annotated tag
git tag -a v1.2.0 -m "Release version 1.2.0"

# Push tags
git push origin v1.2.0

# List tags
git tag -l

# Delete tag (if needed)
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0
```

**Release Checklist**:
- [ ] Update version in manifest.json
- [ ] Update CHANGELOG.md
- [ ] Run all tests
- [ ] Build extension
- [ ] Test extension in Chrome
- [ ] Create git tag
- [ ] Push to repository
- [ ] Upload to Chrome Web Store
- [ ] Monitor for issues

---

## Offline Functionality

### Service Worker Caching

**Cache Storage API**:
```typescript
const CACHE_NAME = 'my-extension-cache-v1';
const urlsToCache = [
  '/',
  '/popup.html',
  '/popup.js',
  '/styles.css',
  '/images/icon.png'
];

// Install event: Cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Fetch event: Serve cached resources when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then((response) => {
            // Cache successful responses
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, responseToCache));
            }
            return response;
          });
      })
      .catch(() => {
        // Return offline fallback if available
        return caches.match('/offline.html');
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});
```

### Cache Strategies

**Cache First Strategy**:
```typescript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

**Network First Strategy**:
```typescript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // Fallback to cache
  );
});
```

**Stale-While-Revalidate Strategy**:
```typescript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      });
    })
  );
});
```

### Offline Detection

**Check Online Status**:
```typescript
// Check if online
if (navigator.onLine) {
  // Online - use network
  fetchData();
} else {
  // Offline - use cache
  getCachedData();
}

// Listen for online/offline events
window.addEventListener('online', () => {
  console.log('Back online');
  syncData();
});

window.addEventListener('offline', () => {
  console.log('Gone offline');
  showOfflineMessage();
});
```

**Service Worker Online Detection**:
```typescript
// In service worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Check connectivity
async function checkConnectivity() {
  try {
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    return true;
  } catch {
    return false;
  }
}
```

### Offline Data Storage

**Using chrome.storage for Offline Data**:
```typescript
// Save data for offline use
async function saveOfflineData(key: string, data: any) {
  await chrome.storage.local.set({
    [`offline_${key}`]: {
      data,
      timestamp: Date.now()
    }
  });
}

// Retrieve offline data
async function getOfflineData(key: string) {
  const result = await chrome.storage.local.get([`offline_${key}`]);
  return result[`offline_${key}`]?.data || null;
}

// Sync when online
async function syncOfflineData() {
  if (!navigator.onLine) return;
  
  const allData = await chrome.storage.local.get(null);
  const offlineKeys = Object.keys(allData).filter(k => k.startsWith('offline_'));
  
  for (const key of offlineKeys) {
    const item = allData[key];
    try {
      await fetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify({ key, data: item.data })
      });
      // Remove from offline storage after successful sync
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
```

---

## Update Mechanisms

### Extension Update Lifecycle

**Automatic Updates**:
- Chrome checks for updates on startup
- Chrome checks approximately every 5 hours
- Updates install when extension is idle (service worker not running)
- If service worker is continuously active, update may be deferred until browser restart

**Understanding Update Behavior**:
```typescript
// Service worker should go idle for updates to install
// Avoid keeping service worker active unnecessarily
chrome.alarms.onAlarm.addListener((alarm) => {
  // Handle alarm and allow service worker to go idle
  handleAlarm(alarm);
  // Service worker will terminate after event handler completes
});
```

### chrome.runtime.onInstalled

**Event Details**:
```typescript
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  switch (details.reason) {
    case 'install':
      // First installation
      initializeExtension();
      break;
      
    case 'update':
      // Extension updated
      const previousVersion = details.previousVersion;
      handleUpdate(previousVersion);
      break;
      
    case 'chrome_update':
      // Chrome browser updated
      handleChromeUpdate();
      break;
      
    case 'shared_module_update':
      // Shared module updated
      const moduleId = details.id;
      handleSharedModuleUpdate(moduleId);
      break;
  }
});
```

**Migration Example**:
```typescript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    
    // Handle version-specific migrations
    if (compareVersions(previousVersion, '1.0.0') < 0) {
      await migrateFromV1ToV2();
    }
    
    if (compareVersions(previousVersion, '2.0.0') < 0) {
      await migrateFromV2ToV3();
    }
    
    // Show update notification
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Extension Updated',
      message: `Updated from ${previousVersion} to ${currentVersion}`
    });
  }
});

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
}
```

### chrome.runtime.onUpdateAvailable

**Listen for Available Updates**:
```typescript
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log('Update available:', details.version);
  
  // Option 1: Reload immediately (may interrupt user)
  // chrome.runtime.reload();
  
  // Option 2: Notify user and reload when ready
  notifyUserOfUpdate(details.version).then(() => {
    // Reload when user acknowledges or after delay
    setTimeout(() => {
      chrome.runtime.reload();
    }, 5000);
  });
});

async function notifyUserOfUpdate(version: string) {
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-48.png',
    title: 'Update Available',
    message: `Version ${version} is ready to install. Extension will reload in 5 seconds.`
  });
}
```

### Manual Update Check

**Request Update Check**:
```typescript
chrome.runtime.requestUpdateCheck((status, details) => {
  if (status === 'update_available') {
    console.log('Update available:', details.version);
    // Handle update available
  } else if (status === 'no_update') {
    console.log('No update available');
  } else if (status === 'throttled') {
    console.log('Update check throttled');
  }
});
```

**Periodic Update Check**:
```typescript
// Check for updates every hour
chrome.alarms.create('checkForUpdates', {
  periodInMinutes: 60
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkForUpdates') {
    chrome.runtime.requestUpdateCheck((status, details) => {
      if (status === 'update_available') {
        handleUpdateAvailable(details.version);
      }
    });
  }
});
```

### Version Management

**Get Current Version**:
```typescript
const manifest = chrome.runtime.getManifest();
const currentVersion = manifest.version;
console.log('Current version:', currentVersion);
```

**Compare Versions**:
```typescript
function isNewerVersion(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}

// Usage
if (isNewerVersion(newVersion, currentVersion)) {
  console.log('New version is available');
}
```

### Update Best Practices

1. **Handle Breaking Changes**: Use migration scripts for data structure changes
2. **Preserve User Data**: Migrate settings and stored data during updates
3. **Notify Users**: Inform users of significant updates
4. **Test Updates**: Test update process before publishing
5. **Version Compatibility**: Ensure backward compatibility when possible
6. **Rollback Plan**: Have a plan for rolling back problematic updates

**Migration Helper**:
```typescript
interface Migration {
  fromVersion: string;
  toVersion: string;
  migrate: () => Promise<void>;
}

const migrations: Migration[] = [
  {
    fromVersion: '1.0.0',
    toVersion: '2.0.0',
    migrate: async () => {
      // Migrate data from v1 to v2 format
      const oldData = await chrome.storage.local.get(['oldKey']);
      await chrome.storage.local.set({
        newKey: transformData(oldData.oldKey)
      });
      await chrome.storage.local.remove('oldKey');
    }
  }
];

async function runMigrations(fromVersion: string, toVersion: string) {
  const applicableMigrations = migrations.filter(
    m => compareVersions(m.fromVersion, fromVersion) >= 0 &&
         compareVersions(m.toVersion, toVersion) <= 0
  );
  
  for (const migration of applicableMigrations) {
    await migration.migrate();
  }
}
```

---

## Quick Reference Links

### Build Tools
- Vite Plugin Web Extension: https://v2.vite-plugin-web-extension.aklinker1.io/
- CRXJS: https://ithy.com/article/create-browser-extension-frameworks-7k7wp7rp
- Rollup Plugin: https://www.extend-chrome.dev/rollup-plugin

### Error Handling
- Chrome Runtime Errors: https://developer.chrome.com/docs/extensions/reference/api/runtime#property-lastError
- Debugging Techniques: https://reintech.io/blog/debugging-techniques-chrome-extension-development

### Version Control
- Semantic Versioning: https://semver.org/
- Chrome Web Store CLI: https://github.com/getoslash/chrome-webstore-cli

### Offline Functionality
- Service Workers: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
- Cache API: https://developer.mozilla.org/en-US/docs/Web/API/Cache

### Update Mechanisms
- Extension Update Lifecycle: https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle
- Runtime Events: https://developer.chrome.com/docs/extensions/reference/api/runtime#events

---

*Last Updated: 2024*
*This reference index complements CHROME_EXTENSION_REFERENCE.md with additional development topics.*
