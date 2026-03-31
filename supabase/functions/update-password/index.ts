// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get request body early to check for token
    const body = await req.json()
    const { uid, newPassword, userToken } = body
    
    if (!uid) throw new Error('User UID is required')
    if (!newPassword) throw new Error('New password is required')

    // 1. Get the token from headers
    // 1. Get the token from headers
    let authHeader = req.headers.get('Authorization')
    let token = authHeader?.replace('Bearer ', '') ?? ''
    
    // 2. TOKEN SELECTION STRATEGY
    // Always prefer the token from the body if it exists (Body Bypass)
    if (userToken) {
      token = userToken
      authHeader = `Bearer ${userToken}`
    } else if (token === anonKey) {
      // Fallback: Check header for x-user-token
      const headerToken = req.headers.get('x-user-token')
      if (headerToken) {
         token = headerToken
         authHeader = `Bearer ${headerToken}`
      }
    }

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No Authorization token found',
          debug: { hasAuth: false }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Verify User Token
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Auth Verification Failed: ${userError?.message || 'Unknown error'}`,
          debug: { 
            hasUser: !!user,
            userError: userError?.message,
            headerPrefix: authHeader.substring(0, 15) + '...',
            tokenLength: token.length
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check Role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden: Admin access required',
          debug: { role: profile?.role, userId: user.id }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Validate password strength
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Update Password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(uid, {
      password: newPassword
    })

    if (updateError) throw updateError

    // Sync Staff Table - We no longer store plain-text passwords in the staff table
    // Removing the update({ password: newPassword }) call to avoid schema cache errors
    console.log('Password updated in Auth, skipping staff table plain-text sync.');

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
