import { NextRequest, NextResponse } from 'next/server'
import { getRouteHandlerClient, getServiceRoleClient } from '@/lib/supabase-singleton'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      )
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key') {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { 
          error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your .env.local file.',
          details: 'Get the service_role key from Supabase Dashboard > Settings > API'
        },
        { status: 500 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not configured')
      return NextResponse.json(
        { 
          error: 'Server configuration error: NEXT_PUBLIC_SUPABASE_URL is not set'
        },
        { status: 500 }
      )
    }

    // Use service role key to bypass RLS (singleton, no auto-refresh)
    const supabaseAdmin = getServiceRoleClient()

    // Verify the user exists in auth.users (optional check, won't block profile creation)
    // Note: If email confirmation is required, the user might not be fully authenticated
    // immediately after signup. We'll still create the profile using the service role.
    try {
      const supabase = await getRouteHandlerClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      // Log auth status for debugging (but don't block if user exists in auth.users)
      if (authError) {
        console.warn('Auth check warning (non-blocking):', authError.message)
      }

      // Verify userId matches if user is authenticated, but don't block if not authenticated
      // (email confirmation might be pending)
      if (user && user.id !== userId) {
        console.warn('User ID mismatch warning (non-blocking):', { 
          authenticatedUserId: user.id, 
          requestedUserId: userId 
        })
      }
    } catch (cookieError: any) {
      // Cookies might not be available immediately after signup - this is OK
      // We'll proceed with profile creation using the service role key
      console.warn('Cookie check failed (non-blocking, proceeding anyway):', cookieError.message)
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:66',message:'Starting user profile creation',data:{userId,email,name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Check if profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:73',message:'Profile existence check result',data:{exists:!!existingProfile,userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (existingProfile) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:77',message:'Profile already exists, checking workspace',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Check if workspace exists for this user
      let workspaceCheck: any = null;
      try {
        const workspaceResult = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('created_by', userId)
          .is('deleted_at', null)
          .maybeSingle();
        
        workspaceCheck = { exists: !!workspaceResult?.data, workspaceId: workspaceResult?.data?.id };
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:85',message:'Workspace check for existing user',data:{userId,workspaceCheck},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } catch (workspaceError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:90',message:'Workspace check error',data:{userId,error:workspaceError?.message,code:workspaceError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }

      return NextResponse.json(
        { message: 'Profile already exists', profile: existingProfile },
        { status: 200 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:95',message:'Creating user profile',data:{userId,email,name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Create user profile with trial
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 7)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        name: name || email.split('@')[0] || 'User',
        role: 'user',
        trial_end: trialEnd.toISOString(),
        is_subscribed: false,
        plan_tier: 'free'
      })
      .select()
      .single()

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:112',message:'User profile creation result',data:{success:!profileError,userId,error:profileError?.message,code:profileError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      
      // Check if it's a duplicate key error (profile might have been created by trigger)
      if (profileError.code === '23505' || profileError.message?.includes('duplicate key')) {
        // Profile already exists (possibly created by trigger), fetch and return it
        const { data: existingProfile } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (existingProfile) {
          return NextResponse.json(
            { message: 'Profile already exists (created by trigger)', profile: existingProfile },
            { status: 200 }
          )
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create user profile', 
          details: profileError.message,
          code: profileError.code,
          hint: profileError.hint
        },
        { status: 500 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:129',message:'Profile created, checking workspace tables exist',data:{userId,profileId:profile?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Check if workspace tables exist and create workspace
    let workspaceResult: any = null;
    try {
      // Try to check if workspaces table exists by querying it
      const tableCheck = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .limit(0);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:139',message:'Workspaces table check',data:{tableExists:!tableCheck.error,error:tableCheck.error?.message,code:tableCheck.error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (!tableCheck.error) {
        // Table exists, try to create workspace
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:145',message:'Attempting workspace creation',data:{userId,email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        // Check if workspace creation function exists
        const { data: funcResult, error: funcError } = await supabaseAdmin.rpc('create_default_workspace_for_user', {
          user_uuid: userId,
          user_email: email
        });

        if (funcError) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:154',message:'Workspace creation function error',data:{userId,error:funcError?.message,code:funcError?.code,hint:funcError?.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        } else {
          workspaceResult = { workspaceId: funcResult, method: 'rpc' };
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:160',message:'Workspace created via RPC',data:{userId,workspaceId:funcResult},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
      }
    } catch (workspaceError: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:166',message:'Workspace creation exception',data:{userId,error:workspaceError?.message,stack:workspaceError?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a28eaef7-b432-4f60-bfa9-03b3317e2aa6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/users/create-profile/route.ts:171',message:'User creation flow complete',data:{userId,profileCreated:!!profile,workspaceCreated:!!workspaceResult?.workspaceId,workspaceId:workspaceResult?.workspaceId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    return NextResponse.json(
      { message: 'Profile created successfully', profile, workspace: workspaceResult || null },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Create profile error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    })
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to create account'
    let errorDetails = error.message || 'An unexpected error occurred. Please try again.'
    
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      errorMessage = 'Invalid request data'
      errorDetails = 'The request data is invalid. Please check your input and try again.'
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error'
      errorDetails = 'Unable to connect to the server. Please check your connection and try again.'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: errorDetails,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    )
  }
}

