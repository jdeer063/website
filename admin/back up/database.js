// Supabase Database Operations

// === HELPERS ===
function getLocalISODate() {
    // Force PHT (Asia/Manila) and use sv-SE locale for ISO YYYY-MM-DD format
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
}

function formatLocalDateTime(dateInput, includeTime = true) {
    if (!dateInput) return 'N/A';
    
    // Ensure we handle strings that might represent UTC correctly
    if (typeof dateInput === 'string') {
        // If it looks like a timestamp (has time) but no timezone, assume UTC by appending 'Z'
        if ((dateInput.includes('T') || dateInput.includes(':')) && 
            !dateInput.endsWith('Z') && !dateInput.includes('+')) {
            dateInput += 'Z';
        }
    }
    let d = new Date(dateInput);
    
    // Check if the date is valid
    if (isNaN(d.getTime())) return 'N/A';
    
    const options = { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric',
        timeZone: 'Asia/Manila'
    };
    
    if (includeTime) {
        options.hour = '2-digit',
        options.minute = '2-digit',
        options.hour12 = true;
        return d.toLocaleString('en-US', options);
    }
    
    return d.toLocaleDateString('en-US', options);
}

function getBarangay(address) {
    if (!address) return 'N/A';
    const lowerAddr = address.toLowerCase();
    const list = window.PULUPANDAN_BARANGAYS || [];
    const found = list.find(b => lowerAddr.includes(b.toLowerCase()));
    return found || address;
}

function getAccountID(id) {
    if (!id) return 'ACC-000';
    return `ACC-${String(id).padStart(3, '0')}`;
}

// === CUSTOMERS ===
async function loadCustomers(options = {}) {
    let search = '';
    let status = '';
    let type = '';
    let barangay = '';
    let sortBy = 'id';
    let sortOrder = 'asc';
    let hideActions = options.hideActions || false;

    if (typeof options === 'string') {
        search = options;
    } else {
        search = options.search || '';
        status = options.status || '';
        type = options.type || '';
        barangay = options.barangay || '';
        sortBy = options.sortBy || 'id';
        sortOrder = options.sortOrder || 'asc';
    }
    
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;

    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order(sortBy, { ascending: sortOrder === 'asc' });
        
        if (error) throw error;

        // Enhanced multi-dimensional filtering
        const filteredData = data.filter(c => {
            const lowSearch = search.toLowerCase();
            const matchesSearch = !search || 
                `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase().includes(lowSearch) ||
                (c.meter_number || '').toLowerCase().includes(lowSearch) ||
                (c.address || '').toLowerCase().includes(lowSearch) ||
                getAccountID(c.id).toLowerCase().includes(lowSearch);
            
            const matchesStatus = !status || (c.status || 'active').toLowerCase() === status.toLowerCase();
            const matchesType = !type || (c.customer_type || '').toLowerCase() === type.toLowerCase();
            const matchesBarangay = !barangay || (c.address || '').toLowerCase().includes(barangay.toLowerCase());
            
            return matchesSearch && matchesStatus && matchesType && matchesBarangay;
        });

        if (filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${hideActions ? '7' : '8'}" style="text-align: center; padding: 2rem;">No customers found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filteredData.map(c => {
            const hasDiscount = c.has_discount;
            const middleInitial = c.middle_initial ? ` ${c.middle_initial}.` : '';
            const displayName = `${c.last_name}, ${c.first_name}${middleInitial}`;

            return `
            <tr data-id="${c.id}" 
                data-last-name="${c.last_name}" 
                data-first-name="${c.first_name}" 
                data-middle-initial="${c.middle_initial || ''}"
                data-type="${c.customer_type}"
                data-discount="${c.has_discount}"
                data-address="${c.address}"
                data-contact="${c.contact_number || ''}"
                data-meter-number="${c.meter_number || ''}"
                data-status="${c.status || 'active'}">
                <td class="account-id">${getAccountID(c.id)}</td>
                <td>
                    <div class="name-column">
                        <span class="display-name">${displayName}</span>
                        ${hasDiscount ? `<span class="badge info">PWD/SC</span>` : ''}
                    </div>
                </td>
                <td><div class="barangay-display" title="${c.address}">${getBarangay(c.address)}</div></td>
                <td><span class="meter-number">${c.meter_number || 'N/A'}</span></td>
                <td><span class="contact-number">${c.contact_number || 'N/A'}</span></td>
                <td><span class="badge purple">${c.customer_type || 'Residential'}</span></td>
                <td><span class="badge status-${(c.status || 'active').toLowerCase()}">${c.status || 'Active'}</span></td>
                ${!hideActions ? `
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>` : ''}
            </tr>
        `}).join('');

    } catch (error) {
        console.error('Error loading customers:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load customers</td></tr>';
    }
}

async function addCustomer(customerData) {
    try {
        const { error } = await supabase
            .from('customers')
            .insert([{
                last_name: customerData.lastName,
                first_name: customerData.firstName,
                middle_initial: customerData.middleInitial,
                address: customerData.address,
                contact_number: customerData.contact,
                meter_number: customerData.meterNumber,
                customer_type: customerData.customerType,
                status: customerData.status,
                has_discount: customerData.discount
            }]);

        if (error) throw error;
        showNotification('Customer added successfully', 'success');
        loadCustomers();
        loadDashboardStats();
    } catch (error) {
        console.error('Error adding customer:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

async function updateCustomer(id, customerData) {
    try {
        const { error } = await supabase
            .from('customers')
            .update({
                last_name: customerData.lastName,
                first_name: customerData.firstName,
                middle_initial: customerData.middleInitial,
                address: customerData.address,
                contact_number: customerData.contact,
                meter_number: customerData.meterNumber,
                customer_type: customerData.customerType,
                status: customerData.status,
                has_discount: customerData.discount,
                updated_at: new Date()
            })
            .eq('id', id);

        if (error) throw error;
        showNotification('Customer updated successfully', 'success');
        loadCustomers();
    } catch (error) {
        console.error('Error updating customer:', error);
        showNotification('Failed to update customer', 'error');
        throw error;
    }
}

async function deleteCustomer(id) {
    try {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        showNotification('Customer deleted successfully!', 'success');
        loadCustomers();
    } catch (error) {
        console.error('Error deleting customer:', error);
        showNotification('Failed to delete customer', 'error');
        throw error;
    }
}

// === STAFF ===
async function loadStaff(options = {}) {
    const search = typeof options === 'string' ? options : (options.search || '');
    const status = options.status || '';
    const role = options.role || '';
    
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;

    try {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('last_name');
        
        if (error) throw error;

        // Enhanced multi-dimensional filtering
        const filteredData = data.filter(s => {
            const matchesSearch = !search || 
                `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
                (s.username || '').toLowerCase().includes(search.toLowerCase());
            
            const matchesStatus = !status || (s.status || 'active').toLowerCase() === status.toLowerCase();
            const matchesRole = !role || (s.role || '').toLowerCase() === role.toLowerCase();
            
            return matchesSearch && matchesStatus && matchesRole;
        });

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No staff found.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredData.map(s => `
            <tr data-id="${s.id}"
                data-last-name="${s.last_name}"
                data-first-name="${s.first_name}"
                data-middle-initial="${s.middle_initial || ''}"
                data-username="${s.username}"
                data-role="${s.role}"
                data-contact="${s.contact_number || ''}"
                data-status="${s.status}">
                <td>#${String(s.id).padStart(3, '0')}</td>
                <td style="font-weight: 500;">${s.last_name}, ${s.first_name} ${s.middle_initial || ''}</td>
                <td><span class="badge ${s.role === 'admin' ? 'primary' : 'secondary'}">${s.role}</span></td>
                <td>${s.username}</td>
                <td>${s.contact_number}</td>
                <td><span class="badge status-${(s.status || 'active').toLowerCase()}">${s.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon change-password" title="Change Password"><i class="fas fa-key"></i></button>
                        <button class="btn-icon" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading staff:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load staff</td></tr>';
    }
}

async function addStaff(staffData) {
    try {
        // 1. Check if username exists
        const { data: existing, error: checkError } = await supabase
            .from('staff')
            .select('id')
            .eq('username', staffData.username)
            .limit(1);

        if (existing && existing.length > 0) {
            throw new Error('Username already exists. Please choose another.');
        }

        // 2. Insert staff record
        const { error } = await supabase
            .from('staff')
            .insert([{
                last_name: staffData.lastName,
                first_name: staffData.firstName,
                middle_initial: staffData.middleInitial,
                role: staffData.role,
                contact_number: staffData.contact,
                username: staffData.username,
                password: staffData.password, // Plain text for now as per system design
                status: staffData.status || 'active'
            }]);

        if (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('Username already exists.');
            }
            throw error;
        }
        
        showNotification(`Staff member added successfully`, 'success');
        loadStaff();
    } catch (error) {
        console.error('Error adding staff:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

async function updateStaff(id, staffData) {
    try {
        const updateData = {
            last_name: staffData.lastName,
            first_name: staffData.firstName,
            middle_initial: staffData.middleInitial,
            role: staffData.role,
            contact_number: staffData.contact,
            status: staffData.status,
            updated_at: new Date()
        };

        // Only include password if provided
        if (staffData.password && staffData.password.trim() !== '') {
            updateData.password = staffData.password;
        }

        const { error } = await supabase
            .from('staff')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;
        showNotification('Staff updated successfully', 'success');
        loadStaff();
    } catch (error) {
        console.error('Error updating staff:', error);
        showNotification(error.message || 'Failed to update staff', 'error');
        throw error;
    }
}

async function deleteStaff(id) {
    if (!confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) return;

    try {
        // 1. Get auth_uid first (Secure Deletion)
        const { data: staff, error: fetchError } = await supabase
            .from('staff')
            .select('auth_uid')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (staff.auth_uid) {
             // 2. Call Edge Function to delete Auth User (prevents future logins)
            const { data, error: deleteParamError } = await supabase.functions.invoke('delete-user', {
                body: { uid: staff.auth_uid }
            });
            
            if (deleteParamError) {
                 console.error("Failed to delete auth user (Network/System):", deleteParamError);
            } else if (!data || !data.success) {
                 console.error("Failed to delete auth user (Logic):", data?.error);
            } else {
                 console.log("Auth user deleted successfully");
            }
        }

        // 3. Delete from staff table
        const { error } = await supabase
            .from('staff')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        showNotification('Staff deleted successfully!', 'success');
        loadStaff();
    } catch (error) {
        console.error('Error deleting staff:', error);
        showNotification('Failed to delete staff', 'error');
    }
}

async function changeStaffPassword(staffId, newPassword) {
    try {
        console.log(`Starting password change for staff ID: ${staffId}`);
        
        // 1. Force Session Refresh
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !session) {
            console.error('Session refresh failed:', refreshError);
            throw new Error('Session expired. Please log in again.');
        }
        console.log('Session refreshed. Token:', session.access_token.substring(0, 15) + '...');

        // 2. Get staff info
        const { data: staff, error: fetchError } = await supabase
            .from('staff')
            .select('auth_uid, first_name, last_name')
            .eq('id', staffId)
            .single();
        
        if (fetchError) throw fetchError;
        if (!staff.auth_uid) throw new Error('Staff member has no auth account');
        
        // 3. GATEWAY BYPASS STRATEGY
        // Authenticate with Anon Key to pass Gateway, send User Token in body for verification
        const functionUrl = `${SUPABASE_URL}/functions/v1/update-password`;
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ 
                uid: staff.auth_uid, 
                newPassword,
                userToken: session.access_token 
            })
        });

        // Handle Response
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(`Invalid server response: ${response.status}`);
        }

        if (!response.ok) {
            console.error('Edge Function Error:', data);
            throw new Error(data.error || 'Server error');
        }

        if (!data.success) {
            throw new Error(data.error || 'Operation failed');
        }
        
        showNotification(`Password updated for ${staff.first_name}`, 'success');
        closeModal('changePasswordModal');

    } catch (error) {
        console.error('DEEP DEBUG ERROR:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}


// === BILLING ===
async function loadBilling(filters = {}) {
    const tbody = document.getElementById('billingTableBody');
    if (!tbody) return;

    try {
        const { search = '', status = '', month = '' } = filters;

        // 1. Fetch bills - Latest PAID at top (using payment_date descending)
        // Unpaid bills (null payment_date) will appear at the bottom by default in PostgreSQL
        // To show unpaid first, we'd need a different strategy, but user requested "latest paid at top"
        const { data: bills, error: billsError } = await supabase
            .from('billing')
            .select('*')
            .order('payment_date', { ascending: false, nullsFirst: false })
            .order('id', { ascending: false }); // Secondary sort for unpaid bills
        
        if (billsError) throw billsError;

        // 2. Fetch customers for these bills
        const customerIds = [...new Set(bills.map(b => b.customer_id))];
        const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('id, first_name, last_name, middle_initial, meter_number, address')
            .in('id', customerIds);

        if (customerError) throw customerError;

        // Map customers
        const customerMap = {};
        customers.forEach(c => customerMap[c.id] = c);

        // Attach customer objects to bills (to match existing structure expected by downstream code)
        const data = bills.map(b => ({
            ...b,
            customers: customerMap[b.customer_id]
        }));

        let filteredData = data;

        if (search) {
            const lowerSearch = search.toLowerCase();
            filteredData = filteredData.filter(b => 
                String(b.id).includes(lowerSearch) ||
                (b.customers && `${b.customers.first_name} ${b.customers.last_name}`.toLowerCase().includes(lowerSearch)) ||
                (b.customers && b.customers.meter_number.toLowerCase().includes(lowerSearch)) ||
                (b.customers && getAccountID(b.customers.id).toLowerCase().includes(lowerSearch))
            );
        }

        if (status) {
            filteredData = filteredData.filter(b => b.status === status);
        }

        if (month) {
            filteredData = filteredData.filter(b => b.billing_period === month);
        }

        // Populate Month Dropdown
        const monthSelect = document.getElementById('billingMonthFilter');
        if (monthSelect && monthSelect.children.length <= 1) {
            const uniqueMonths = [...new Set(data.map(b => b.billing_period))];
            uniqueMonths.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                monthSelect.appendChild(opt);
            });
        }

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No billing records found.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredData.map(bill => {
            const customer = bill.customers;
            const middleInitial = customer?.middle_initial ? ` ${customer.middle_initial}.` : '';
            const customerName = customer ? `${customer.last_name}, ${customer.first_name}${middleInitial}` : 'Unknown';
            
            return `
            <tr data-id="${bill.id}" data-customer-id="${bill.customer_id}">
                <td class="bill-id">#BIL-${String(bill.id).padStart(4, '0')}</td>
                <td>
                    <div class="customer-column">
                        <span class="customer-name">${customerName}</span>
                        <div class="customer-meta">
                            <span class="account-id small">${getAccountID(customer?.id)}</span>
                            <span class="meta-sep">•</span>
                            <span class="barangay-mini">${getBarangay(customer?.address)}</span>
                        </div>
                    </div>
                </td>
                <td>${formatLocalDateTime(bill.reading_date, false)}</td>
                <td class="amount">₱${parseFloat(bill.amount).toLocaleString()}</td>
                <td>${formatLocalDateTime(bill.due_date, false)}</td>
                <td><span class="badge ${bill.status === 'paid' ? 'success' : (bill.status === 'overdue' ? 'danger' : 'warning')}">${bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}</span></td>
                <td class="balance ${bill.balance > 0 ? 'negative' : 'positive'}">₱${parseFloat(bill.balance).toLocaleString()}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="View Bill"><i class="fas fa-file-invoice"></i></button>
                        <button class="btn-icon" title="View Ledger"><i class="fas fa-book"></i></button>
                    </div>
                </td>
            </tr>
        `}).join('');
        
    } catch (error) {
        console.error('Error loading billing:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Failed to load billing</td></tr>';
    }
}

async function loadCustomerBillingHistory(customerId) {
    try {
        const { data, error } = await supabase
            .from('billing')
            .select(`
                *,
                customers (last_name, first_name, middle_initial, meter_number)
            `)
            .eq('customer_id', customerId)
            .order('due_date', { ascending: false });
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error loading customer billing history:', error);
        throw error;
    }
}

// === DASHBOARD STATS ===
async function loadDashboardStats() {
    try {
        // Get total customers
        const { count: totalCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });
        
        // Get ALL billing records for status aggregation and historical consumption
        const { data: allBills, error: billsError } = await supabase
            .from('billing')
            .select('amount, status, consumption, billing_period, due_date');
        
        if (billsError) throw billsError;

        const totalRevenue = allBills?.filter(b => b.status === 'paid').reduce((sum, bill) => sum + parseFloat(bill.amount), 0) || 0;
        
        const unpaidBills = allBills?.filter(b => b.status === 'unpaid') || [];
        const overdueBills = allBills?.filter(b => b.status === 'overdue') || [];
        
        const pendingCount = unpaidBills.length;
        const pendingAmount = unpaidBills.reduce((sum, bill) => sum + (parseFloat(bill.balance) || parseFloat(bill.amount)), 0);
        
        const overdueCount = overdueBills.length;
        const overdueAmount = overdueBills.reduce((sum, bill) => sum + (parseFloat(bill.balance) || parseFloat(bill.amount)), 0);
        
        // Prepare Status Data for Pie Chart
        const statusData = {
            paid: allBills?.filter(b => b.status === 'paid').length || 0,
            unpaid: pendingCount,
            overdue: overdueCount,
            unpaidAmount: pendingAmount,
            overdueAmount: overdueAmount
        };

        // Prepare Consumption Data for Line Chart (Group by billing month)
        // Only show months for the current year (2026)
        const labels = [];
        const consumptionByMonth = {};
        const now = new Date();
        const currentYear = 2026; // Static as requested, or use now.getFullYear()
        
        // Loop from January (0) to current month
        for (let m = 0; m <= now.getMonth(); m++) {
            const d = new Date(currentYear, m, 1);
            const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
            labels.push(label);
            consumptionByMonth[label] = 0;
        }

        allBills?.forEach(bill => {
            const month = bill.billing_period;
            if (consumptionByMonth.hasOwnProperty(month)) {
                consumptionByMonth[month] += parseFloat(bill.consumption) || 0;
            }
        });

        const chartData = {
            consumption: {
                labels: labels,
                values: labels.map(l => consumptionByMonth[l])
            },
            status: statusData
        };

        // Update UI Stats
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues[0]) statValues[0].textContent = totalCustomers || 0;
        if (statValues[1]) statValues[1].textContent = `₱${totalRevenue.toLocaleString()}`;
        if (statValues[2]) statValues[2].textContent = pendingCount || 0;
        if (statValues[3]) statValues[3].textContent = overdueCount || 0;

        if (window.updateDashboardCharts) {
            window.updateDashboardCharts(chartData);
        }
        
        
        // Also load recent activities and start listening
        await loadRecentActivities();
        
        initializeRealtimeActivities();
    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
    }
}

function initializeRealtimeActivities() {
    const tbody = document.getElementById('recentActivitiesBody');
    if (!tbody) return;

    // Listen to billing table updates (cash payments)
    supabase
        .channel('billing-activities')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'billing' 
        }, payload => handleRealtimeActivity(payload.new, 'insert'))
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'billing' 
        }, payload => handleRealtimeActivity(payload.new, 'update'))
        .subscribe();

    /* 
    // Listen to online_payments table updates (cashier verifications)
    supabase
        .channel('online-payment-verifications')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'online_payments' 
        }, payload => handleOnlinePaymentActivity(payload.new))
        .subscribe();
    */
}

async function handleRealtimeActivity(bill, type) {
    const tbody = document.getElementById('recentActivitiesBody');
    if (!tbody) return;

    try {
        // Fetch customer data for the new bill
        const { data: customer, error } = await supabase
            .from('customers')
            .select('first_name, last_name')
            .eq('id', bill.customer_id)
            .single();

        if (error) throw error;

        const name = `${customer.first_name} ${customer.last_name}`;
        const date = formatLocalDateTime(bill.updated_at);
        
        let action = 'Bill Generated';
        let actionClass = 'warning';
        
        if (bill.status === 'paid') {
            action = 'Cash Collection';
            actionClass = 'success';
        } else if (bill.status === 'overdue') {
            action = 'Account Overdue';
            actionClass = 'danger';
        }

        const newRowHTML = `
            <tr class="activity-pulse">
                <td>
                    <div class="activity-name">${name}</div>
                </td>
                <td>
                    <span class="badge ${actionClass}">${action}</span>
                </td>
                <td class="activity-amount">₱${parseFloat(bill.amount).toLocaleString()}</td>
                <td class="activity-date">${date}</td>
            </tr>
        `;

        // Check if "No recent activities" is showing
        if (tbody.innerHTML.includes('No recent collection activities')) {
            tbody.innerHTML = '';
        }

        // Insert at the top
        tbody.insertAdjacentHTML('afterbegin', newRowHTML);

        // Keep only top 5
        const rows = tbody.querySelectorAll('tr');
        if (rows.length > 5) {
            rows[rows.length - 1].remove();
        }

        // Re-run dashboard stats calculation if it was a payment
        if (bill.status === 'paid' || bill.status === 'overdue') {
            loadDashboardStats();
        }

    } catch (error) {
        console.error('Error handling realtime activity:', error);
    }
}

async function handleOnlinePaymentActivity(payment) {
    const tbody = document.getElementById('recentActivitiesBody');
    if (!tbody) return;

    // Only show verified or rejected payments
    if (payment.status !== 'verified' && payment.status !== 'rejected') return;

    try {
        // Fetch customer data
        const { data: customer, error } = await supabase
            .from('customers')
            .select('first_name, last_name')
            .eq('id', payment.customer_id)
            .single();

        if (error) throw error;

        const name = `${customer.first_name} ${customer.last_name}`;
        const date = formatLocalDateTime(payment.updated_at);
        
        const action = payment.status === 'verified' 
            ? `${payment.platform.toUpperCase()} Verified`
            : `${payment.platform.toUpperCase()} Rejected`;
        const actionClass = payment.status === 'verified' ? 'success' : 'danger';

        const newRowHTML = `
            <tr class="activity-pulse">
                <td>
                    <div class="activity-name">${name}</div>
                </td>
                <td>
                    <span class="badge ${actionClass}">${action}</span>
                </td>
                <td class="activity-amount">₱${parseFloat(payment.amount).toLocaleString()}</td>
                <td class="activity-date">${date}</td>
            </tr>
        `;

        // Check if "No recent activities" is showing
        if (tbody.innerHTML.includes('No recent collection activities')) {
            tbody.innerHTML = '';
        }

        // Insert at the top
        tbody.insertAdjacentHTML('afterbegin', newRowHTML);

        // Keep only top 5
        const rows = tbody.querySelectorAll('tr');
        if (rows.length > 5) {
            rows[rows.length - 1].remove();
        }

        // Refresh stats when a payment is verified
        if (payment.status === 'verified') {
            loadDashboardStats();
        }

    } catch (error) {
        console.error('Error handling online payment activity:', error);
    }
}

async function loadRecentActivities() {
    const tbody = document.getElementById('recentActivitiesBody');
    if (!tbody) return;

    try {
        // 1. Fetch recent billing updates (cash payments)
        const { data: billingActivities, error: billingError } = await supabase
            .from('billing')
            .select(`
                id,
                amount,
                updated_at,
                status,
                payment_date,
                customer_id,
                customers (first_name, last_name)
            `)
            .eq('status', 'paid')
            .order('updated_at', { ascending: false })
            .limit(10);

        if (billingError) {
            console.error('[loadRecentActivities] Billing Error:', billingError);
            throw billingError;
        }

        // 2. Online payment verifications are disabled as the table was removed
        let onlineActivitiesWithCustomers = [];
        /*
        const { data: onlinePayments, error: onlineError } = await supabase
            .from('online_payments')
            .select('*')
            .in('status', ['verified', 'rejected'])
            .order('updated_at', { ascending: false })
            .limit(10);

        if (onlineError) {
            console.error('[loadRecentActivities] Online Error:', onlineError);
            throw onlineError;
        }

        if (onlinePayments && onlinePayments.length > 0) {
            const customerIds = [...new Set(onlinePayments.map(p => p.customer_id))];
            const { data: customers, error: customerError } = await supabase
                .from('customers')
                .select('id, first_name, last_name')
                .in('id', customerIds);
            
            if (customerError) {
                console.error('[loadRecentActivities] Customer Error:', customerError);
            }

            const customerMap = {};
            (customers || []).forEach(c => customerMap[c.id] = c);
            
            onlineActivitiesWithCustomers = onlinePayments.map(payment => ({
                ...payment,
                customers: customerMap[payment.customer_id]
            }));
        }
        */

        // Helper to force UTC parsing for backend timestamps
        const calculateTimestamp = (dateStr) => {
            if (!dateStr) return new Date();
            // If string has no timezone info (no Z or +), append Z to force UTC
            if (typeof dateStr === 'string' && (dateStr.includes('T') || dateStr.includes(':')) && 
                !dateStr.endsWith('Z') && !dateStr.includes('+')) {
                return new Date(dateStr + 'Z');
            }
            return new Date(dateStr);
        };

        // 4. Combine and sort all activities
        const allActivities = [
            ...(billingActivities || []).map(act => ({
                ...act,
                type: 'cash_payment',
                timestamp: calculateTimestamp(act.updated_at || act.payment_date)
            })),
            ...(onlineActivitiesWithCustomers || [])
        ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);


        if (allActivities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #9E9E9E;">No recent collection activities</td></tr>';
            return;
        }

        tbody.innerHTML = allActivities.map(act => {
            const customer = act.customers;
            const name = customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown';
            const date = formatLocalDateTime(act.timestamp);
            
            let action = '';
            let actionClass = '';
            
            if (act.type === 'cash_payment') {
                action = 'Cash Collection';
                actionClass = 'success';
            } else if (act.type === 'online_verification') {
                if (act.status === 'verified') {
                    action = `${act.platform.toUpperCase()} Verified`;
                    actionClass = 'success';
                } else {
                    action = `${act.platform.toUpperCase()} Rejected`;
                    actionClass = 'danger';
                }
            }

            return `
                <tr>
                    <td>
                        <div class="activity-name">${name}</div>
                    </td>
                    <td>
                        <span class="badge ${actionClass}">${action}</span>
                    </td>
                    <td class="activity-amount">₱${parseFloat(act.amount).toLocaleString()}</td>
                    <td class="activity-date">${date}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('❌ [loadRecentActivities] Failed:', error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #D32F2F;">Failed to load activities.</td></tr>';
    }
}

// === CONSTANTS ===
window.PREMIUM_PALETTE = [
    { name: 'Electric Blue', color: '#2563EB', rgb: '37, 99, 235' },
    { name: 'Vibrant Red', color: '#E11D48', rgb: '225, 29, 72' },
    { name: 'Spring Green', color: '#10B981', rgb: '16, 185, 129' },
    { name: 'Amber Yellow', color: '#F59E0B', rgb: '245, 158, 11' },
    { name: 'Vivid Purple', color: '#7C3AED', rgb: '124, 58, 237' }
];

window.PULUPANDAN_BARANGAYS = [
    'Zone 1', 'Zone 1-A', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 4-A',
    'Zone 5', 'Zone 6', 'Zone 7', 'Canjusa', 'Utod', 'Pag-ayon',
    'Palaka Norte', 'Palaka Sur', 'Mabini', 'Tapong', 'Crossing', 'Ubay', 'Poblacion'
];

// === AREA BOXES (SCHEDULING OVERHAUL) ===
const PULUPANDAN_BARANGAYS_LOCAL = [ // Renamed to avoid conflict with global
    'Zone 1', 'Zone 1-A', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 4-A', 'Zone 5', 'Zone 6', 'Zone 7',
    'Canjusa', 'Crossing Pulupandan', 'Culo', 'Mabini', 'Pag-ayon', 'Palaka Norte', 'Palaka Sur',
    'Patic', 'Tapong', 'Ubay', 'Utod'
];

async function loadAreaBoxes() {
    const grid = document.getElementById('assignmentsGrid');
    if (!grid) return;

    try {
        // First, check for midnight reset
        await syncMidnightReset();

        const { data: boxes, error } = await supabase
            .from('area_boxes')
            .select(`
                *,
                staff!assigned_reader_id (id, first_name, last_name)
            `)
            .order('created_at');

        if (error) throw error;

        const addBtnHTML = `
            <button class="add-box-btn" id="openAddBoxModal">
                <i class="fas fa-plus"></i>
                <span>Add Box</span>
            </button>
        `;

        if (!boxes || boxes.length === 0) {
            grid.innerHTML = addBtnHTML;
            return;
        }

        grid.innerHTML = boxes.map(box => {
            const hasReader = !!box.staff;
            const readerName = hasReader ? `${box.staff.last_name}, ${box.staff.first_name}` : 'Unassigned';
            const initials = hasReader ? `${box.staff.first_name[0]}${box.staff.last_name[0]}` : '?';
            
            // Find RGB for glassmorphism tags
            const paletteEntry = window.PREMIUM_PALETTE.find(p => p.color === box.color) || window.PREMIUM_PALETTE[0];
            const boxRgb = paletteEntry.rgb;

            const tags = (box.barangays || []).map(bg => `
                <span class="barangay-tag" style="--box-color: ${box.color}; --box-color-rgb: ${boxRgb}">
                    ${bg}
                </span>
            `).join('');

            return `
                <div class="area-box" style="--box-color: ${box.color}; --box-color-rgb: ${boxRgb}" onclick="window.dbOperations.editAreaBox(${box.id})">
                    <div class="area-box-header">
                        <div class="area-box-name">${box.name}</div>
                        <div class="status-indicator-dot" style="background: ${box.color}; box-shadow: 0 0 10px ${box.color};"></div>
                    </div>
                    
                    <div class="barangay-tags">
                        ${tags || `<span class="barangay-tag warning">No Barangays</span>`}
                    </div>

                    <div class="area-box-footer">
                        <div class="area-box-reader">
                            <div class="reader-avatar" style="--box-color: ${box.color}">${initials}</div>
                            <div class="reader-details">
                                <span class="reader-name ${hasReader ? 'active' : 'unassigned'}">${readerName}</span>
                                <span class="reader-role">Sector Reader</span>
                            </div>
                        </div>
                        <i class="fas fa-arrow-right arrow-icon"></i>
                    </div>
                </div>
            `;
        }).join('') + addBtnHTML;

    } catch (error) {
        console.error('Error loading area boxes:', error);
        grid.innerHTML = '<div class="text-danger">Failed to load area boxes.</div>';
    }
}

async function syncMidnightReset() {
    try {
        const today = getLocalISODate();
        
        // Find boxes that haven't been reset today
        const { data: staleBoxes, error: fetchError } = await supabase
            .from('area_boxes')
            .select('id, last_reset_date')
            .lt('last_reset_date', today);

        if (fetchError) throw fetchError;

        if (staleBoxes && staleBoxes.length > 0) {
            console.log(`Resetting ${staleBoxes.length} boxes for the new day...`);
            const { error: updateError } = await supabase
                .from('area_boxes')
                .update({ 
                    assigned_reader_id: null,
                    last_reset_date: today 
                })
                .in('id', staleBoxes.map(b => b.id));

            if (updateError) throw updateError;
        }
    } catch (error) {
        console.error('Midnight sync component failed:', error);
    }
}

async function addAreaBox(boxData) {
    try {
        const { error } = await supabase
            .from('area_boxes')
            .insert([{
                name: boxData.name,
                color: boxData.color,
                barangays: boxData.barangays,
                assigned_reader_id: boxData.readerId || null,
                last_reset_date: getLocalISODate()
            }]);

        if (error) throw error;
        showNotification('Area Box created successfully', 'success');
        loadAreaBoxes();
    } catch (error) {
        console.error('Error adding area box:', error);
        showNotification('Failed to create box', 'error');
        throw error;
    }
}

async function updateAreaBox(id, boxData) {
    try {
        const { error } = await supabase
            .from('area_boxes')
            .update({
                name: boxData.name,
                color: boxData.color,
                barangays: boxData.barangays,
                assigned_reader_id: boxData.readerId || null,
                updated_at: new Date()
            })
            .eq('id', id);

        if (error) throw error;
        showNotification('Area Box updated', 'success');
        loadAreaBoxes();
    } catch (error) {
        console.error('Error updating area box:', error);
        showNotification('Update failed', 'error');
        throw error;
    }
}

async function deleteAreaBox(id) {
    window.showConfirmModal({
        title: 'Delete Area Box?',
        message: 'Are you sure you want to delete this Area Box? This cannot be undone.',
        confirmText: 'Delete Box',
        onConfirm: async () => {
            try {
                const { error } = await supabase
                    .from('area_boxes')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                showNotification('Area Box deleted', 'success');
                loadAreaBoxes();
            } catch (error) {
                console.error('Error deleting area box:', error);
                showNotification('Delete failed', 'error');
            }
        }
    });
}
async function editAreaBox(id) {
    try {
        const { data: box, error } = await supabase
            .from('area_boxes')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        window.showEditBoxModal(box);
    } catch (error) {
        console.error('Error fetching box for edit:', error);
    }
}

// === SYSTEM SETTINGS ===
async function loadSystemSettings() {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('*')
            .order('id')
            .limit(1);

        if (error) {
            console.error('Supabase Settings Load Error:', error);
            throw error;
        }

        // If no settings exist, initialize with defaults
        if (!data || data.length === 0) {
            console.log('No settings found. Initializing with defaults...');
            const { data: newData, error: insertError } = await supabase
                .from('system_settings')
                .insert([{}]) // Uses schema defaults
                .select();
                
            if (insertError) {
                console.error('Supabase Settings Initialization Error:', insertError);
                throw insertError;
            }
            return newData[0];
        }

        // Populate UI if elements exist
        if (document.getElementById('settingDiscount')) document.getElementById('settingDiscount').value = data[0].discount_percentage;
        if (document.getElementById('settingPenalty')) document.getElementById('settingPenalty').value = data[0].penalty_percentage;
        if (document.getElementById('settingOverdueDays')) document.getElementById('settingOverdueDays').value = data[0].overdue_days || 14;
        if (document.getElementById('settingCutoffGrace')) document.getElementById('settingCutoffGrace').value = data[0].cutoff_grace_period || 3;

        return data[0];
    } catch (error) {
        console.error('Error in loadSystemSettings:', error);
        throw error;
    }
}

async function updateSystemSettings(settingsData) {
    try {
        const { id, ...dataToUpdate } = settingsData;
        const { error } = await supabase
            .from('system_settings')
            .update({
                ...dataToUpdate,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error('Supabase Settings Update Error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }
    } catch (error) {
        console.error('Error updating system settings:', error);
        throw error;
    }
}

async function verifyAdminPIN(pin) {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('admin_pin')
            .order('id')
            .limit(1);

        if (error) throw error;
        
        // If no records exist or admin_pin is empty/mock, allow '1234' as fallback
        const storedPIN = (data && data.length > 0) ? data[0].admin_pin : null;
        const isMockPIN = storedPIN === '$2b$10$YourHashedPINHere';
        
        console.log('PIN Verification Debug:', { 
            input: pin, 
            stored: storedPIN, 
            isMock: isMockPIN,
            fallbackMatch: pin === '1234'
        });

        if (!storedPIN || storedPIN === '' || isMockPIN) {
            return pin === '1234';
        }
        
        return storedPIN === pin;
    } catch (error) {
        console.error('PIN verification failed:', error);
        return false;
    }
}

async function updateAdminPIN(newPIN, currentPIN) {
    try {
        // 1. Verify Current PIN first (using robust selector)
        const { data: records, error: fetchError } = await supabase
            .from('system_settings')
            .select('id, admin_pin')
            .order('id')
            .limit(1);

        if (fetchError) throw fetchError;
        
        let storedPIN = (records && records.length > 0) ? records[0].admin_pin : null;
        let settingsId = (records && records.length > 0) ? records[0].id : null;
        const isMockPIN = storedPIN === '$2b$10$YourHashedPINHere';

        console.log('PIN Update Check:', { current: currentPIN, stored: storedPIN, isMock: isMockPIN });

        // Fallback check: if no PIN stored or using mock, '1234' is active
        if (!storedPIN || storedPIN === '' || isMockPIN) {
            if (currentPIN !== '1234') {
                showNotification('Incorrect temporary PIN.', 'error');
                return false;
            }
        } else if (storedPIN !== currentPIN) {
            showNotification('Incorrect current PIN.', 'error');
            return false;
        }

        // 2. Proceed with update
        if (settingsId) {
            const { error: updateError } = await supabase
                .from('system_settings')
                .update({ 
                    admin_pin: newPIN,
                    updated_at: new Date().toISOString()
                })
                .eq('id', settingsId);

            if (updateError) throw updateError;
        } else {
            // No settings record at all? Create one.
            const { error: insertError } = await supabase
                .from('system_settings')
                .insert([{ 
                    admin_pin: newPIN,
                    updated_at: new Date().toISOString()
                }]);
            if (insertError) throw insertError;
        }
        
        return true;
    } catch (error) {
        console.error('PIN update failed:', error);
        throw error;
    }
}

// === MASTER LEDGER & LEDGER CARD ===

/**
 * Loads the master ledger list (All Customers Directory)
 */
async function loadMasterLedger(options = {}) {
    const barangay = options.barangay || '';
    const search = options.search || '';
    
    const tbody = document.getElementById('ledgerMasterBody');
    if (!tbody) return;

    try {
        // 1. Fetch ALL Customers and their latest payment date
        // We'll fetch customers and join with billing to get the latest payment_date
        let { data: customersRaw, error: cError } = await supabase
            .from('customers')
            .select(`
                *,
                billing (
                    payment_date
                )
            `);
        
        if (cError) throw cError;

        // Process customers to find their latest payment date
        const customers = customersRaw.map(c => {
            // Find the latest payment date from the billing array
            const latestPayment = c.billing
                ?.map(b => b.payment_date)
                .filter(d => d) // Remove nulls
                .sort((a, b) => new Date(b) - new Date(a))[0]; // Sort desc and take first

            return {
                ...c,
                latest_payment: latestPayment || null
            };
        }).sort((a, b) => {
            // Sort by latest_payment descending
            // If timestamps are equal or missing, fall back to ID descending
            const timeA = a.latest_payment ? new Date(a.latest_payment).getTime() : 0;
            const timeB = b.latest_payment ? new Date(b.latest_payment).getTime() : 0;
            
            if (timeB !== timeA) return timeB - timeA;
            return b.id - a.id;
        });

        // 2. Fetch ALL Unpaid Bills to calculate balances
        const { data: unpaidBills, error: bError } = await supabase
            .from('billing')
            .select('customer_id, amount')
            .eq('status', 'unpaid');
        
        if (bError) throw bError;

        // Create a map of customer balances
        const balanceMap = {};
        unpaidBills.forEach(bill => {
            const cid = bill.customer_id;
            balanceMap[cid] = (balanceMap[cid] || 0) + parseFloat(bill.amount);
        });

        // 3. Apply client-side filters for barangay and search
        const filtered = customers.filter(c => {
            const address = c.address || '';
            const matchesBarangay = !barangay || address.toLowerCase().includes(barangay.toLowerCase());
            
            const lowSearch = search.toLowerCase();
            const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
            const accountId = getAccountID(c.id).toLowerCase();
            const meterNo = (c.meter_number || '').toLowerCase();
            
            const matchesSearch = !search || 
                fullName.includes(lowSearch) ||
                accountId.includes(lowSearch) ||
                meterNo.includes(lowSearch);

            return matchesBarangay && matchesSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No customers found in directory.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(c => {
            const balance = balanceMap[c.id] || 0;
            return `
            <tr>
                <td><span class="mono">${getAccountID(c.id)}</span></td>
                <td><strong>${c.last_name}, ${c.first_name}</strong></td>
                <td>${getBarangay(c.address)}</td>
                <td>${c.meter_number || '--'}</td>
                <td>${c.customer_type || 'Residential'}</td>
                <td class="${balance > 0 ? 'text-danger fw-bold' : 'text-success'}">
                    ₱${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
                <td class="no-print">
                    <button class="btn btn-sm btn-outline" onclick="window.viewCustomerLedger(${c.id})">
                        <i class="fas fa-file-invoice"></i> View Card
                    </button>
                </td>
            </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading Master Ledger:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-danger center">Failed to load directory: ${error.message}</td></tr>`;
    }
}

/**
 * Loads a detailed historical ledger card for a specific customer
 */
async function loadLedgerCard(customerId) {
    const tbody = document.getElementById('ledgerCardBody');
    if (!tbody) return;

    try {
        // 1. Fetch Customer Info
        const { data: customer, error: cError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();
        
        if (cError) throw cError;

        // Update Header UI (Image-accurate IDs)
        const accountId = getAccountID(customer.id);
        const name = `${customer.last_name}, ${customer.first_name} ${customer.middle_initial || ''}`;
        
        if (document.getElementById('cardAccountNoTop')) document.getElementById('cardAccountNoTop').textContent = accountId;
        if (document.getElementById('cardCustomerName')) document.getElementById('cardCustomerName').textContent = name;
        if (document.getElementById('cardAddress')) document.getElementById('cardAddress').textContent = customer.address;
        if (document.getElementById('cardMeterNo')) document.getElementById('cardMeterNo').textContent = customer.meter_number;

        // 2. Fetch Billing History
        const { data: bills, error: bError } = await supabase
            .from('billing')
            .select('*')
            .eq('customer_id', customerId)
            .order('reading_date', { ascending: true });
        
        if (bError) throw bError;

        // 3. Construct chronological ledger entries
        let entries = [];
        let runningBalance = 0;

        bills.forEach(b => {
            // Billing Event
            runningBalance += parseFloat(b.amount);
            entries.push({
                date: b.reading_date || b.period_end || b.due_date || b.created_at,
                billNo: `BIL-${b.id}`,
                others: '',
                particulars: `Monthly Reading (${b.billing_period})`,
                reading: b.current_reading,
                consumption: b.consumption,
                billing: b.amount,
                collection: null,
                balance: runningBalance,
                type: 'bill'
            });

            // Payment Event (if paid)
            if (b.status === 'paid' && b.payment_date) {
                runningBalance -= parseFloat(b.amount);
                entries.push({
                    date: b.payment_date,
                    billNo: `BIL-${b.id}`,
                    others: '',
                    particulars: `Cash Payment - Period ${b.billing_period}`,
                    reading: null,
                    consumption: null,
                    billing: null,
                    collection: b.amount,
                    balance: runningBalance,
                    type: 'payment'
                });
            }
        });

        // Sort by date
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">New Customer - No transaction history available.</td></tr>';
            return;
        }

        tbody.innerHTML = entries.map(e => `
            <tr class="${e.type === 'payment' ? 'payment-row' : 'bill-row'}">
                <td>${formatLocalDateTime(e.date, false)}</td>
                <td>${e.billNo}</td>
                <td>${e.others}</td>
                <td class="text-left">${e.particulars}</td>
                <td>${e.reading || '--'}</td>
                <td>${e.consumption || '--'}</td>
                <td class="amount-bill">${e.billing ? '₱' + parseFloat(e.billing).toLocaleString() : '--'}</td>
                <td class="amount-credit">${e.collection ? '₱' + parseFloat(e.collection).toLocaleString() : '--'}</td>
                <td class="balance-cell">₱${e.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading ledger card:', error);
        showNotification('Failed to load customer ledger card', 'error');
    }
}

/**
 * Loads the meter reading list for a specific period and barangay
 */
async function loadReadingList(options = {}) {
    const { period = '', barangay = '', search = '', sortBy = 'id', sortOrder = 'asc' } = options;
    
    const tbody = document.getElementById('readingListTableBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading readings...</td></tr>';
        
        // 1. Fetch relevant bills
        let billQuery = supabase
            .from('billing')
            .select('customer_id, previous_reading, current_reading, consumption, billing_period, updated_at')
            .order('updated_at', { ascending: false }); // Sort by latest update to get most recent reading in map
        
        if (period) {
            billQuery = billQuery.eq('billing_period', period);
        }
        
        const { data: bills, error: bError } = await billQuery;
        if (bError) throw bError;

        // 2. Fetch customers
        let customerQuery = supabase
            .from('customers')
            .select('id, last_name, first_name, middle_initial, address, meter_number');
        
        if (barangay) {
            customerQuery = customerQuery.ilike('address', `%${barangay}%`);
        }
        
        const { data: customers, error: cError } = await customerQuery;
        if (cError) throw cError;

        // 3. Join logic (Latest reading per customer)
        const billMap = {};
        (bills || []).forEach(b => {
            // Because we sorted by updated_at desc, the FIRST one we encounter for a customer is the latest
            if (!billMap[b.customer_id]) {
                billMap[b.customer_id] = b;
            }
        });

        let listData = customers.map(c => ({
            ...c,
            reading: billMap[c.id] || { previous_reading: '--', current_reading: '--', consumption: '--' }
        }));

        // 4. Search Filter
        if (search) {
            const lowSearch = search.toLowerCase();
            listData = listData.filter(item => {
                const fullName = `${item.first_name} ${item.last_name}`.toLowerCase();
                const accountId = getAccountID(item.id).toLowerCase();
                return fullName.includes(lowSearch) || accountId.includes(lowSearch) || (item.meter_number || '').toLowerCase().includes(lowSearch);
            });
        }

        // 5. Sort Logic
        listData.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];

            if (sortBy === 'last_name') {
                valA = `${a.last_name}, ${a.first_name}`.toLowerCase();
                valB = `${b.last_name}, ${b.first_name}`.toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        if (listData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #9E9E9E;">No results found reflecting your filters.</td></tr>`;
            return;
        }

        tbody.innerHTML = listData.map(item => {
            const middleInitial = item.middle_initial ? ` ${item.middle_initial}.` : '';
            const fullName = `${item.last_name}, ${item.first_name}${middleInitial}`;
            return `
            <tr>
                <td class="mono">${getAccountID(item.id)}</td>
                <td><strong>${fullName}</strong></td>
                <td style="text-align: right;">${item.reading.previous_reading}</td>
                <td style="text-align: right;">${item.reading.current_reading}</td>
                <td style="text-align: right;">${item.reading.consumption}</td>
                <td>${item.address}</td>
                <td class="mono">${item.meter_number || '--'}</td>
            </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading reading list:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger center">Failed to load reading list: ${error.message}</td></tr>`;
    }
}

/**
 * Gets the assigned reader for a given barangay based on area_boxes
 */
async function getReaderForBarangay(barangay) {
    try {
        if (!barangay) return 'Not Assigned';
        
        const { data: boxes, error } = await supabase
            .from('area_boxes')
            .select(`
                barangays,
                staff!assigned_reader_id (first_name, last_name)
            `);
        
        if (error) {
            console.error('Error fetching area boxes for reader mapping:', error);
            throw error;
        }

        if (!boxes || boxes.length === 0) return 'Not Assigned';

        // Find the box that contains this barangay
        const assignedBox = boxes.find(box => 
            Array.isArray(box.barangays) && box.barangays.some(bg => bg.toLowerCase().trim() === barangay.toLowerCase().trim())
        );

        if (assignedBox && assignedBox.staff) {
            return `${assignedBox.staff.last_name}, ${assignedBox.staff.first_name}`;
        }
        return 'Not Assigned';
    } catch (error) {
        console.error('Error getting reader for barangay:', error);
        return 'Error fetching reader';
    }
}

// Exports
window.dbOperations = {
    loadCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    loadStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    changeStaffPassword,
    loadBilling,
    loadCustomerBillingHistory,
    loadDashboardStats,
    loadAreaBoxes,
    addAreaBox,
    updateAreaBox,
    deleteAreaBox,
    editAreaBox,
    loadSystemSettings,
    updateSystemSettings,
    verifyAdminPIN,
    updateAdminPIN,
    loadMasterLedger,
    loadLedgerCard,
    loadReadingList,
    getReaderForBarangay,
    initializeRealtimeActivities,
    PULUPANDAN_BARANGAYS
};
