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
    const { email, code, newPassword } = await req.json()

    if (!email || !code || !newPassword) {
      throw new Error('Missing email, code, or password')
    }

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

    // 1. Verify Code using the secure RPC (ensures server-side time check)
    const { data: isValid, error: verifyError } = await supabaseAdmin.rpc('verify_reset_code', {
      p_email: email,
      p_code: code
    })

    if (verifyError || !isValid) {
      throw new Error('Invalid or expired verification code')
    }

    // 3. Find User ID by Email (Robust search)
    let targetUser = null;
    let page = 1;
    const perPage = 1000; // Max allowed usually

    // Loop through users in case there are many (pagination fix)
    while (!targetUser) {
        const { data, error: lookupError } = await supabaseAdmin.auth.admin.listUsers({
            page: page,
            perPage: perPage
        });
        
        if (lookupError) throw lookupError;
        if (!data.users || data.users.length === 0) break;

        targetUser = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (targetUser) break;
        
        if (data.users.length < perPage) break;
        page++;
    }

    if (!targetUser) {
        console.error(`User search failed for: ${email}. Checked ${page} pages.`);
        throw new Error(`User account for ${email} not found in Supabase Auth. Please check the 'Authentication' tab in your dashboard.`);
    }

    console.log(`Found target user: ${targetUser.id} for email: ${email}`);

    // 4. Update Password in Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.id,
        { password: newPassword }
    );
    if (updateError) throw updateError;

    // 5. Clean up the reset code
    await supabaseAdmin
      .from('password_resets')
      .delete()
      .eq('email', email);

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
