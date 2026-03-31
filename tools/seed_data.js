
// Mockup Data Generation using Vanilla Fetch + Admin Login for RLS Bypass
const SUPABASE_URL = 'https://chhnfmdyswmvmkszkvih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaG5mbWR5c3dtdm1rc3prdmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDE0MjcsImV4cCI6MjA4NTkxNzQyN30.SADbdriXLlmzi5j3PU3Uh7mZBUQ7-m-qeXpZXs3mlUo';

async function seedData() {
    console.log('🚀 Starting Mockup Data Generation (Authenticated)...');

    // 1. Log in as Admin
    console.log('🔑 Logging in as admin...');
    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: 'admin@gmail.com', // Most usernames in this app are user@gmail.com
            password: 'admin123'
        })
    });

    if (!loginResponse.ok) {
        const err = await loginResponse.text();
        console.error('❌ Login failed:', err);
        return;
    }

    const { access_token } = await loginResponse.json();
    console.log('✅ Logged in successfully.');

    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    const zones = [
        { name: 'Zone 1', status: 'paid', periodOffset: 0 },
        { name: 'Zone 2', status: 'unpaid', periodOffset: 0 },
        { name: 'Zone 3', status: 'overdue', periodOffset: -1 },
        { name: 'Zone 4', status: 'overdue', periodOffset: -2, forCutoff: true },
        { name: 'Zone 5', status: 'unpaid', periodOffset: 0 }
    ];

    const today = new Date();

    for (const zone of zones) {
        console.log(`\n--- Processing ${zone.name} ---`);
        
        const meterNumber = `MTR-2026-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        const customerData = {
            first_name: 'Mock',
            last_name: zone.name,
            address: `${zone.name}, Pulupandan`,
            meter_number: meterNumber,
            customer_type: 'Residential',
            status: 'active',
            has_discount: false
        };

        const cResponse = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(customerData)
        });

        if (!cResponse.ok) {
            const err = await cResponse.text();
            console.error(`❌ Failed to create customer for ${zone.name}:`, err);
            continue;
        }

        const customer = (await cResponse.json())[0];
        console.log(`✅ Created Customer: ${customer.first_name} ${customer.last_name} (ID: ${customer.id})`);

        const billingDate = new Date(today);
        billingDate.setMonth(today.getMonth() + zone.periodOffset);
        
        const dueDate = new Date(billingDate);
        if (zone.status === 'overdue' || zone.forCutoff) {
            dueDate.setDate(billingDate.getDate() - (zone.forCutoff ? 45 : 5));
        } else {
            dueDate.setDate(billingDate.getDate() + 14);
        }

        const billingPeriod = billingDate.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        const billData = {
            customer_id: customer.id,
            billing_period: billingPeriod,
            previous_reading: 100,
            current_reading: 115,
            consumption: 15,
            amount: 250.00,
            balance: zone.status === 'paid' ? 0 : 250.00,
            status: zone.status,
            due_date: dueDate.toISOString().split('T')[0],
            reading_date: billingDate.toISOString(),
            payment_date: zone.status === 'paid' ? today.toISOString() : null,
            bill_no: Math.floor(1000 + Math.random() * 9000).toString()
        };

        const bResponse = await fetch(`${SUPABASE_URL}/rest/v1/billing`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(billData)
        });

        if (!bResponse.ok) {
            const err = await bResponse.text();
            console.error(`❌ Failed to create bill for ${zone.name}:`, err);
        } else {
            console.log(`✅ Created ${zone.status.toUpperCase()} bill for ${billingPeriod} ${zone.forCutoff ? '(FOR CUTOFF)' : ''}`);
        }
    }

    console.log('\n🏁 Mockup data generation complete!');
}

seedData().catch(err => console.error('💣 Fatal Error:', err));
