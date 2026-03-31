// Secure Cashier Authentication (Supabase Auth)
// Replaces insecure sessionStorage

async function checkStaffAuth() {
    try {
        // 1. Get Supabase Session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            console.warn('No active session found. Redirecting...');
            window.location.href = '../index.html';
            return null;
        }

        const user = session.user;

        // 2. Strict Role Verification against DB (Bypassing Session Metadata)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, first_name, last_name')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error('Profile verification failed:', profileError);
            await supabase.auth.signOut();
            window.location.href = '../index.html?error=profile_not_found';
            return null;
        }

        // 3. Enforce 'cashier' Role
        // ALLOW 'admin' for debugging/super-user access, strictly DENY 'reader'
        if (profile.role !== 'cashier') { // Check if not a cashier
            console.error(`Security Alert: User ${user.email} (Role: ${profile.role}) attempted to access Cashier Panel.`);
            
            // If they are an admin, redirect them to the admin dashboard
            if (profile.role === 'admin') {
                window.location.href = '../admin/dashboard.html';
            } else { // If not cashier and not admin (e.g., 'reader' or other unauthorized role)
                alert(`Access Denied. You are logged in as '${profile.role.toUpperCase()}', but this area is for CASHIERS only.`);
                // Force Logout to prevent session reuse
                await supabase.auth.signOut();
                window.location.href = '../index.html';
            }
            return null; // Always return null if access is denied or redirected
        }

        // Success! Reveal the UI
        document.body.classList.add('auth-verified');
        return profile;

    } catch (err) {
        console.error('Auth Check Critical Failure:', err);
        await supabase.auth.signOut();
        window.location.href = '../index.html';
        return null;
    }
}

// Global Logout
async function staffLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout failed:', error);
    window.location.href = '../index.html';
}

// Expose to window
window.checkStaffAuth = checkStaffAuth;
window.staffLogout = staffLogout;

// Auto-run on load
document.addEventListener('DOMContentLoaded', () => {
    checkStaffAuth();
});
