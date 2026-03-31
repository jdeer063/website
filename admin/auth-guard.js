// Auth Guard for Protected Pages
(function () {
    // === SECURITY: Block browser back/forward navigation ===
    // Replace the current history entry so there's nothing to go "back" to
    history.replaceState(null, '', window.location.href);
    // Push a duplicate entry — back button will land here, triggering the popstate
    history.pushState(null, '', window.location.href);

    // Whenever back/forward is pressed, re-verify session and redirect if needed
    window.addEventListener('popstate', async () => {
        // Re-push so repeated back presses are also intercepted
        history.pushState(null, '', window.location.href);

        if (!window.supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.replace('../index.html');
        }
    });

    async function checkSession() {
        if (!window.supabase) {
            console.error('Supabase client not found');
            return;
        }

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                console.log('No active session. Redirecting to login...');
                window.location.replace('../index.html');
                return;
            }

            // Verify Role
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, first_name, last_name')
                .eq('id', session.user.id)
                .single();

            if (profileError || !profile || profile.role !== 'admin') {
                console.error('Unauthorized: Admin access required');

                if (profile && profile.role === 'cashier') {
                    window.location.replace('../cashier/collections.html');
                } else {
                    await supabase.auth.signOut({ scope: 'local' });
                    window.location.replace('../index.html');
                }
                return;
            }

            console.log('Admin session verified:', session.user.email);
            window.authUser = session.user;
            window.userProfile = profile;

            // Dispatch event to signal that auth is ready
            document.dispatchEvent(new CustomEvent('auth-ready', { 
                detail: { user: session.user, profile: profile } 
            }));
        } catch (err) {
            console.error('Auth verification failed:', err);
            window.location.replace('../index.html');
        }
    }

    // Listen for auth changes (e.g. logout from another tab)
    if (window.supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                window.location.replace('../index.html');
            }
        });
    }

    // Run check based on readyState
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkSession);
    } else {
        checkSession();
    }
})();
