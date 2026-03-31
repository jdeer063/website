
const SUPABASE_URL = 'https://chhnfmdyswmvmkszkvih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaG5mbWR5c3dtdm1rc3prdmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE0MjcsImV4cCI6MjA4NTkxNzQyN30.SADbdriXLlmzi5j3PU3Uh7mZBUQ7-m-qeXpZXs3mlUo';

async function checkStaff() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/staff?select=id,username,role,status`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log('--- STAFF TABLE CONTENTS ---');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

checkStaff();
