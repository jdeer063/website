// Cashier Dashboard Logic
function getAccountID(id) {
    if (!id) return 'ACC-000';
    return `ACC-${String(id).padStart(3, '0')}`;
}

let logSortConfig = { key: 'date', order: 'desc' };
let logDataCache = [];

function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    // Sidebar Collapse Logic (Desktop)
    if (sidebarToggle) {
        // Load preference
        const isCollapsed = localStorage.getItem('sidebar-collapsed-cashier') === 'true';
        if (isCollapsed && window.innerWidth > 1024) {
            sidebar.classList.add('collapsed');
        }

        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth > 1024) {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebar-collapsed-cashier', sidebar.classList.contains('collapsed'));
            } else {
                sidebar.classList.remove('active');
            }
        });
    }

    // Mobile Menu
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
    }

    // Close when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !mobileMenuBtn?.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });
}

async function loadUserProfile() {
    try {
        // Get staff user from session storage (set by auth-guard)
        const staffUser = JSON.parse(sessionStorage.getItem('staffUser'));
        if (!staffUser || !staffUser.username) {
            console.warn('No staff user in session');
            return;
        }

        // Fetch staff data from database
        const { data: staff, error } = await supabase
            .from('staff')
            .select('first_name, last_name, role')
            .eq('username', staffUser.username)
            .single();

        if (error) throw error;

        if (staff) {
            const { first_name = 'Cashier', last_name = 'User', role = 'cashier' } = staff;
            
            const nameEl = document.getElementById('userName');
            const roleEl = document.getElementById('userRole');
            const avatarEl = document.getElementById('userAvatar');

            if (nameEl) nameEl.textContent = `${first_name} ${last_name}`;
            if (roleEl) roleEl.textContent = (role || 'cashier').charAt(0).toUpperCase() + (role || 'cashier').slice(1);
            if (avatarEl) avatarEl.textContent = (first_name || 'C').charAt(0).toUpperCase();
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeSidebar();
    initializeNavigation();
    initializeMobileMenu();
    initializeLogout();
    initializeTheme();
    
    // Initial data load
    setTimeout(() => {
        loadInitialData();
    }, 100);

    // Search and Filter Hooks
    const custSearch = document.getElementById('customerSearch');
    const custStatusFilter = document.getElementById('customerStatusFilter');
    const custTypeFilter = document.getElementById('customerTypeFilter');
    
    if (custSearch) {
        custSearch.addEventListener('input', () => loadCustomers());
    }
    if (custStatusFilter) {
        custStatusFilter.addEventListener('change', () => loadCustomers());
    }
    if (custTypeFilter) {
        custTypeFilter.addEventListener('change', () => loadCustomers());
    }

    const billSearch = document.getElementById('billingSearch');
    const billStatusFilter = document.getElementById('billingStatusFilter');
    const billMonthFilter = document.getElementById('billingMonthFilter');

    if (billSearch) {
        billSearch.addEventListener('input', () => loadBilling());
    }
    if (billStatusFilter) {
        billStatusFilter.addEventListener('change', () => loadBilling());
    }
    if (billMonthFilter) {
        billMonthFilter.addEventListener('change', () => loadBilling());
    }

    // Records Filters
    const logSearch = document.getElementById('logSearch');
    const logDateFrom = document.getElementById('logDateFrom');
    const logDateTo = document.getElementById('logDateTo');

    if (logSearch) {
        logSearch.addEventListener('input', () => loadCollectionRecords());
    }
    if (logDateFrom) {
        logDateFrom.addEventListener('change', () => loadCollectionRecords());
    }
    if (logDateTo) {
        logDateTo.addEventListener('change', () => loadCollectionRecords());
    }

    // Barangay Filters
    const custBarangayFilter = document.getElementById('customerBarangayFilter');

    // Populate Barangay Dropdowns
    const barangayList = [
        'Zone 1', 'Zone 1-A', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 4-A',
        'Zone 5', 'Zone 6', 'Zone 7', 'Canjusa', 'Utod', 'Pag-ayon',
        'Palaka Norte', 'Palaka Sur', 'Mabini', 'Tapong', 'Crossing', 'Ubay', 'Poblacion'
    ];
    const barangayOptions = barangayList.map(b => `<option value="${b}">${b}</option>`).join('');
    if (custBarangayFilter) {
        custBarangayFilter.innerHTML = '<option value="">All Barangays</option>' + barangayOptions;
        custBarangayFilter.addEventListener('change', () => loadCustomers());
    }
});

async function loadInitialData() {
    try {
        if (!supabase) {
            console.error('Supabase client not ready');
            return;
        }
        
        console.log('Loading Cashier data...');
        await Promise.all([
            loadUserProfile(),
            loadCashierStats(),
            loadRecentCollections(),
            loadCustomers(),
            loadBilling(),
            loadPaymentsQueue(),
            loadBillingMonths(),
            loadCollectionRecords()
        ]);
        
        hideLoadingOverlay();
    } catch (error) {
        console.error('Error loading initial data:', error);
        hideLoadingOverlay();
    }
    
    // ===== SETUP REALTIME SUBSCRIPTIONS =====
    setupRealtimeSubscriptions();
}

function setupRealtimeSubscriptions() {
    if (!window.subscribeToTable) {
        console.error('[Realtime] subscribeToTable not available - check supabase-config.js loaded');
        return;
    }

    console.log('[Realtime] Setting up Cashier subscriptions...');

    // Subscribe to customers table
    subscribeToTable('customers', (payload) => {
        console.log('[Realtime] Customers table changed, reloading...', payload);
        loadCustomers();
        // Small delay for DELETE to ensure DB is updated
        setTimeout(() => loadCashierStats(), 100);
    });

    // Subscribe to billing table
    subscribeToTable('billing', (payload) => {
        console.log('[Realtime] Billing table changed, reloading...', payload);
        loadBilling();
        loadCashierStats();
        loadRecentCollections();
    });
    
    console.log('[Realtime] Cashier subscriptions setup complete');
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('fade-out');
}

// === CHART MANAGEMENT ===
let paymentStatusChart = null;
let dailyTrendChart = null;

function updateCashierChart(stats) {
    const ctxPayment = document.getElementById('paymentStatusChart')?.getContext('2d');
    if (!ctxPayment || !stats) return;

    const statusValues = [stats.paid, stats.unpaid, stats.overdue];
    const total = statusValues.reduce((a, b) => a + b, 0);

    if (paymentStatusChart) {
        paymentStatusChart.data.datasets[0].data = statusValues;
        paymentStatusChart.options.plugins.centerText.text = total.toString();
        paymentStatusChart.update();
    } else {
        // Register a custom plugin for the center text (same as Admin)
        const centerTextPlugin = {
            id: 'centerText',
            text: total.toString(),
            afterDraw: (chart) => {
                const { ctx, chartArea: { top, bottom, left, right, width, height } } = chart;
                ctx.save();
                
                // Draw "TOTAL" label
                ctx.font = '500 12px Inter';
                ctx.fillStyle = '#64748B';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('TOTAL BILLS', width / 2, height / 2 - 15 + top);
                
                // Draw the count
                ctx.font = 'bold 36px Inter';
                ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#F9FAFB' : '#1E293B';
                ctx.fillText(chart.config.options.plugins.centerText.text, width / 2, height / 2 + 18 + top);
                
                ctx.restore();
            }
        };

        paymentStatusChart = new Chart(ctxPayment, {
            type: 'doughnut',
            plugins: [centerTextPlugin],
            data: {
                labels: ['Paid', 'Unpaid', 'Overdue'],
                datasets: [{
                    data: statusValues,
                    backgroundColor: [
                        '#10B981', // Emerald 500
                        '#F59E0B', // Amber 500
                        '#EF4444'  // Red 500
                    ],
                    hoverBackgroundColor: [
                        '#059669', // Emerald 600
                        '#D97706', // Amber 600
                        '#DC2626'  // Red 600
                    ],
                    borderWidth: 0,
                    hoverOffset: 15,
                    borderRadius: 4,
                    spacing: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { family: 'Inter', size: 12 },
                            color: '#64748B'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        cornerRadius: 8
                    },
                    centerText: {
                        text: total.toString()
                    }
                },
                cutout: '80%',
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }
}

function updateDailyTrendChart(data) {
    const ctxTrend = document.getElementById('dailyTrendChart')?.getContext('2d');
    if (!ctxTrend || !data) return;

    if (dailyTrendChart) {
        dailyTrendChart.data.labels = data.labels;
        dailyTrendChart.data.datasets[0].data = data.amounts;
        dailyTrendChart.data.datasets[1].data = data.counts;
        dailyTrendChart.update();
    } else {
        dailyTrendChart = new Chart(ctxTrend, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'Revenue (₱)',
                        data: data.amounts,
                        borderColor: '#0288D1',
                        backgroundColor: 'rgba(2, 136, 209, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y',
                        order: 1
                    },
                    {
                        type: 'bar',
                        label: 'Payments Count',
                        data: data.counts,
                        backgroundColor: 'rgba(245, 158, 11, 0.5)',
                        borderColor: '#F59E0B',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'y1',
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { family: 'Inter', size: 12 },
                            color: '#64748B'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        padding: 12,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 11 }, color: '#64748B', padding: 10 }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Revenue (₱)', font: { family: 'Inter', size: 11, weight: '600' }, color: '#64748B' },
                        grid: { color: 'rgba(148, 163, 184, 0.05)' },
                        ticks: { font: { family: 'Inter', size: 11 }, color: '#64748B' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Payment Count', font: { family: 'Inter', size: 11, weight: '600' }, color: '#64748B' },
                        grid: { drawOnChartArea: false },
                        ticks: { font: { family: 'Inter', size: 11 }, color: '#64748B' }
                    }
                }
            }
        });
    }
}

async function loadCashierStats() {
    try {
        const { count: customersCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        const { data: unpaid } = await supabase
            .from('billing')
            .select('id, balance')
            .eq('status', 'unpaid');
        
        const { data: overdue } = await supabase
            .from('billing')
            .select('id, balance')
            .eq('status', 'overdue');

        const { data: paid } = await supabase
            .from('billing')
            .select('id')
            .eq('status', 'paid');
        
        // Get today's date range in local timezone
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        const { data: collections } = await supabase
            .from('billing')
            .select('amount')
            .eq('status', 'paid')
            .gte('updated_at', todayStart.toISOString())
            .lte('updated_at', todayEnd.toISOString());

        document.getElementById('statTotalCustomers').textContent = (customersCount || 0).toLocaleString();
        
        // Unpaid
        const unpaidCount = unpaid ? unpaid.length : 0;
        const unpaidTotal = unpaid ? unpaid.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0) : 0;
        document.getElementById('statUnpaidBills').textContent = unpaidCount.toLocaleString();
        document.getElementById('statUnpaidAmount').textContent = `₱${unpaidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        
        // Overdue
        const overdueCount = overdue ? overdue.length : 0;
        const overdueTotal = overdue ? overdue.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0) : 0;
        document.getElementById('statOverdueBills').textContent = overdueCount.toLocaleString();
        document.getElementById('statOverdueAmount').textContent = `₱${overdueTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        
        const collectedToday = collections ? collections.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0) : 0;
        document.getElementById('statCollectedToday').textContent = `₱${collectedToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        // Update real-time chart (Pie)
        updateCashierChart({
            paid: paid ? paid.length : 0,
            unpaid: unpaid ? unpaid.length : 0,
            overdue: overdue ? overdue.length : 0
        });

        // Update real-time chart (Daily Trend - Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const { data: trendData } = await supabase
            .from('billing')
            .select('amount, updated_at')
            .eq('status', 'paid')
            .gte('updated_at', sevenDaysAgo.toISOString())
            .order('updated_at', { ascending: true });

        // Aggregate by day
        const dailyStats = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dailyStats[dateStr] = { amount: 0, count: 0 };
        }

        trendData?.forEach(bill => {
            const dateStr = new Date(bill.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (dailyStats[dateStr]) {
                dailyStats[dateStr].amount += parseFloat(bill.amount) || 0;
                dailyStats[dateStr].count += 1;
            }
        });

        const labels = Object.keys(dailyStats);
        updateDailyTrendChart({
            labels: labels,
            amounts: labels.map(l => dailyStats[l].amount),
            counts: labels.map(l => dailyStats[l].count)
        });

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadRecentCollections() {
    const body = document.getElementById('recentCollectionsBody');
    try {
        // 1. Fetch recent paid bills
        const { data: bills, error: billsError } = await supabase
            .from('billing')
            .select('*')
            .eq('status', 'paid')
            .order('id', { ascending: false })
            .limit(5);

        if (billsError) throw billsError;

        if (!bills || bills.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #9E9E9E;">No recent collections.</td></tr>';
            return;
        }

        // 2. Fetch related customers
        const customerIds = [...new Set(bills.map(b => b.customer_id))];
        const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('id, first_name, last_name')
            .in('id', customerIds);

        if (customerError) throw customerError;

        // Create a map
        const customerMap = {};
        customers.forEach(c => {
            customerMap[c.id] = c;
        });

        body.innerHTML = bills.map(bill => {
            const customer = customerMap[bill.customer_id] || { first_name: 'Unknown', last_name: 'Customer' };
            return `
            <tr>
                <td>${customer.last_name}, ${customer.first_name}</td>
                <td class="text-success">₱${parseFloat(bill.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td><span class="badge-status status-paid">PAID</span></td>
                <td>${new Date(bill.updated_at).toLocaleDateString()}</td>
            </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading recent collections:', error);
    }
}

async function loadCustomers() {
    const body = document.getElementById('customerTableBody');
    const search = document.getElementById('customerSearch')?.value || '';
    const status = document.getElementById('customerStatusFilter')?.value || '';
    const type = document.getElementById('customerTypeFilter')?.value || '';
    const barangay = document.getElementById('customerBarangayFilter')?.value || '';

    try {
        let query = supabase.from('customers').select('*');
        
        // Fetch all and filter client-side for better robustness
        const { data: customers, error } = await query.order('last_name');

        if (error) throw error;

        // Apply filtering client-side
        const filtered = customers.filter(c => {
            // Status filter
            if (status && c.status !== status) return false;
            // Type filter
            if (type && (c.customer_type || '').toLowerCase() !== type.toLowerCase()) return false;
            // Barangay filter (includes for partial matches)
            if (barangay && !(c.address || '').toLowerCase().includes(barangay.toLowerCase())) return false;
            
            // Search filter
            if (!search) return true;
            const term = search.toLowerCase();
            return (
                `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
                (c.meter_number || '').toLowerCase().includes(term) ||
                getAccountID(c.id).toLowerCase().includes(term) ||
                (c.address || '').toLowerCase().includes(term)
            );
        });

        body.innerHTML = filtered.map(c => {
            const displayName = `${c.last_name}, ${c.first_name}${c.middle_initial ? ' ' + c.middle_initial + '.' : ''}`;
            const hasDiscount = c.has_discount;
            
            return `
            <tr>
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
            </tr>
        `}).join('');
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

async function loadBilling() {
    const body = document.getElementById('billingTableBody');
    const search = document.getElementById('billingSearch')?.value || '';
    const status = document.getElementById('billingStatusFilter')?.value || '';
    const period = document.getElementById('billingMonthFilter')?.value || '';

    try {
        // 1. Fetch bills (No server-side filtering on period/status for robustness)
        const { data: bills, error: billsError } = await supabase
            .from('billing')
            .select('*')
            .order('id', { ascending: false });

        if (billsError) throw billsError;

        if (!bills || bills.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #9E9E9E;">No billing records found.</td></tr>';
            return;
        }

        // Auto-update overdue status
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (const bill of bills) {
            if (bill.status === 'unpaid' && new Date(bill.due_date) < today) {
                bill.status = 'overdue';
                supabase.from('billing').update({ status: 'overdue' }).eq('id', bill.id);
            }
        }

        // Apply Filters client-side (Robust to schema differences)
        const filteredBills = bills.filter(bill => {
            if (status && (bill.status || '').toLowerCase() !== status.toLowerCase()) return false;
            if (period && (bill.billing_period || '').toLowerCase() !== period.toLowerCase()) return false;
            
            // Barangay filter logic
            // We need to check if we have the customer data cached
            // Since billing doesn't include customer object here, we'll filter after mapping or use the bill.customer_id
            if (!search) return true;
            const term = search.toLowerCase();
            return (
                bill.id.toString().includes(term) ||
                (bill.billing_period || '').toLowerCase().includes(term)
            );
        });

        if (filteredBills.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #9E9E9E;">No billing records match filters.</td></tr>';
            return;
        }

        // 2. Fetch related customers
        const searchCustomerIds = [...new Set(filteredBills.map(b => b.customer_id))];
        const { data: searchCustomers, error: searchCustomerError } = await supabase
            .from('customers')
            .select('id, first_name, last_name, meter_number')
            .in('id', searchCustomerIds);

        if (searchCustomerError) throw searchCustomerError;

        const searchCustomerMap = {};
        searchCustomers.forEach(c => { searchCustomerMap[c.id] = c; });

        // Final Search & Barangay Filter (checks names and address)
        const finalResults = filteredBills.filter(bill => {
            const customer = searchCustomerMap[bill.customer_id];
            
            if (!search) return true;
            const term = search.toLowerCase();
            if (!customer) return bill.id.toString().includes(term);
            
            return (
                bill.id.toString().includes(term) ||
                `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(term) ||
                (customer.meter_number || '').toLowerCase().includes(term) ||
                getAccountID(customer.id).toLowerCase().includes(term)
            );
        });

        if (finalResults.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #9E9E9E;">No billing records match search.</td></tr>';
            return;
        }

        body.innerHTML = finalResults.map(bill => {
            const customer = searchCustomerMap[bill.customer_id] || { first_name: 'Unknown', last_name: 'Customer' };
            let statusClass = 'status-warning';
            if (bill.status === 'paid') statusClass = 'status-paid';
            if (bill.status === 'overdue') statusClass = 'status-danger';
            if (bill.status === 'unpaid') statusClass = 'status-unpaid';

            return `
                <tr>
                    <td>#${bill.id.toString().padStart(6, '0')}</td>
                    <td>${customer.last_name}, ${customer.first_name}</td>
                    <td>${bill.billing_period || 'N/A'}</td>
                    <td class="text-primary">₱${parseFloat(bill.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td><span class="badge-status ${statusClass}">${(bill.status || '').toUpperCase()}</span></td>
                    <td>
                        <div class="actions" style="display: flex; gap: 8px;">
                            ${bill.status !== 'paid' ? `
                                <button class="btn btn-sm btn-primary" onclick="window.cashierComponents.showPaymentModal('${bill.id}')">
                                    <i class="fas fa-cash-register"></i> Pay
                                </button>
                            ` : `
                                <button class="btn btn-sm btn-outline" onclick="window.showBillModal('${bill.id}')">
                                    <i class="fas fa-print"></i> Receipt
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading billing:', error.message || error);
        showNotification('Failed to load billing records', 'error');
    }
}

// === NAVIGATION ===
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('pageTitle');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            if (item.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const pageName = item.dataset.page;
                
                // Update active state
                navItems.forEach(n => n.classList.remove('active'));
                pages.forEach(p => p.classList.remove('active'));
                
                item.classList.add('active');
                const targetPage = document.getElementById(`${pageName}Page`);
                if (targetPage) {
                    targetPage.classList.add('active');
                    pageTitle.textContent = item.querySelector('span').textContent;
                }
                
                // Close mobile menu
                const sidebar = document.getElementById('sidebar');
                if (sidebar) sidebar.classList.remove('active');
            }
        });
    });
}

// === UTILS ===
function initializeMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    if (btn && sidebar) {
        btn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

function initializeLogout() {
    const btn = document.getElementById('logoutBtn');
    if (btn) {
        btn.addEventListener('click', async () => {
            if (confirm('Sign out from Cashier terminal?')) {
                await supabase.auth.signOut();
                window.location.href = '../index.html';
            }
        });
    }
}

function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('admin-theme') || 'light';
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-theme');
            localStorage.setItem('admin-theme', isDark ? 'dark' : 'light');
            themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }
}

// Re-expose needed functions for admin-components.js if necessary
window.showNotification = function(message, type) {
    // Simple notification implementation or reuse admin's
    console.log(`[${type}] ${message}`);
    // You might want to copy the notification logic from script.js or admin.js
};

async function loadPaymentsQueue() {
    const body = document.getElementById('paymentsQueueBody');
    try {
        // 1. Fetch pending payments
        const { data: payments, error: paymentsError } = await supabase
            .from('online_payments')
            .select('*')
            .eq('status', 'pending')
            .order('id', { ascending: true });

        if (paymentsError) throw paymentsError;

        if (!payments || payments.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #9E9E9E;">No pending online payments to verify.</td></tr>';
            return;
        }

        // 2. Fetch related customers
        const customerIds = [...new Set(payments.map(p => p.customer_id))];
        const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('id, first_name, last_name')
            .in('id', customerIds);

        if (customerError) throw customerError;

        // Create a map for easy lookup
        const customerMap = {};
        customers.forEach(c => {
            customerMap[c.id] = c;
        });

        body.innerHTML = payments.map(p => {
            const customer = customerMap[p.customer_id] || { first_name: 'Unknown', last_name: 'Customer' };
            return `
            <tr>
                <td><strong>${p.reference_number}</strong></td>
                <td>${customer.last_name}, ${customer.first_name}</td>
                <td>₱${parseFloat(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td><span class="badge platform-${p.platform}">${p.platform ? p.platform.toUpperCase() : 'N/A'}</span></td>
                <td><span class="badge-status status-pending">Pending</span></td>
                <td>
                    <div class="actions" style="display: flex; gap: 5px;">
                        <button class="btn btn-sm btn-primary" onclick="verifyPayment('${p.id}', 'approve')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="verifyPayment('${p.id}', 'reject')" title="Reject" style="color: #d32f2f; border-color: #d32f2f;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading payments queue:', error);
        showNotification('Failed to load payments queue', 'error');
    }
}

async function verifyPayment(paymentId, action) {
    if (!confirm(`Are you sure you want to ${action} this payment?`)) return;
    
    try {
        await window.cashierDb.verifyOnlinePayment(paymentId, action);
        showNotification(`Payment ${action}d successfully`, 'success');
        loadInitialData(); // Refresh everything
    } catch (error) {
        console.error(`Error ${action}ing payment:`, error);
        showNotification(`Failed to ${action} payment`, 'error');
    }
}

window.verifyPayment = verifyPayment;

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Fade out effect
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.2s ease';
        
        setTimeout(() => {
            modal.remove();
        }, 200);
    }
}
window.closeModal = closeModal;

async function loadBillingMonths() {
    const filter = document.getElementById('billingMonthFilter');
    if (!filter) return;

    try {
        const { data, error } = await supabase
            .from('billing')
            .select('billing_period');

        if (error) throw error;

        const periods = [...new Set(data.map(b => b.billing_period))].sort((a, b) => {
            // Sort by Date (YYYY-MM)
            return new Date(b) - new Date(a);
        });

        const currentVal = filter.value;
        filter.innerHTML = '<option value="">All Periods</option>' + 
            periods.map(p => `<option value="${p}" ${p === currentVal ? 'selected' : ''}>${p}</option>`).join('');
    } catch (error) {
        console.error('Error loading periods:', error);
    }
}
async function loadCollectionRecords() {
    const body = document.getElementById('collectionLogBody');
    const totalEl = document.getElementById('logTotalAmount');
    const countEl = document.getElementById('logTotalCount');
    const search = document.getElementById('logSearch')?.value || '';
    const dateFrom = document.getElementById('logDateFrom')?.value || '';
    const dateTo = document.getElementById('logDateTo')?.value || '';

    if (!body) return;

    try {
        // 1. Fetch Data (Optimized with cache if filters haven't changed much)
        // For now, fresh fetch to ensure real-time accuracy
        
        // Paid Cash Bills
        let cashQuery = supabase
            .from('billing')
            .select('id, amount, updated_at, customer_id')
            .eq('status', 'paid');
        
        if (dateFrom) cashQuery = cashQuery.gte('updated_at', `${dateFrom}T00:00:00`);
        if (dateTo) cashQuery = cashQuery.lte('updated_at', `${dateTo}T23:59:59`);

        // Verified Online Payments
        let onlineQuery = supabase
            .from('online_payments')
            .select('id, amount, reference_number, platform, updated_at, customer_id')
            .eq('status', 'verified');
        
        if (dateFrom) onlineQuery = onlineQuery.gte('updated_at', `${dateFrom}T00:00:00`);
        if (dateTo) onlineQuery = onlineQuery.lte('updated_at', `${dateTo}T23:59:59`);

        const [cashRes, onlineRes] = await Promise.all([cashQuery, onlineQuery]);
        
        if (cashRes.error) throw cashRes.error;
        if (onlineRes.error) throw onlineRes.error;

        // 2. Unify & Enrich with Customer Data
        const unified = [
            ...(cashRes.data || []).map(p => ({
                id: p.id,
                amount: p.amount,
                date: p.updated_at,
                method: 'Cash',
                ref: `#${p.id.toString().padStart(6, '0')}`,
                customer_id: p.customer_id
            })),
            ...(onlineRes.data || []).map(p => ({
                id: p.id,
                amount: p.amount,
                date: p.updated_at,
                method: p.platform ? p.platform.toUpperCase() : 'Online',
                ref: p.reference_number,
                customer_id: p.customer_id
            }))
        ];

        if (unified.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 4rem; color: #9E9E9E;"><i class="fas fa-history" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><br>No records found. Adjust your filters.</td></tr>';
            if (totalEl) totalEl.textContent = '₱0.00';
            if (countEl) countEl.textContent = '0';
            return;
        }

        const customerIds = [...new Set(unified.map(u => u.customer_id))];
        const { data: customers } = await supabase
            .from('customers')
            .select('id, first_name, last_name')
            .in('id', customerIds);

        const customerMap = {};
        customers?.forEach(c => { customerMap[c.id] = c; });

        // 3. Filter & Sort
        logDataCache = unified.map(u => {
            const customer = customerMap[u.customer_id];
            return {
                ...u,
                customerName: customer ? `${customer.last_name}, ${customer.first_name}` : 'Unknown Customer',
                accountID: getAccountID(u.customer_id)
            };
        }).filter(u => {
            if (!search) return true;
            const term = search.toLowerCase();
            return u.customerName.toLowerCase().includes(term) || 
                   u.accountID.toLowerCase().includes(term) ||
                   u.ref.toLowerCase().includes(term);
        });

        renderLogRecords();

    } catch (error) {
        console.error('Error loading records:', error);
    }
}

function renderLogRecords() {
    const body = document.getElementById('collectionLogBody');
    const totalEl = document.getElementById('logTotalAmount');
    const countEl = document.getElementById('logTotalCount');
    
    // Apply sorting
    const data = [...logDataCache].sort((a, b) => {
        let valA = a[logSortConfig.key];
        let valB = b[logSortConfig.key];
        
        if (logSortConfig.key === 'date') {
            valA = new Date(valA);
            valB = new Date(valB);
        }
        
        if (valA < valB) return logSortConfig.order === 'asc' ? -1 : 1;
        if (valA > valB) return logSortConfig.order === 'asc' ? 1 : -1;
        return 0;
    });

    let total = 0;
    let html = '';
    let lastDate = '';

    data.forEach(u => {
        total += parseFloat(u.amount);
        
        // Grouping logic
        const dateObj = new Date(u.date);
        const dateKey = dateObj.toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Relative text (Today, Yesterday)
        const today = new Date().toLocaleDateString();
        const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
        
        let label = dateKey;
        if (dateObj.toLocaleDateString() === today) label = 'Today';
        else if (dateObj.toLocaleDateString() === yesterday) label = 'Yesterday';

        if (label !== lastDate) {
            html += `<tr><td colspan="6" class="group-header">${label}</td></tr>`;
            lastDate = label;
        }

        const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        html += `
            <tr>
                <td><span class="time-badge">${time}</span></td>
                <td class="account-id">${u.accountID}</td>
                <td>${u.customerName}</td>
                <td class="text-success font-weight-bold">₱${parseFloat(u.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td><span class="badge ${u.method === 'Cash' ? 'secondary' : 'primary'}">${u.method}</span></td>
                <td><code style="font-size: 0.85rem;">${u.ref}</code></td>
            </tr>
        `;
    });

    if (totalEl) totalEl.textContent = `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (countEl) countEl.textContent = data.length.toLocaleString();
    if (body) body.innerHTML = html;
}

function setLogSort(key) {
    if (logSortConfig.key === key) {
        logSortConfig.order = logSortConfig.order === 'asc' ? 'desc' : 'asc';
    } else {
        logSortConfig.key = key;
        logSortConfig.order = (key === 'amount' || key === 'date') ? 'desc' : 'asc';
    }
    
    // Update headers UI
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('active');
        const icon = th.querySelector('i');
        if (icon) icon.className = 'fas fa-sort';
    });
    
    const activeHeader = document.querySelector(`.sortable[onclick*="${key}"]`);
    if (activeHeader) {
        activeHeader.classList.add('active');
        const icon = activeHeader.querySelector('i');
        if (icon) icon.className = `fas fa-sort-${logSortConfig.order === 'asc' ? 'up' : 'down'}`;
    }

    renderLogRecords();
}

function setQuickDate(range) {
    const fromEl = document.getElementById('logDateFrom');
    const toEl = document.getElementById('logDateTo');
    
    const now = new Date();
    let fromDate = '';
    let toDate = now.toISOString().split('T')[0];

    if (range === 'today') {
        fromDate = toDate;
    } else if (range === 'week') {
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);
        fromDate = lastWeek.toISOString().split('T')[0];
    } else if (range === 'all') {
        fromDate = '';
        toDate = '';
    }

    fromEl.value = fromDate;
    toEl.value = toDate;

    // Update buttons
    document.querySelectorAll('.quick-filters .btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(range));
    });

    loadCollectionRecords();
}

window.setLogSort = setLogSort;
window.setQuickDate = setQuickDate;
