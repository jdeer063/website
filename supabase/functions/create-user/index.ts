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
    console.log('=== Edge Function Called ===')
    console.log('Headers:', Object.fromEntries(req.headers.entries()))
    
    // Create Supabase Admin Client (uses service_role key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // SECURITY: Verify caller is an Admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Create a client with the user's token to verify they're authenticated
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: `Unauthorized: ${userError?.message || 'Invalid token'}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Check if user is an Admin using the admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: `Forbidden: Only admins can create users` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Get request body
    const { email, password, role, firstName, lastName, middleInitial, username, contact } = await req.json()
    
    // Validate inputs
    if (!email || !password || !role || !firstName || !lastName || !username || !contact) {
      throw new Error('Missing required fields (username and contact are now required)')
    }

    if (!['cashier', 'reader'].includes(role)) {
      throw new Error('Invalid role. Must be cashier or reader')
    }

    // Check for existing username in staff table to prevent partial failure
    const { data: existingStaff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingStaff) {
      throw new Error('Username already exists')
    }

    // 1. Check if Auth User already exists (Check First Pattern)
    // This avoids relying on brittle error message parsing
    let authUid = '';
    
    // Search for existing user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    
    if (listError) {
        console.error('List users error:', listError);
        throw listError; // Fail if we can't check
    }

    const existingUser = users.find(u => u.email?.toLowerCase().trim() === email.toLowerCase().trim());

    if (existingUser) {
        console.log(`User ${email} already exists. Using existing ID: ${existingUser.id}`);
        authUid = existingUser.id;
    } else {
        // User doesn't exist, create new one
        console.log(`Creating new user for ${email}...`);
        const { data: authData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { 
                role: role,
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`
            }
        });

        if (createUserError) {
            console.error('Create user error:', createUserError);
            throw createUserError;
        }
        
        authUid = authData.user.id;
    }

    // 2. Create/Update Profile (Upsert to handle existing)
    const { error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUid,
        role: role,
        first_name: firstName,
        last_name: lastName
      })

    if (createProfileError) {
      throw createProfileError
    }

    // 3. Create Staff Entry (Upsert to handle existing/ghost)
    const { error: createStaffError } = await supabaseAdmin
      .from('staff')
      .upsert({
        auth_uid: authUid,
        first_name: firstName,
        last_name: lastName,
        middle_initial: middleInitial || null,
        role: role,
        username: username, // This updates the username if it changed
        contact_number: contact,
        status: 'active'
      }, { onConflict: 'auth_uid' }) 

    if (createStaffError) {
       throw createStaffError
    }

    console.log('User synced successfully:', authUid)

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authUid,
          email: email,
          role: role,
          name: `${firstName} ${lastName}`
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 so client can parse the error message
      }
    )
  }
})
