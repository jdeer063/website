// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Get request body
    const body = await req.json()
    const { username, password, userToken } = body
    
    if (!username || !password) throw new Error('Username and password are required')

    // 1. Verify Caller (Admin only)
    let authHeader = req.headers.get('Authorization')
    if (userToken) {
      authHeader = `Bearer ${userToken}`
    }

    if (!authHeader) throw new Error('No Authorization token found')

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser()
    if (callerError || !caller) throw new Error('Unauthorized')

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      throw new Error('Forbidden: Only admins can provision accounts')
    }

    // 2. Find the staff member
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('*')
      .eq('username', username)
      .single()

    if (staffError || !staff) throw new Error(`Staff member with username "${username}" not found`)
    if (staff.auth_uid) return new Response(
      JSON.stringify({ success: true, message: 'User already has an auth account', uid: staff.auth_uid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

    // 3. Create Auth User
    // Pattern: username@gmail.com
    const email = `${username.toLowerCase()}@gmail.com`
    
    // Check if auth user already exists by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    let authUid = users.find(u => u.email === email)?.id

    if (!authUid) {
      const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { 
          role: staff.role,
          first_name: staff.first_name,
          last_name: staff.last_name,
          full_name: `${staff.first_name} ${staff.last_name}`
        }
      })
      if (createAuthError) throw createAuthError
      authUid = authData.user.id
    }

    // 4. Update Profile
    await supabaseAdmin.from('profiles').upsert({
      id: authUid,
      role: staff.role,
      first_name: staff.first_name,
      last_name: staff.last_name
    })

    // 5. Link Staff
    const { error: linkError } = await supabaseAdmin
      .from('staff')
      .update({ auth_uid: authUid })
      .eq('id', staff.id)

    if (linkError) throw linkError

    return new Response(
      JSON.stringify({ success: true, message: 'Account provisioned successfully', uid: authUid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Provision Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
