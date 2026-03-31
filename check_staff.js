
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://chhnfmdyswmvmkszkvih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaG5mbWR5c3dtdm1rc3prdmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE0MjcsImV4cCI6MjA4NTkxNzQyN30.SADbdriXLlmzi5j3PU3Uh7mZBUQ7-m-qeXpZXs3mlUo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkStaff() {
    const { data, error } = await supabase
        .from('staff')
        .select('*');
    
    if (error) {
        console.error('Error fetching staff:', error);
        return;
    }
    
    console.log('Current Staff in Database:');
    console.table(data.map(s => ({
        id: s.id,
        username: s.username,
        password: s.password,
        role: s.role,
        status: s.status
    })));
}

checkStaff();
