
const SUPABASE_URL = 'https://chhnfmdyswmvmkszkvih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaG5mbWR5c3dtdm1rc3prdmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE0MjcsImV4cCI6MjA4NTkxNzQyN30.SADbdriXLlmzi5j3PU3Uh7mZBUQ7-m-qeXpZXs3mlUo';

async function restoreStaff() {
    try {
        console.log('Restoring default staff accounts...');
        
        const staffAccounts = [
            { last_name: 'User', first_name: 'Cashier', username: 'cashier', password: 'xyuuki18', role: 'cashier', contact_number: '09123456789', status: 'active' },
            { last_name: 'System', first_name: 'Admin', username: 'admin', password: 'admin123', role: 'cashier', contact_number: '09170000000', status: 'active' },
            { last_name: 'Reader', first_name: 'One', username: 'reader1', password: 'reader123', role: 'reader', contact_number: '09171111111', status: 'active' }
        ];

        for (const staff of staffAccounts) {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/staff`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(staff)
            });
            
            if (response.ok) {
                console.log(`✅ Restored: ${staff.username}`);
            } else {
                const err = await response.text();
                console.log(`❌ Failed to restore ${staff.username}: ${err}`);
            }
        }
        
        console.log('Restoration complete.');
    } catch (e) {
        console.error('Restoration failed:', e);
    }
}

restoreStaff();
