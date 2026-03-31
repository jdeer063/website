
const SUPABASE_URL = 'https://chhnfmdyswmvmkszkvih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaG5mbWR5c3dtdm1rc3prdmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE0MjcsImV4cCI6MjA4NTkxNzQyN30.SADbdriXLlmzi5j3PU3Uh7mZBUQ7-m-qeXpZXs3mlUo';

async function fixNullStatuses() {
    console.log('🔍 [Diagnostic] Fetching customers with NULL status...');
    
    try {
        // PostgREST "is null" syntax is .is.null
        const searchUrl = `${SUPABASE_URL}/rest/v1/customers?status=is.null&select=id,first_name,last_name,status`;
        const response = await fetch(searchUrl, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        
        if (!data || data.length === 0) {
            console.log('✅ No customers found with NULL status.');
            return;
        }
        
        console.log(`⚠️ Found ${data.length} customers with NULL status:`);
        data.forEach(c => console.log(`- ${c.first_name} ${c.last_name} (ID: ${c.id})`));
        
        const idsToFix = data.map(c => c.id);
        console.log(`🛠️ Updating status to "active" for these ${idsToFix.length} customers...`);
        
        const updateUrl = `${SUPABASE_URL}/rest/v1/customers?id=in.(${idsToFix.join(',')})`;
        const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ status: 'active' })
        });
        
        if (updateResponse.ok) {
            console.log('✨ Successfully updated customers to "active" status.');
        } else {
            const error = await updateResponse.json();
            console.error('❌ Update failed:', error);
        }
    } catch (e) {
        console.error('❌ Script failed:', e);
    }
}

fixNullStatuses();
