// Auth Guard for Protected Pages
(async function() {
    // Wait for Supabase to be initialized if needed
    // But since it's loaded before this in dashboard.html, it should be fine
    
    function checkSession() {
        if (!window.supabase) {
            console.error('Supabase client not found');
            return;
        }

        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) {
                console.log('No active session. Redirecting to login...');
                window.location.href = '../index.html';
                return;
            }

            // Verify Role
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (error || !profile || profile.role !== 'admin') {
                    console.error('Unauthorized: Admin access required');
                    
                    // If they are a cashier, send them to the appropriate place
                    if (profile && profile.role === 'cashier') {
                        window.location.href = '../cashier/collections.html';
                    } else {
                        await supabase.auth.signOut();
                        window.location.href = '../index.html';
                    }
                    return;
                }

                console.log('Admin session verified:', session.user.email);
                window.authUser = session.user;
            } catch (err) {
                console.error('Auth verification failed:', err);
                window.location.href = '../index.html';
            }
        });

        // Also listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                window.location.href = '../index.html';
            }
        });
    }

    // Run check
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkSession);
    } else {
        checkSession();
    }
})();
