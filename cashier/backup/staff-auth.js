// Session-based authentication check for staff
// This replaces Supabase Auth check for cashier/reader pages

async function checkStaffAuth() {
    const staffUser = sessionStorage.getItem('staffUser');
    
    if (!staffUser) {
        // No staff session - redirect to login
        window.location.href = '../index.html';
        return null;
    }
    
    try {
        const user = JSON.parse(staffUser);
        
        // Verify the staff record still exists and is active
        const { data: staff, error } = await supabase
            .from('staff')
            .select('*')
            .eq('id', user.id)
            .eq('status', 'active')
            .single();
        
        if (error || !staff) {
            // Staff record not found or inactive - clear session and redirect
            sessionStorage.removeItem('staffUser');
            window.location.href = '../index.html';
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Auth check error:', error);
        sessionStorage.removeItem('staffUser');
        window.location.href = '../index.html';
        return null;
    }
}

// Logout function for staff
function staffLogout() {
    sessionStorage.removeItem('staffUser');
    window.location.href = '../index.html';
}
