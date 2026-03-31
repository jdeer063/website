
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://chhnfmdyswmvmkszkvih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaG5mbWR5c3dtdm1rc3prdmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE0MjcsImV4cCI6MjA4NTkxNzQyN30.SADbdriXLlmzi5j3PU3Uh7mZBUQ7-m-qeXpZXs3mlUo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanupBilling() {
    console.log('🔍 Auditing billing records for inconsistencies...');

    // 1. Find PAID bills with remaining BALANCE
    const { data: paidWithBalance, error: e1 } = await supabase
        .from('billing')
        .select('id, balance, customer_id')
        .eq('status', 'paid')
        .gt('balance', 0);

    if (e1) {
        console.error('Error fetching inconsistent PAID bills:', e1);
    } else if (paidWithBalance && paidWithBalance.length > 0) {
        console.log(`⚠️ Found ${paidWithBalance.length} bills marked PAID but having a balance > 0.`);
        console.table(paidWithBalance);

        const ids = paidWithBalance.map(b => b.id);
        console.log(`🛠️ Fixing: Setting balance to 0 for these ${ids.length} bills...`);
        
        const { error: updateError } = await supabase
            .from('billing')
            .update({ balance: 0, updated_at: new Date().toISOString() })
            .in('id', ids);

        if (updateError) console.error('❌ Update failed:', updateError);
        else console.log('✨ Fixed PAID status balances.');
    } else {
        console.log('✅ No PAID bills found with non-zero balances.');
    }

    // 2. Find UNPAID/OVERDUE bills with 0 BALANCE
    const { data: zeroBalanceUnpaid, error: e2 } = await supabase
        .from('billing')
        .select('id, status, balance')
        .in('status', ['unpaid', 'overdue'])
        .lte('balance', 0);

    if (e2) {
        console.error('Error fetching zero-balance unpaid bills:', e2);
    } else if (zeroBalanceUnpaid && zeroBalanceUnpaid.length > 0) {
        console.log(`⚠️ Found ${zeroBalanceUnpaid.length} bills with 0 balance but still marked UNPAID/OVERDUE.`);
        console.table(zeroBalanceUnpaid);

        const ids = zeroBalanceUnpaid.map(b => b.id);
        console.log(`🛠️ Fixing: Setting status to 'paid' for these ${ids.length} bills...`);

        const { error: updateError } = await supabase
            .from('billing')
            .update({ status: 'paid', payment_date: new Date().toISOString(), updated_at: new Date().toISOString() })
            .in('id', ids);

        if (updateError) console.error('❌ Update failed:', updateError);
        else console.log('✨ Fixed zero-balance statuses.');
    } else {
        console.log('✅ No zero-balance bills found with incorrect status.');
    }

    console.log('🏁 Cleanup complete.');
    process.exit(0);
}

cleanupBilling();
