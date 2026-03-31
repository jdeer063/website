// Auth Guard for Protected Cashier Pages
(async function() {
    function checkSession() {
        if (!window.supabase) {
            console.error('Supabase client not found');
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            // Check for Staff Session in sessionStorage if Supabase session is missing
            const staffUser = JSON.parse(sessionStorage.getItem('staffUser'));

            if (!session && !staffUser) {
                console.log('No active session. Redirecting to login...');
                window.location.href = '../index.html';
                return;
            }

            // Expose user to the window
            if (session) {
                window.authUser = session.user;
                console.log('Cashier Session active (Auth):', session.user.email);
            } else if (staffUser) {
                window.staffUser = staffUser;
                console.log('Cashier Session active (Staff):', staffUser.username);
            }
        });

        // Also listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            const staffUser = JSON.parse(sessionStorage.getItem('staffUser'));
            if (event === 'SIGNED_OUT' || (!session && !staffUser)) {
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
