// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Admin Client for performing updates
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Get Request Data (Early to check for token)
    const { targetUid, newRole, userToken } = await req.json()
    if (!targetUid || !newRole) throw new Error('Missing targetUid or newRole')

    // 2. Verify Caller
    let authHeader = req.headers.get('Authorization')
    let token = authHeader?.replace('Bearer ', '') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // GATEWAY BYPASS: If using Anon Key in header, check for userToken in body
    if (userToken) {
        token = userToken
        authHeader = `Bearer ${userToken}`
    }

    if (!token) throw new Error('Missing Authorization token')

    const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // Check Admin Role
    const { data: callerProfile, error: callerError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (callerError || !callerProfile || callerProfile.role !== 'admin') {
        throw new Error('Forbidden: Only admins can update roles')
    }

    console.log(`Updating role for ${targetUid} to ${newRole}`)

    // 3. Update Profiles Table
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUid)

    if (profileError) throw profileError

    // 4. Update Auth User Metadata (Optional but recommended for consistency)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetUid, {
        user_metadata: { role: newRole }
    })

    if (authError) {
        console.warn('Failed to update auth metadata:', authError)
        // Non-critical, but good to know
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Role updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 } // Return 200 to parse error on client
    )
  }
})
