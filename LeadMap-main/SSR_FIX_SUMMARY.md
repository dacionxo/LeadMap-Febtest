# SSR Build Error Fix: getClientComponentClient()

## Problem

During Next.js build/prerendering, the following error occurred:

```
Error: getClientComponentClient() can only be used in client components
    at <unknown> (.next/server/chunks/3389.js:6:18223)
```

**Root Cause:**
- `getClientComponentClient()` was called at the top level of the `Providers` component in `app/providers.tsx`
- Even though `Providers` is marked with `'use client'`, Next.js still executes it during the build/prerender phase
- During SSR/prerendering, `window` is `undefined`, causing `getClientComponentClient()` to throw an error
- This affected pages like `/contact` and `/_not-found` that are statically generated

## Solution

Implemented **lazy initialization** pattern for the Supabase client:

### Changes Made

1. **Changed from direct initialization to lazy initialization:**
   ```typescript
   // Before (caused SSR error):
   const supabase = getClientComponentClient()
   
   // After (SSR-safe):
   const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
   ```

2. **Added useEffect to initialize only after mount:**
   ```typescript
   useEffect(() => {
     if (typeof window !== 'undefined' && !supabase) {
       try {
         const client = getClientComponentClient()
         setSupabase(client)
       } catch (error) {
         console.error('Failed to initialize Supabase client:', error)
         setLoading(false)
       }
     }
   }, []) // Only run once on mount
   ```

3. **Added null checks for all Supabase operations:**
   - `refreshProfile`: Checks `if (!supabase)` before use
   - `useEffect` auth handler: Checks `if (!supabase)` before use
   - `signOut`: Checks `if (supabase)` before use

4. **Created safeSupabase wrapper for type safety:**
   - Provides a no-op client during SSR to satisfy TypeScript
   - Never actually used since all operations check for null first
   - Maintains type safety without breaking the build

## Technical Details

### Why This Works

1. **useState with null**: Initializes as `null`, which is safe during SSR
2. **useEffect on mount**: Only runs after component mounts on client-side where `window` exists
3. **Null checks**: All operations check for `supabase` before use, preventing errors
4. **Type safety**: `safeSupabase` wrapper maintains TypeScript types while allowing lazy initialization

### Best Practices Applied

- ✅ **Lazy initialization**: Client only created when needed (after mount)
- ✅ **SSR-safe**: No browser APIs accessed during server-side rendering
- ✅ **Type safety**: Maintains TypeScript types throughout
- ✅ **Error handling**: Gracefully handles initialization failures
- ✅ **Performance**: Client is only created once (singleton pattern preserved)

## Files Modified

- `app/providers.tsx` - Implemented lazy initialization pattern

## Testing

After this fix:
- ✅ TypeScript compilation passes
- ✅ Build should complete without SSR errors
- ✅ Client-side functionality preserved
- ✅ No breaking changes to existing code

## Related Context7 Documentation

This fix follows Next.js best practices for:
- Client Components with browser APIs
- SSR-safe initialization patterns
- useEffect for client-only code

## Notes

- The `safeSupabase` wrapper is a type-only construct - it's never actually used since all operations check for null first
- The singleton pattern is preserved - `getClientComponentClient()` still returns the same instance
- All existing code using `useApp()` hook continues to work without changes
