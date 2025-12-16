# Manual Push Instructions

Since automated git commands aren't showing output, please run these commands manually in PowerShell:

## Step 1: Navigate to the repository
```powershell
cd "d:\Downloads\LeadMap-main\LeadMap-main"
```

## Step 2: Check status
```powershell
git status
```

## Step 3: Stage the files
```powershell
git add lib/supabase-singleton.ts
git add app/providers.tsx
git add lib/hooks/useSupabase.ts
```

Or stage all changes:
```powershell
git add -A
```

## Step 4: Commit the changes
```powershell
git commit -m "Fix Supabase rate limiting and next/headers import issues

- Fixed dynamic import for next/headers in supabase-singleton.ts to prevent client component errors
- Updated providers.tsx with improved rate limiting, exponential backoff, and circuit breaker
- Created useSupabase hook for shared client access
- All fixes for /auth/v1/token rate limiting endpoint"
```

## Step 5: Push to GitHub
```powershell
git push origin main
```

If you get an error about the branch, try:
```powershell
git push -u origin main
```

## Files that should be committed:
- `lib/supabase-singleton.ts` - Fixed dynamic import for next/headers
- `app/providers.tsx` - Rate limiting improvements
- `lib/hooks/useSupabase.ts` - New hook for shared client

## Alternative: Use the existing script
You can also run the existing push script:
```powershell
.\PUSH_TO_GITHUB.ps1
```


