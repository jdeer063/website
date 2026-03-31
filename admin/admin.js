// Admin Dashboard JavaScript
let customerSortConfig = { key: 'id', order: 'asc' };
let readingListSortConfig = { key: 'id', order: 'desc' };
let currentLedgerCustomerId = null; // Track which customer's ledger is open
let ledgerSource = 'master'; // Track if we came from 'master' ledger list or 'billing' table


// Pagination State
let customerPagination = { page: 1, pageSize: 20 };
let staffPagination = { page: 1, pageSize: 20 };
let billingPagination = { page: 1, pageSize: 20 };
let readingListPagination = { page: 1, pageSize: 20 };

function initializeSorting() {
    // Customer Table Sorting
    const customerHeaders = {
        'sortAccount': 'id',
        'sortName': 'last_name'
    };

    Object.entries(customerHeaders).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                if (customerSortConfig.key === key) {
                    customerSortConfig.order = customerSortConfig.order === 'asc' ? 'desc' : 'asc';
                } else {
                    customerSortConfig.key = key;
                    customerSortConfig.order = 'asc';
                }
                updateSortIndicators('customerTable', customerSortConfig);
                refreshCustomers();
            });
        }
    });

    // Reading List Table Sorting
    const readingHeaders = {
        'sortReadingAccount': 'customerId',
        'sortReadingName': 'fullName',
        'sortReadingDate': 'updated_at'
    };

    Object.entries(readingHeaders).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                if (readingListSortConfig.key === key) {
                    readingListSortConfig.order = readingListSortConfig.order === 'asc' ? 'desc' : 'asc';
                } else {
                    readingListSortConfig.key = key;
                    readingListSortConfig.order = 'asc';
                }
                updateSortIndicators('readingListTable', readingListSortConfig);
                updateReadingList();
            });
        }
    });

    // Initial indicators
    updateSortIndicators('customerTable', customerSortConfig);
    updateSortIndicators('readingListTable', readingListSortConfig);
}

function updateSortIndicators(tableId, config) {
    const headers = document.querySelectorAll(`#${tableId} .sort-icon`);
    headers.forEach(icon => icon.className = 'fas fa-sort sort-icon');

    const activeHeader = document.querySelector(`[data-sort-key="${config.key}"] .sort-icon`);
    if (activeHeader) {
        activeHeader.className = `fas fa-sort-${config.order === 'asc' ? 'up' : 'down'} sort-icon active`;
    }
}

function refreshCustomers(keepPage = false) {
    if (!keepPage) customerPagination.page = 1;

    const search = document.getElementById('customerSearch')?.value || '';
    const status = document.getElementById('customerStatusFilter')?.value || '';
    const type = document.getElementById('customerTypeFilter')?.value || '';
    const barangay = document.getElementById('customerBarangayFilter')?.value || '';

    if (window.dbOperations && window.dbOperations.loadCustomers) {
        return window.dbOperations.loadCustomers({
            search,
            status,
            type,
            barangay,
            sortBy: customerSortConfig.key,
            sortOrder: customerSortConfig.order,
            page: customerPagination.page,
            pageSize: customerPagination.pageSize
        });
    }
    return Promise.resolve();
}

// Pagination Callbacks
window.onCustomerPageChange = (page) => {
    customerPagination.page = page;
    refreshCustomers(true);
};
window.refreshCustomers = refreshCustomers; // Allow database.js to call with active filters

/**
 * Trigger refresh of Billing list with current filters
 */
function refreshBilling(keepPage = false) {
    if (!keepPage) billingPagination.page = 1;

    const searchStr = document.getElementById('billingSearch')?.value || '';
    const statusFilter = document.getElementById('billingStatusFilter')?.value || '';
    const monthFilter = document.getElementById('billingMonthFilter')?.value || '';
    const barangayFilter = document.getElementById('billingBarangayFilter')?.value || '';

    if (window.dbOperations && window.dbOperations.loadBilling) {
        return window.dbOperations.loadBilling({
            search: searchStr,
            status: statusFilter,
            month: monthFilter,
            barangay: barangayFilter,
            page: billingPagination.page,
            pageSize: billingPagination.pageSize
        });
    }
    return Promise.resolve();
}

// Billing Pagination Callback
window.onBillingPageChange = (page) => {
    billingPagination.page = page;
    refreshBilling(true);
};
// Reading List Pagination Callback
window.onReadingListPageChange = (page) => {
    readingListPagination.page = page;
    if (window.updateReadingList) {
        window.updateReadingList(true);
    }
};

window.refreshBilling = refreshBilling;

function refreshStaff(keepPage = false) {
    if (!keepPage) staffPagination.page = 1;

    const search = document.getElementById('staffSearch')?.value || '';
    const status = document.getElementById('staffStatusFilter')?.value || '';
    const role = document.getElementById('staffRoleFilter')?.value || '';

    if (window.dbOperations && window.dbOperations.loadStaff) {
        return window.dbOperations.loadStaff({
            search,
            status,
            role,
            page: staffPagination.page,
            pageSize: staffPagination.pageSize
        });
    }
    return Promise.resolve();
}

window.onStaffPageChange = (page) => {
    staffPagination.page = page;
    refreshStaff(true);
};


/**
 * Trigger refresh of Ledger views (Master or Individual)
 */
function refreshLedger() {
    // 1. Refresh Master ledger if active
    if (typeof updateLedger === 'function') {
        updateLedger();
    }

    // 2. Refresh Individual Card if open
    if (currentLedgerCustomerId && window.dbOperations && window.dbOperations.loadLedgerCard) {
        console.log(`[Realtime] Refreshing Ledger Card for Customer ${currentLedgerCustomerId}`);
        window.dbOperations.loadLedgerCard(currentLedgerCustomerId);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeMobileMenu();
    initializeModals();
    initializeTableActions();
    initializeSearchFilters(); // New
    initializeSettings(); // New
    initializeLogout();
    initializeTheme(); // Added theme support
    initializeSidebarToggle(); // Modern Sidebar Step 3
    initializeStatMarquee(); // Intelligent Marquee
    initializeRateEditing(); // Rate category cards

    // Initialize password toggles for static content (like Change Password modal)
    if (window.initPasswordToggles) {
        window.initPasswordToggles('body');
    }

    // Wait for auth verification before loading data
    document.addEventListener('auth-ready', () => {
        console.log('✅ Auth ready. Initializing dashboard data...');
        initializeSorting();
        initializeNotificationsUI(); // Initialize notification bell + dropdown
        loadInitialData();
    });
});

/**
 * Programmatically navigate to Billing page with optional filter
 * @param {string} statusFilter - Optional status filter to apply
 */
window.navigateToBilling = async function (statusFilter) {
    const billingNavItem = document.querySelector('.nav-item[data-page="billing"]');
    if (billingNavItem) {
        // 1. Manually set the filter value in the UI before navigating
        if (statusFilter) {
            const statusSelect = document.getElementById('billingStatusFilter');
            if (statusSelect) statusSelect.value = statusFilter;
        }

        // 2. Trigger the navigation click
        billingNavItem.click();
    }
};

async function loadInitialData() {
    console.log('🚀 Loading initial data...');
    try {
        // Check if Supabase client is ready
        if (!supabase || typeof supabase.from !== 'function') {
            console.error('❌ Supabase client not ready');
            showNotification('Database connection failed. Please refresh the page.', 'error');
            hideLoadingOverlay();
            return;
        }

        console.log('🚀 Parallel loading initial data...');

        // ===== SETUP REALTIME SUBSCRIPTIONS EARLY =====
        // We start these before the main load ensuring we catch any changes that happen during load
        setupRealtimeSubscriptions();

        // Use Promise.all for truly parallel execution of independent data fetches
        await Promise.all([
            window.dbOperations.loadDashboardStats(),
            window.dbOperations.loadRecentReadingsWidget(),
            refreshCustomers(),
            window.dbOperations.loadStaff(),
            refreshBilling(),
            window.dbOperations.loadAreaBoxes(),
            window.dbOperations.loadReadingList(), // Pre-fetch in background
            window.dbOperations.loadSystemSettings(), // Load system parameters
            window.dbOperations.loadAuditLogs(), // Pre-fetch audit trail
            loadNotifications() // Load latest alerts
        ]);

        // Fail-safe: Hide loading overlay after 5 seconds no matter what
        const failSafeTimer = setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay && !overlay.classList.contains('fade-out')) {
                console.warn('⚠️ Loading fail-safe triggered');
                hideLoadingOverlay();
            }
        }, 5000);

        console.log('✅ All initial data loaded in parallel');

        // Cinematic reveal
        if (window.refreshMarquee) window.refreshMarquee();
        setTimeout(() => {
            clearTimeout(failSafeTimer);
            hideLoadingOverlay();
        }, 200);
    } catch (error) {
        console.error('❌ Error in loadInitialData:', error);
        showNotification('Some data could not be loaded', 'warning');
        // Always hide overlay to prevent being stuck
        hideLoadingOverlay();
    }
}

function setupRealtimeSubscriptions() {
    if (!window.subscribeToTable) {
        console.warn('[Realtime] subscribeToTable not available');
        return;
    }

    // Subscribe to customers table
    subscribeToTable('customers', () => {
        refreshCustomers();
        refreshLedger(); // Update Master/Detail Ledger
        if (window.dbOperations && window.dbOperations.loadDashboardStats) {
            // Small delay for DELETE to ensure DB is updated
            setTimeout(() => window.dbOperations.loadDashboardStats(), 100);
        }
    });

    // Subscribe to notifications table for real-time alerts
    subscribeToTable('notifications', () => {
        console.log('[Realtime] 🔔 New notification detected');
        loadNotifications();
    });

    // Subscribe to staff table
    subscribeToTable('staff', () => {
        if (window.dbOperations && window.dbOperations.loadStaff) {
            window.dbOperations.loadStaff();
        }
        if (window.dbOperations && window.dbOperations.loadDashboardStats) {
            // Small delay for DELETE to ensure DB is updated
            setTimeout(() => window.dbOperations.loadDashboardStats(), 100);
        }
    });

    // Subscribe to billing table
    subscribeToTable('billing', (payload) => {
        console.log('[Realtime] 📊 Billing event received:', payload.eventType);
        // Small delay to let DB transaction commit before re-fetching
        setTimeout(() => {
            if (typeof refreshBilling === 'function') {
                refreshBilling(true);
            }
            if (window.dbOperations && window.dbOperations.loadDashboardStats) {
                window.dbOperations.loadDashboardStats();
            }
            if (window.dbOperations && window.dbOperations.loadRecentReadingsWidget) {
                window.dbOperations.loadRecentReadingsWidget();
            }
            if (window.dbOperations && window.dbOperations.loadRecentActivities) {
                window.dbOperations.loadRecentActivities();
            }

            refreshLedger(); // Update Master/Detail Ledger

            // REALTIME: Sync Reading List if visible
            if (typeof window.updateReadingList === 'function') {
                console.log('[Realtime] Refreshing Reading List...');
                window.updateReadingList();
            }
        }, 300);
    });

    // Subscribe to area_boxes (Scheduling)
    subscribeToTable('area_boxes', () => {
        if (window.dbOperations && window.dbOperations.loadAreaBoxes) {
            window.dbOperations.loadAreaBoxes();
        }
    });

    // Subscribe to system_settings table (THE BRAIN!)
    subscribeToTable('system_settings', () => {
        if (window.dbOperations && window.dbOperations.loadSettings) {
            window.dbOperations.loadSettings();
        }
    });

    // Subscribe to notifications for cutoff-done alerts
    subscribeToTable('notifications', (payload) => {
        console.log('[Realtime] Notification event received:', payload.eventType);

        // Trigger visual feedback only for NEW notifications
        if (payload.eventType === 'INSERT') {
            const bellBtn = document.getElementById('notificationBellBtn');
            if (bellBtn) {
                bellBtn.classList.remove('bell-ring');
                void bellBtn.offsetWidth; // Trigger reflow
                bellBtn.classList.add('bell-ring');
            }

            if (typeof showNotification === 'function' && payload.new && payload.new.message) {
                showNotification(payload.new.message, 'info');
            }
        }

        // Always refresh the list on any change (insert, update, delete)
        loadNotifications();
    });
}

function showLoadingOverlay(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        const textElement = overlay.querySelector('.loading-text h3');
        if (textElement) textElement.textContent = message;
        overlay.classList.remove('fade-out');
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('fade-out');
    }
}

// === NAVIGATION ===
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();


            // Unsaved Changes Guard - only check when LEAVING settings page
            const currentPage = document.querySelector('.page.active');
            const isLeavingSettings = currentPage && currentPage.id === 'settingsPage';

            if (!e.target._bypassUnsavedCheck && isLeavingSettings && window.hasUnsavedChanges) {
                e.preventDefault();
                showUnsavedChangesModal(() => {
                    // User confirmed discard - reset flag and navigate
                    window.hasUnsavedChanges = false;
                    const saveBtn = document.getElementById('saveSettingsBtn');
                    if (saveBtn) {
                        saveBtn.classList.remove('btn-warning');
                        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
                    }
                    // Bypass check on next click
                    item._bypassUnsavedCheck = true;
                    item.click();
                    // Reset bypass flag
                    setTimeout(() => { item._bypassUnsavedCheck = false; }, 100);
                });
                return; // Stop navigation until user decides
            }

            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));
            pages.forEach(page => page.classList.remove('active'));

            // Add active class to clicked
            item.classList.add('active');

            // Show corresponding page
            const pageName = item.dataset.page;
            const targetPage = document.getElementById(`${pageName}Page`);

            if (targetPage) {
                targetPage.classList.add('active');


                // Close mobile sidebar if open
                if (window.innerWidth <= 1024) {
                    const sidebar = document.getElementById('sidebar');
                    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
                    if (sidebar) sidebar.classList.remove('active');
                    if (mobileMenuBtn) {
                        mobileMenuBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
                    }
                }

                // Load data for specific pages
                if (pageName === 'scheduling') {
                    if (window.dbOperations && window.dbOperations.loadAreaBoxes) {
                        window.dbOperations.loadAreaBoxes();
                    }
                } else if (pageName === 'customers') {
                    refreshCustomers();
                } else if (pageName === 'staff') {
                    refreshStaff();
                } else if (pageName === 'billing') {
                    refreshBilling();
                } else if (pageName === 'readingList') {
                    const tbody = document.getElementById('readingListTableBody');
                    if (!tbody || tbody.children.length <= 1 || tbody.querySelector('.fa-spinner')) {
                        initializeReadingListPage();
                    }
                } else if (pageName === 'logs') {
                    if (window.dbOperations?.loadAuditLogs) {
                        window.dbOperations.loadAuditLogs();
                    }
                } else if (pageName === 'settings') {
                    if (window.dbOperations?.loadSystemSettings) {
                        window.dbOperations.loadSystemSettings();
                    }
                }
            }

            // Update page title
            const titles = {
                dashboard: 'Dashboard',
                customers: 'Customer Management',
                staff: 'Staff Management',
                billing: 'Billing Management',
                scheduling: 'Scheduling',
                ledger: 'Master Ledger',
                readingList: 'Meter Reading List',
                logs: 'Audit Trail',
                settings: 'System Settings'
            };
            pageTitle.textContent = titles[pageName] || 'Dashboard';

            if (pageName === 'ledger') {
                // Only reset to master if manually clicked by user
                // Programmatic clicks (from Billing) should keep their source
                if (e.isTrusted) {
                    ledgerSource = 'master';
                }
                initializeLedgerPage();
            }

            if (pageName === 'customers') {
                populateBarangayFilters('customerBarangayFilter');
            }

            if (pageName === 'scheduling') {
                window.dbOperations.loadAreaBoxes();
            }

            if (pageName === 'settings') {
                loadSystemSettingsIntoForm();
            }

            if (pageName === 'readingList') {
                initializeReadingListPage();
            }
        });
    });
}

let isReadingListUIInitialized = false;

function initializeReadingListPage() {
    if (isReadingListUIInitialized) return;

    console.log('🏗️ Initializing Reading List UI...');

    const searchInput = document.getElementById('readingListSearch');
    const periodFilter = document.getElementById('readingListPeriodFilter');
    const barangayFilter = document.getElementById('readingListBarangayFilter');
    const readerFilter = document.getElementById('readingListReaderFilter');
    const printBtn = document.getElementById('printReadingListBtn');

    // 1. Populate filters
    populateReadingListFilters();

    // 2. Event Listeners for filters
    const updateList = async (keepPage = false, isFullList = false) => {
        if (!keepPage) readingListPagination.page = 1;

        const period = periodFilter?.value || '';
        const readerId = readerFilter?.value || '';
        const barangay = barangayFilter?.value || '';
        const search = searchInput?.value || '';

        let targetBarangays = [];

        // 1. If a reader is selected, get their barangays
        try {
            if (readerId) {
                targetBarangays = await window.dbOperations.getBarangaysForReader(readerId);

                // If reader has assigned zones, and current barangay filter is not one of them, reset it
                if (barangay && !targetBarangays.includes(barangay)) {
                    barangayFilter.value = '';
                }
            }

            await window.dbOperations.loadReadingList({
                period,
                barangay,
                readerId,
                search,
                sortBy: readingListSortConfig.key,
                sortOrder: readingListSortConfig.order,
                page: readingListPagination.page,
                pageSize: readingListPagination.pageSize,
                fullList: isFullList
            });

            // 3. Update associated reader name for print
            if (readerId) {
                const readerOpt = readerFilter.options[readerFilter.selectedIndex];
                const readerName = readerOpt.text;
                if (document.getElementById('printReaderName')) document.getElementById('printReaderName').textContent = readerName;
            } else if (barangay) {
                const reader = await window.dbOperations.getReaderForBarangay(barangay);
                if (document.getElementById('printReaderName')) document.getElementById('printReaderName').textContent = reader;
            }

            if (period && document.getElementById('printPeriodName')) {
                document.getElementById('printPeriodName').textContent = period;
            }
            if (barangay && document.getElementById('printBarangayName')) {
                document.getElementById('printBarangayName').textContent = barangay;
            }
        } catch (error) {
            console.error('Error updating reading list:', error);
        }
    };

    // Expose update function globally for sorting to use
    window.updateReadingList = updateList;

    searchInput?.addEventListener('input', debounce(updateList, 300));
    periodFilter?.addEventListener('change', updateList);
    readerFilter?.addEventListener('change', updateList);

    barangayFilter?.addEventListener('change', async () => {
        const barangay = barangayFilter.value;
        if (barangay) {
            // Auto-sync Reader filter when Barangay is selected
            const readerId = await window.dbOperations.getReaderIdForBarangay(barangay);
            if (readerFilter) {
                readerFilter.value = readerId || '';
            }
        } else if (readerFilter) {
            // Reset to "All Readers" if "All Barangays" is selected
            readerFilter.value = '';
        }
        updateList();
    });

    // 3. Print Functionality
    if (printBtn) {
        printBtn.onclick = async () => {
            const period = periodFilter?.value || 'All Periods';
            const barangay = barangayFilter?.value || 'All Barangays';
            const reader = readerFilter?.options[readerFilter.selectedIndex]?.text || 'Not Assigned';

            // Update print header info
            if (document.getElementById('printPeriodName')) document.getElementById('printPeriodName').textContent = period;
            if (document.getElementById('printBarangayName')) document.getElementById('printBarangayName').textContent = barangay;
            if (document.getElementById('printReaderName')) document.getElementById('printReaderName').textContent = reader;
            if (document.getElementById('printReadingListStats')) {
                document.getElementById('printReadingListStats').textContent = `Generated on: ${formatLocalDateTime(new Date(), true, true)}`;
            }

            // Only require a period for professional reports, but let them print anyway if they want
            if (period === 'All Periods') {
                showNotification('Tip: Select a Period for a more professional report header.', 'info');
            }

            // Load full list for printing
            await updateList(true, true);

            document.body.classList.add('printing-reading-list');

            // Critical: Wait for layout to settle before printing
            // Increased delay to 800ms to ensure all professional styles and table content are rendered
            setTimeout(() => {
                window.print();

                // Cleanup after print dialog closes
                setTimeout(() => {
                    document.body.classList.remove('printing-reading-list');
                    // Restore pagination view
                    updateList(true, false);
                }, 500);
            }, 800);
        };
    }

    isReadingListUIInitialized = true;
}

async function populateReadingListFilters() {
    const periodSelect = document.getElementById('readingListPeriodFilter');
    const barangaySelect = document.getElementById('readingListBarangayFilter');
    const readerSelect = document.getElementById('readingListReaderFilter');

    if (!periodSelect || !barangaySelect || !readerSelect) return;

    // Populate Readers
    if (readerSelect && readerSelect.options.length <= 1) {
        const readers = await window.dbOperations.getAssignedReaders();
        readers.forEach(reader => {
            const opt = document.createElement('option');
            opt.value = reader.id;
            opt.textContent = reader.name;
            readerSelect.appendChild(opt);
        });
    }

    // Populate Barangays
    if (barangaySelect.options.length <= 1) {
        const barangays = window.dbOperations ?
            (window.dbOperations.PULUPANDAN_BARANGAYS || []) :
            (window.PULUPANDAN_BARANGAYS || []);

        barangays.forEach(bg => {
            const opt = document.createElement('option');
            opt.value = bg;
            opt.textContent = bg;
            barangaySelect.appendChild(opt);
        });
    }

    // Populate Periods (fetching from billing table unique periods and reading dates)
    // Now centralized in database.js for consistency across all pages
    if (window.dbOperations?.populateDynamicPeriodFilters) {
        await window.dbOperations.populateDynamicPeriodFilters();
    }
}

// === SIDEBAR & MOBILE MENU ===
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');

    // Mobile Menu Toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !mobileMenuBtn?.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        }
    });
}

// === MODALS ===
function initializeModals() {
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    const addStaffBtn = document.getElementById('addStaffBtn');

    if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', () => window.showCustomerModal());
    }
    if (addStaffBtn) {
        addStaffBtn.addEventListener('click', () => window.showStaffModal());
    }

    // Scheduling delegation
    document.addEventListener('click', (e) => {
        const addBoxBtn = e.target.closest('#openAddBoxModal');
        if (addBoxBtn) window.showAddBoxModal();
    });
}

function initializeTableActions() {
    console.log('Initializing table actions delegation...');
    // Filter Buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Map data attributes to refreshCustomers logic
            const statusFilter = document.getElementById('customerStatusFilter');
            if (statusFilter) {
                statusFilter.value = btn.dataset.filter === 'all' ? '' : btn.dataset.filter;
                refreshCustomers();
            } else {
                window.dbOperations.loadCustomers(btn.dataset.filter);
            }
        });
    });

    // Event delegation for all table buttons
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-icon[title="Edit"]');
        const deleteBtn = e.target.closest('.btn-icon[title="Delete"]');
        const viewBtn = e.target.closest('.btn-icon[title="View"]'); // Staff/Customer view if any
        const viewBillBtn = e.target.closest('.btn-icon[title="View Bill"]');
        const ledgerBtn = e.target.closest('.btn-icon[title="View Ledger"]');
        const changePasswordBtn = e.target.closest('.btn-icon.change-password');

        if (editBtn) {
            console.log('Edit button clicked', editBtn);
            handleEdit(editBtn);
        } else if (deleteBtn) {
            console.log('Delete button clicked', deleteBtn);
            handleDelete(deleteBtn);
        } else if (viewBillBtn) {
            console.log('View Bill button clicked', viewBillBtn);
            handleViewBill(viewBillBtn);
        } else if (ledgerBtn) {
            console.log('Ledger button clicked', ledgerBtn);
            handleViewLedger(ledgerBtn);
        } else if (changePasswordBtn) {
            console.log('Change Password button clicked', changePasswordBtn);
            handleChangePassword(changePasswordBtn);
        } else if (viewBtn) {
            // Generic view or legacy view
        }
    });
}

// ... existing handleEdit ...
function handleEdit(button) {
    const row = button.closest('tr');
    const customerId = row.dataset.id;
    const cells = row.querySelectorAll('td');

    // Determine which table we're in
    const table = button.closest('table');
    const tableBody = table.querySelector('tbody');

    if (tableBody.id === 'customerTableBody') {
        window.editCustomer(customerId, row, cells);
    } else if (tableBody.id === 'staffTableBody') {
        window.editStaff(customerId, row, cells);
    }
}

function handleDelete(button) {
    const row = button.closest('tr');
    const id = row.dataset.id;
    const cells = row.querySelectorAll('td');
    const name = cells[1].textContent;

    // Determine which table we're in
    const table = button.closest('table');
    const tableBody = table.querySelector('tbody');

    let itemType = 'item';
    let deleteFunction = null;

    if (tableBody.id === 'customerTableBody') {
        itemType = 'customer';
        deleteFunction = window.dbOperations.deleteCustomer;
    } else if (tableBody.id === 'staffTableBody') {
        itemType = 'staff member';
        deleteFunction = window.dbOperations.deleteStaff;
    }

    window.showConfirmModal({
        title: `Delete ${itemType}?`,
        message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        confirmText: 'Delete Forever',
        onConfirm: async () => {
            // Animate row removal
            row.style.transition = 'all 0.3s ease';
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';

            setTimeout(async () => {
                try {
                    await deleteFunction(id, name);
                    window.showNotification(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted successfully!`, 'success');
                } catch (error) {
                    console.error(`Failed to delete ${itemType}:`, error);
                    row.style.opacity = '1';
                    row.style.transform = 'translateX(0)';
                    window.showNotification(`Failed to delete ${itemType}`, 'error');
                }
            }, 300);
        }
    });
}

function handleChangePassword(button) {
    const row = button.closest('tr');
    if (!row) {
        console.error('Could not find row for Change Password button');
        return;
    }

    const staffId = row.dataset.id;
    const firstName = row.dataset.firstName || '';
    const lastName = row.dataset.lastName || '';

    console.log(`Opening password modal for ${firstName} ${lastName} (#${staffId})`);

    // Store staff ID in modal for form submission
    const modal = document.getElementById('changePasswordModal');
    if (!modal) {
        console.error('FATAL: changePasswordModal not found in DOM!');
        if (window.showNotification) window.showNotification('System error: Password modal missing', 'error');
        return;
    }

    modal.dataset.staffId = staffId;

    // Update modal title with staff name
    const nameLabel = document.getElementById('changePasswordStaffName');
    if (nameLabel) {
        nameLabel.textContent = `Changing password for: ${firstName} ${lastName}`;
    }

    // Clear form
    const form = document.getElementById('changePasswordForm');
    if (form) {
        form.reset();
    } else {
        // Fallback if form not found
        const newPass = document.getElementById('newPassword');
        const confirmPass = document.getElementById('confirmPassword');
        if (newPass) newPass.value = '';
        if (confirmPass) confirmPass.value = '';
    }

    // Show modal
    if (window.openModal) {
        window.openModal('changePasswordModal');
    } else {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

async function handlePasswordChange(event) {
    event.preventDefault();

    const modal = document.getElementById('changePasswordModal');
    if (!modal) {
        console.error('Password modal missing during submission');
        return;
    }

    const staffId = modal.dataset.staffId;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!staffId) {
        if (window.showNotification) window.showNotification('Error: Missing staff ID', 'error');
        return;
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        if (window.showNotification) window.showNotification('Passwords do not match', 'error');
        return;
    }

    // Validate minimum length
    if (newPassword.length < 6) {
        if (window.showNotification) window.showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        if (window.dbOperations && window.dbOperations.changeStaffPassword) {
            await window.dbOperations.changeStaffPassword(staffId, newPassword);
            if (window.showNotification) window.showNotification('Password updated successfully', 'success');
        } else {
            console.error('dbOperations.changeStaffPassword not found');
            if (window.showNotification) window.showNotification('System error: database function missing', 'error');
        }
    } catch (error) {
        console.error('Password change failed:', error);
        if (window.showNotification) window.showNotification(error.message || 'Failed to update password', 'error');
    }
}


function handleViewBill(button) {
    const row = button.closest('tr');
    const billId = row.dataset.id;
    showBillModal(billId);
}



// Table action handlers moved to initializeTableActions

async function handleViewLedger(button) {
    const row = button.closest('tr');
    const customerId = row.dataset.customerId;
    ledgerSource = 'billing'; // Track source for back button

    if (!customerId) {
        // Fallback for bills without data-customer-id (shouldn't happen with latest database.js)
        const billId = row.dataset.id;
        try {
            const { data: bill, error } = await supabase
                .from('billing')
                .select('customer_id')
                .eq('id', billId)
                .maybeSingle();

            if (error || !bill) throw new Error('Could not find customer');
            window.viewCustomerLedger(bill.customer_id);
        } catch (e) {
            console.error(e);
            showNotification('Failed to open ledger.', 'error');
        }
        return;
    }

    window.viewCustomerLedger(customerId);
}

// Update User Info from Database
async function updateUserInfo() {
    try {
        // Use cached authUser from auth-guard.js to avoid Supabase lock contention
        let user = window.authUser;
        let sessionData = null;

        if (!user) {
            // If not found in window, try one last time from session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || !session.user) return;
            user = session.user;
            sessionData = session;
        }

        // Use cached userProfile if available
        let profile = window.userProfile;
        let fetchError = null;

        if (!profile) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            profile = data;
            fetchError = error;
        }

        if (fetchError || !profile) {
            console.error('Failed to load profile for admin:', fetchError);
            // Fallback to email if profile missing
            const email = user.email || 'Admin';
            const namePart = email.split('@')[0];
            const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

            const userNameEl = document.querySelector('.user-name');
            const avatarEl = document.querySelector('.user-avatar');

            if (userNameEl) userNameEl.textContent = displayName;
            if (avatarEl) avatarEl.textContent = displayName.charAt(0);
            return;
        }

        const displayName = `${profile.first_name} ${profile.last_name}`;
        const userNameEl = document.querySelector('.user-name');
        const avatarEl = document.querySelector('.user-avatar');

        if (userNameEl) userNameEl.textContent = displayName;
        if (avatarEl) avatarEl.textContent = (profile.first_name || 'A').charAt(0).toUpperCase();

        console.log('Admin UI updated with real profile:', displayName);
    } catch (err) {
        console.error('Error updating admin info:', err);
    }
}

updateUserInfo();

console.log('Admin dashboard initialized');

// === AUTO ASSIGN BUTTONS ===
function initializeAutoAssign() {
    // Auto-Fill (Optional Action)
    const autoBtn = document.getElementById('autoDistributeBtn');
    if (autoBtn) {
        autoBtn.addEventListener('click', async () => {
            if (confirm('Randomly distribute readers to all areas? This will overwrite existing assignments.')) {
                // Pass true = Auto-Distribute
                if (window.dbOperations && window.dbOperations.autoAssignReaders) {
                    await window.dbOperations.autoAssignReaders(true);
                }
            }
        });
    }
}
// === SYSTEM SETTINGS ===
window.handlePendingChanges = function (hasChanges) {
    const syncBar = document.getElementById('settingsSyncIndicator');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const unsavedIndicator = document.getElementById('unsavedChangesIndicator'); // Legacy fallback
    const unsavedMsgTop = document.getElementById('unsavedMsgTop');

    if (hasChanges) {
        window.hasUnsavedChanges = true;
        if (syncBar) {
            syncBar.style.opacity = '1';
            syncBar.style.transform = 'scaleX(0.4)';
            syncBar.style.background = 'var(--card-accent-1)';
        }
        if (unsavedIndicator) {
            unsavedIndicator.style.display = 'flex';
        }
        if (unsavedMsgTop) {
            unsavedMsgTop.style.display = 'flex';
        }
        if (saveBtn) {
            saveBtn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.3)';
            saveBtn.classList.add('pulse-active');
        }
    } else {
        window.hasUnsavedChanges = false;
        if (syncBar) {
            setTimeout(() => {
                if (!window.hasUnsavedChanges) {
                    syncBar.style.opacity = '0';
                    syncBar.style.transform = 'scaleX(0)';
                }
            }, 1000);
        }
        if (unsavedIndicator) {
            unsavedIndicator.style.display = 'none';
        }
        if (unsavedMsgTop) {
            unsavedMsgTop.style.display = 'none';
        }
        if (saveBtn) {
            saveBtn.style.boxShadow = 'none';
            saveBtn.classList.remove('pulse-active');
        }
    }
};

function initializeSettings() {
    const changePINBtn = document.getElementById('changePINBtn');
    const saveBtn = document.getElementById('saveSettingsBtn');

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            // Security gate before saving
            showPINVerifyModal(async () => {
                const originalContent = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                saveBtn.disabled = true;

                try {
                    const syncBar = document.getElementById('settingsSyncIndicator');
                    if (syncBar) {
                        syncBar.style.transform = 'scaleX(0.7)';
                        syncBar.style.background = '#3B82F6';
                        syncBar.style.opacity = '1';
                    }

                    await saveSettingsChanges();

                    showNotification('System settings updated successfully', 'success');
                    handlePendingChanges(false);

                    if (syncBar) {
                        syncBar.style.transform = 'scaleX(1)';
                        syncBar.style.background = '#10B981';
                        setTimeout(() => {
                            syncBar.style.opacity = '0';
                            setTimeout(() => syncBar.style.transform = 'scaleX(0)', 400);
                        }, 1500);
                    }
                } catch (err) {
                    console.error('Save failed:', err);
                    showNotification('Failed to save settings: ' + err.message, 'error');
                    const syncBar = document.getElementById('settingsSyncIndicator');
                    if (syncBar) syncBar.style.background = '#EF4444';
                } finally {
                    saveBtn.innerHTML = originalContent;
                    saveBtn.disabled = false;
                }
            });
        });
    }

    if (changePINBtn) {
        changePINBtn.addEventListener('click', () => {
            showChangePINModal();
        });
    }
}

window.showPINVerifyModal = function (onConfirm) {
    const modalHTML = `
        <div class="premium-modal-overlay" id="verifyPINModal">
            <div class="ec-modal-card" style="width: 440px;">
                <div class="ec-header-bar" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2);">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <h3 class="ec-title">Security Verification</h3>
                            <p class="ec-subtitle">Authorized personnel only</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('verifyPINModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="ec-body" style="padding: 2.5rem 2.25rem;">
                    <form id="verifyPINForm" class="ec-form-grid">
                        <div class="ec-field">
                            <label class="ec-label">System Admin PIN</label>
                            <input type="password" id="verifyPINInput" class="ec-input" 
                                   style="text-align: center; font-size: 2rem; letter-spacing: 0.8rem; font-family: 'JetBrains Mono', monospace; height: 70px;"
                                   placeholder="••••" required maxlength="6" inputmode="numeric" pattern="[0-9]*" />
                             <p style="font-size: 0.8rem; color: var(--ec-text-muted); text-align: center; margin-top: 0.75rem;">
                                Enter your 4-6 digit security PIN to proceed
                             </p>
                        </div>
                        
                        <div class="ec-footer" style="padding: 1.5rem 0 0 0; margin-top: 1rem;">
                            <button type="button" class="ec-btn-ghost" onclick="closeModal('verifyPINModal')" style="flex: 1;">Cancel</button>
                            <button type="submit" class="ec-btn-danger" style="flex: 1.5; justify-content: center;">
                                <i class="fas fa-check-circle"></i> Verify Identity
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    // Activation logic for visibility
    const modal = document.getElementById('verifyPINModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    const input = document.getElementById('verifyPINInput');
    input.focus();

    // Initialize password toggle
    // PIN inputs don't need eye toggle (keeps dots centered)

    document.getElementById('verifyPINForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        btn.disabled = true;

        try {
            const isVerified = await window.dbOperations.verifyAdminPIN(input.value);

            if (isVerified) {
                closeModal('verifyPINModal');
                onConfirm();
            } else {
                btn.innerHTML = originalText;
                btn.disabled = false;
                showNotification('Incorrect PIN. Access Denied.', 'error');

                // Shake effect
                const card = document.querySelector('#verifyPINModal .ec-modal-card');
                if (card) {
                    card.classList.remove('shake-glitch');
                    void card.offsetWidth; // trigger reflow
                    card.classList.add('shake-glitch');
                }
                input.value = '';
                input.focus();
            }
        } catch (error) {
            console.error('PIN verification error:', error);
            btn.innerHTML = originalText;
            btn.disabled = false;
            showNotification('Error verifying PIN.', 'error');
        }
    });
};

window.showChangePINModal = function () {
    const modalHTML = `
        <div class="premium-modal-overlay" id="changePINModal">
            <div class="ec-modal-card" style="width: 460px;">
                <div class="ec-header-bar" style="background: linear-gradient(135deg, #10b981, #059669);">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2);">
                            <i class="fas fa-key"></i>
                        </div>
                        <div>
                            <h3 class="ec-title">Update System PIN</h3>
                            <p class="ec-subtitle">Configure a new security code</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('changePINModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="ec-body" style="padding: 2rem 2.25rem;">
                    <form class="ec-form-grid" id="changePINForm">
                        <div class="ec-field">
                            <label class="ec-label" style="color: #10b981;">Current Admin PIN</label>
                            <input type="password" id="currentPIN" class="ec-input" 
                                   style="text-align: center; font-size: 1.5rem; letter-spacing: 0.5rem; font-family: 'JetBrains Mono', monospace;"
                                   required maxlength="6" 
                                   inputmode="numeric" pattern="[0-9]*" placeholder="••••" />
                            <div style="text-align: right; margin-top: 4px;">
                                <a href="#" id="forgotPINLink" class="forgot-link-elegant">Forgot PIN?</a>
                            </div>
                        </div>

                        <div class="ec-form-grid ec-col-2" style="margin-top: 0.5rem;">
                            <div class="ec-field">
                                <label class="ec-label" style="color: #10b981;">New PIN</label>
                                <input type="password" id="newPIN" class="ec-input" 
                                       style="text-align: center; font-size: 1.2rem; letter-spacing: 0.3rem; font-family: 'JetBrains Mono', monospace;"
                                       required maxlength="6" 
                                       inputmode="numeric" pattern="[0-9]*" placeholder="••••" />
                            </div>
                            <div class="ec-field">
                                <label class="ec-label" style="color: #10b981;">Confirm PIN</label>
                                <input type="password" id="confirmPIN" class="ec-input" 
                                       style="text-align: center; font-size: 1.2rem; letter-spacing: 0.3rem; font-family: 'JetBrains Mono', monospace;"
                                       required maxlength="6" 
                                       inputmode="numeric" pattern="[0-9]*" placeholder="••••" />
                            </div>
                        </div>
                        
                        <div class="ec-footer" style="padding: 1.5rem 0 0 0; margin-top: 1rem;">
                            <button type="button" class="ec-btn-ghost" onclick="closeModal('changePINModal')" style="flex: 1;">Cancel</button>
                            <button type="submit" class="ec-btn-success" style="flex: 1.5; justify-content: center;">
                                <i class="fas fa-save"></i> Apply New PIN
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    // Activation logic for visibility
    const modal = document.getElementById('changePINModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    // Initialize password toggles
    // PIN inputs don't need eye toggle (keeps dots centered)

    // Forgot PIN Link
    document.getElementById('forgotPINLink').addEventListener('click', (e) => {
        e.preventDefault();
        closeModal('changePINModal');
        setTimeout(() => showForgotPINModal(), 350);
    });

    document.getElementById('changePINForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPIN = document.getElementById('currentPIN').value;
        const newPIN = document.getElementById('newPIN').value;
        const confirmPIN = document.getElementById('confirmPIN').value;

        if (newPIN.length < 4 || newPIN.length > 6) {
            showNotification('New PIN must be 4 to 6 digits.', 'error');
            return;
        }

        if (newPIN !== confirmPIN) {
            showNotification('New PINs do not match.', 'error');
            return;
        }

        // Direct update with internal verification
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        btn.disabled = true;

        try {
            const success = await window.dbOperations.updateAdminPIN(newPIN, currentPIN);
            if (success) {
                showNotification('System PIN updated successfully', 'success');
                closeModal('changePINModal');
                await loadSystemSettingsIntoForm();
            } else {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('Failed to update PIN:', error);
            showNotification(error.message || 'Failed to update PIN', 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

window.showForgotPINModal = function () {
    const modalHTML = `
        <div class="premium-modal-overlay" id="forgotPINModal">
            <div class="ec-modal-card" style="width: 440px;">
                <div class="ec-header-bar" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2);">
                            <i class="fas fa-user-shield"></i>
                        </div>
                        <div>
                            <h3 class="ec-title">Identity Verification</h3>
                            <p class="ec-subtitle">Secured Administrator Access</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('forgotPINModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="ec-body" style="padding: 2rem 2.25rem;">
                    <form class="ec-form-grid" id="forgotPINForm">
                        <div class="ec-field">
                            <label class="ec-label">Administrator Password</label>
                            <div class="password-input-wrapper-elegant">
                                <input type="password" id="adminPasswordCheck" class="ec-input" required placeholder="••••••••" style="padding-right: 50px;" />
                                <button type="button" class="password-toggle-btn" onclick="togglePasswordVisibility('adminPasswordCheck', this)">
                                    <i class="far fa-eye"></i>
                                </button>
                            </div>
                            <p style="font-size: 0.8rem; color: var(--ec-text-muted); margin-top: 0.75rem;">
                                Please confirm your account password to reveal the system PIN.
                            </p>
                        </div>
                        
                        <div class="ec-footer" style="padding: 1.5rem 0 0 0; margin-top: 1rem;">
                            <button type="button" class="ec-btn-ghost" onclick="closeModal('forgotPINModal')" style="flex: 1;">Cancel</button>
                            <button type="submit" class="ec-btn-primary" style="flex: 1.5; justify-content: center;">
                                <i class="fas fa-unlock-alt"></i> Verify Identity
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    // Activation logic for visibility
    const modal = document.getElementById('forgotPINModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    if (window.initPasswordToggles) {
        window.initPasswordToggles('#forgotPINModal');
    }

    document.getElementById('forgotPINForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('adminPasswordCheck').value;
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        btn.disabled = true;

        try {
            // Get current user email
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Session expired. Please log in again.');

            // Verify password by re-authenticating
            // Note: In a production app, you might have a dedicated RPC for this, 
            // but signing in again is a common way to verify password client-side if no direct 'verify' endpoint exists.
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password
            });

            if (authError) {
                throw new Error('Incorrect password. Identity verification failed.');
            }

            // Success! Show the current PIN and allow reset
            const { data: settings, error: sError } = await supabase
                .from('system_settings')
                .select('admin_pin')
                .maybeSingle();

            if (sError) throw sError;

            const currentPIN = (settings && settings.admin_pin && settings.admin_pin !== '$2b$10$YourHashedPINHere') ? settings.admin_pin : '1234';

            // Switch to Success Modal
            showPINRevealModal(currentPIN);

        } catch (error) {
            console.error('Verification failed:', error);
            showNotification(error.message, 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
};

window.showPINRevealModal = function (pin) {
    const modalHTML = `
        <div class="premium-modal-overlay" id="pinRevealModal">
            <div class="ec-modal-card" style="width: 440px;">
                <div class="ec-header-bar" style="background: linear-gradient(135deg, #10b981, #059669);">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2);">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div>
                            <h3 class="ec-title">Identity Verified</h3>
                            <p class="ec-subtitle">Security Access Granted</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('pinRevealModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="ec-body" style="padding: 2.25rem;">
                    <p style="font-size: 0.95rem; color: var(--ec-text-muted); text-align: center; margin-bottom: 1.5rem;">
                        Your current system security PIN is shown below:
                    </p>
                    
                    <div class="reveal-box-premium" style="margin: 1.5rem 0;">
                        <span class="reveal-label-premium">Active System PIN</span>
                        <div class="reveal-value-premium" style="font-size: 3.5rem; letter-spacing: 0.8rem; height: 80px; display: flex; align-items: center; justify-content: center;">${pin}</div>
                    </div>
                    
                    <p style="font-size: 0.85rem; color: var(--ec-text-muted); text-align: center; line-height: 1.6; margin-top: 1rem;">
                        You can now proceed to update this PIN or keep it for your records.
                    </p>
                    
                    <div class="ec-footer" style="padding: 1.5rem 0 0 0; margin-top: 1.5rem;">
                        <button type="button" class="ec-btn-ghost" onclick="closeModal('pinRevealModal')" style="flex: 1;">Done</button>
                        <button type="button" class="ec-btn-success" onclick="closeModal('pinRevealModal'); setTimeout(() => showChangePINModal(), 350)" style="flex: 1.5; justify-content: center;">
                            <i class="fas fa-redo"></i> Reset PIN Now
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    // Activation logic for visibility
    const modal = document.getElementById('pinRevealModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
};

async function loadSystemSettingsIntoForm() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    try {
        if (!window.dbOperations || !window.dbOperations.loadSystemSettings) return;

        if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

        window.currentSettings = await window.dbOperations.loadSystemSettings();

        if (window.currentSettings) {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val !== undefined && val !== null ? val : 0;
            };

            setVal('base_rate', window.currentSettings.base_rate);
            setVal('tier1_threshold', window.currentSettings.tier1_threshold);
            setVal('tier1_rate', window.currentSettings.tier1_rate);
            setVal('tier2_threshold', window.currentSettings.tier2_threshold);
            setVal('tier2_rate', window.currentSettings.tier2_rate);
            setVal('tier3_rate', window.currentSettings.tier3_rate);
            setVal('settingDiscount', window.currentSettings.discount_percentage);
            setVal('settingPenalty', window.currentSettings.penalty_percentage || 20);
            setVal('settingOverdueDays', window.currentSettings.overdue_days !== undefined ? window.currentSettings.overdue_days : 14);

            // Try cutoff_grace_period first, then total cutoff_days
            let graceValue = 3;
            if (window.currentSettings.cutoff_grace_period !== undefined) {
                graceValue = window.currentSettings.cutoff_grace_period;
            } else if (window.currentSettings.cutoff_days !== undefined) {
                graceValue = window.currentSettings.cutoff_days;
            }
            setVal('settingCutoffGrace', graceValue);
        }

        // Live Rate Schedules Refresh
        try {
            const schedules = await window.dbOperations.loadRateSchedules();
            schedules.forEach(s => {
                const key = s.category_key;
                const minEl = document.querySelector(`[data-rate="${key}-minimum"]`);
                const t1El = document.querySelector(`[data-rate="${key}-tier1"]`);
                const t2El = document.querySelector(`[data-rate="${key}-tier2"]`);
                const t3El = document.querySelector(`[data-rate="${key}-tier3"]`);
                const t4El = document.querySelector(`[data-rate="${key}-tier4"]`);

                if (minEl) minEl.textContent = `₱${parseFloat(s.min_charge_1_2).toFixed(2)}`;
                if (t1El) t1El.textContent = `₱${parseFloat(s.tier1_rate * s.factor).toFixed(2)}`;
                if (t2El) t2El.textContent = `₱${parseFloat(s.tier2_rate * s.factor).toFixed(2)}`;
                if (t3El) t3El.textContent = `₱${parseFloat(s.tier3_rate * s.factor).toFixed(2)}`;
                if (t4El) t4El.textContent = `₱${parseFloat(s.tier4_rate * s.factor).toFixed(2)}`;
            });
        } catch (err) {
            console.error('Failed to load rates for dashboard:', err);
        }

        // Ensure edit buttons are wired up
        if (typeof initializeRateEditing === 'function') {
            initializeRateEditing();
        }

        // Clear pending flags
        window.hasUnsavedChanges = false;

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save" style="margin-right: 8px;"></i> <span>Save Changes</span>';
            saveBtn.style.display = 'flex';
        }

        // Apply change listeners to all settings inputs
        const settingsInputs = [
            'base_rate', 'tier1_threshold', 'tier1_rate', 'tier2_threshold',
            'tier2_rate', 'tier3_rate', 'settingDiscount', 'settingPenalty',
            'settingOverdueDays', 'settingCutoffGrace'
        ];

        settingsInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                // Ensure inputs are enabled by default
                input.disabled = false;

                if (!input.dataset.changeListenerAdded) {
                    input.addEventListener('input', () => {
                        handlePendingChanges(true);
                    });
                    input.dataset.changeListenerAdded = 'true';
                }
            }
        });
    } catch (error) {
        console.error('Error loading settings into form:', error);
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error: ' + (error.message || 'Retry Load');
            saveBtn.classList.remove('btn-primary');
            saveBtn.classList.add('btn-danger');
        }
        if (window.showNotification) {
            window.showNotification('System Error: ' + error.message, 'error');
        }
    }
}

async function saveSettingsChanges() {
    try {
        const getVal = (id, isFloat = true) => {
            const el = document.getElementById(id);
            if (!el || !el.value) return 0;
            const val = isFloat ? parseFloat(el.value) : parseInt(el.value);
            return isNaN(val) ? 0 : val;
        };

        const updatedData = {
            id: window.currentSettings.id
        };

        // Core columns that should always exist
        const coreMappings = {
            'base_rate': 'base_rate',
            'tier1_threshold': 'tier1_threshold',
            'tier1_rate': 'tier1_rate',
            'tier2_threshold': 'tier2_threshold',
            'tier2_rate': 'tier2_rate',
            'tier3_rate': 'tier3_rate',
            'settingDiscount': 'discount_percentage',
            'settingPenalty': 'penalty_percentage'
        };

        for (const [inputId, colName] of Object.entries(coreMappings)) {
            if (colName in window.currentSettings) {
                updatedData[colName] = getVal(inputId, inputId.includes('threshold') ? false : true);
            }
        }

        // Evolved columns with variable names
        if ('overdue_days' in window.currentSettings) {
            updatedData.overdue_days = getVal('settingOverdueDays', false);
        }

        if ('cutoff_grace_period' in window.currentSettings) {
            updatedData.cutoff_grace_period = getVal('settingCutoffGrace', false);
        } else if ('cutoff_days' in window.currentSettings) {
            // Map the grace period input to cutoff_days if grace_period column doesn't exist
            updatedData.cutoff_days = getVal('settingCutoffGrace', false);
        }

        console.log('Pushing Settings Update:', updatedData);
        await window.dbOperations.updateSystemSettings(updatedData);
        window.currentSettings = updatedData;
        console.log('Settings auto-saved');

        // Reset unsaved flag
        window.hasUnsavedChanges = false;
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

// === UNSAVED CHANGES CHECKER ===
window.checkUnsavedChanges = function () {
    if (window.hasUnsavedChanges) return true;

    // Optional: Deep compare logic if we want to catch manual input changes without explicit flags
    const current = window.currentSettings;
    if (!current) return false;

    // Check policies
    const getVal = (id) => document.getElementById(id)?.value;

    if (getVal('settingDiscount') != current.discount_percentage) return true;
    if (getVal('settingPenalty') != (current.penalty_percentage || 20)) return true;
    if (getVal('settingOverdueDays') != (current.overdue_days || 14)) return true;
    if (getVal('settingCutoffGrace') != (current.cutoff_grace_period || 3)) return true;

    return false;
};

// === SEARCH & FILTERS ===
function initializeSearchFilters() {
    console.log('Initializing search filters...');
    const customerSearch = document.getElementById('customerSearch');
    const customerStatus = document.getElementById('customerStatusFilter');
    const customerType = document.getElementById('customerTypeFilter');
    const customerBarangay = document.getElementById('customerBarangayFilter');

    const staffSearch = document.getElementById('staffSearch');
    const staffStatus = document.getElementById('staffStatusFilter');
    const staffRole = document.getElementById('staffRoleFilter');

    const billingSearch = document.getElementById('billingSearch');
    const billingStatus = document.getElementById('billingStatusFilter');
    const billingMonth = document.getElementById('billingMonthFilter');
    const billingBarangay = document.getElementById('billingBarangayFilter');

    // Populate billing barangay dropdown
    populateBarangayFilters('billingBarangayFilter');

    // Customer Filters
    const updateCustomerFilters = () => {
        refreshCustomers(false); // Reset to page 1
    };

    if (customerSearch) customerSearch.addEventListener('input', debounce(updateCustomerFilters, 300));
    if (customerStatus) customerStatus.addEventListener('change', updateCustomerFilters);
    if (customerType) customerType.addEventListener('change', updateCustomerFilters);
    if (customerBarangay) customerBarangay.addEventListener('change', updateCustomerFilters);

    // Staff Filters
    const updateStaffFilters = () => {
        refreshStaff(false); // Reset to page 1
    };

    if (staffSearch) staffSearch.addEventListener('input', debounce(updateStaffFilters, 300));
    if (staffStatus) staffStatus.addEventListener('change', updateStaffFilters);
    if (staffRole) staffRole.addEventListener('change', updateStaffFilters);

    // Billing Filters
    const updateBillingFilters = () => {
        refreshBilling(false); // Reset to page 1
    };

    if (billingSearch) billingSearch.addEventListener('input', debounce(updateBillingFilters, 300));
    if (billingStatus) billingStatus.addEventListener('change', updateBillingFilters);
    if (billingMonth) billingMonth.addEventListener('change', updateBillingFilters);
    if (billingBarangay) billingBarangay.addEventListener('change', updateBillingFilters);

    // Initialize Print Billing Summary
    const printBillingBtn = document.getElementById('printBillingSummaryBtn');

    if (printBillingBtn) {
        printBillingBtn.onclick = async () => {
            try {
                showLoadingOverlay('Preparing report...');
                // Ensure data is fresh based on CURRENT filters
                if (window.refreshBilling) {
                    await window.refreshBilling();
                }
                initPrintBillingSummary();
            } catch (error) {
                console.error('Print error:', error);
                showNotification('Failed to prepare print report', 'error');
            } finally {
                hideLoadingOverlay();
            }
        };
    }
}

/**
 * Handle printing the current filtered billing list as a summary
 * Grouped by Barangay
 */
async function initPrintBillingSummary() {
    const data = window.lastBillingData || [];
    const statusFilter = document.getElementById('billingStatusFilter');
    const reportType = statusFilter ? statusFilter.value : '';

    console.log(`[PrintSummary] Initializing print for ${data.length} records (Type: ${reportType || 'All'})...`);

    if (data.length === 0) {
        showNotification('No billing records found to print.', 'warning');
        return;
    }

    const printContainer = document.getElementById('billingSummaryPrintContent');
    const periodSpan = document.getElementById('printBillingPeriod');
    const statsSpan = document.getElementById('printBillingStats');

    if (!printContainer) {
        console.error('[PrintSummary] Print container not found!');
        return;
    }

    // Set professional metadata
    const activePeriod = document.getElementById('billingMonthFilter')?.value || 'All Periods';
    const reportTitle = reportType ? (reportType.charAt(0).toUpperCase() + reportType.slice(1)) : 'Billing';

    // Update the header in the print view if it exists
    const reportHeader = document.querySelector('#billingSummaryPrintView h2');
    if (reportHeader) {
        reportHeader.textContent = `${reportTitle.toUpperCase()} SUMMARY REPORT`;
    }

    periodSpan.textContent = `Period: ${activePeriod}`;
    statsSpan.textContent = `Generated on: ${pwdUtils.formatLocalDateTime(new Date(), true, true)}`;

    // Group by Barangay
    const grouped = {};
    data.forEach(bill => {
        // Fallback if getBarangay is not available or returns null
        let brgy = 'Unknown';
        if (typeof getBarangay === 'function') {
            brgy = getBarangay(bill.customers?.address || 'Unknown') || 'Unknown';
        }

        if (!grouped[brgy]) grouped[brgy] = [];
        grouped[brgy].push(bill);
    });

    const sortedBrgys = Object.keys(grouped).sort();
    console.log(`[PrintSummary] Grouped into ${sortedBrgys.length} barangays:`, sortedBrgys);

    // Generate HTML
    let html = '';
    sortedBrgys.forEach(brgy => {
        html += `<div class="barangay-group-header">${brgy.toUpperCase()}</div>`;
        const isDisconnectedReport = reportType === 'disconnected';

        html += `
            <table class="summary-print-table">
                <thead>
                    <tr>
                        <th style="width: 100px;">Bill Number</th>
                        <th style="width: 110px;">Account Number</th>
                        <th>Customer Name</th>
                        <th style="width: 100px;">Meter Number</th>
                        <th style="width: 100px; text-align: right;">Amount</th>
                        <th style="width: 100px;">Due Date</th>
                        <th style="width: 80px;">Status</th>
                        ${isDisconnectedReport ? '<th style="width: 110px;">Disconnected On</th>' : ''}
                    </tr>
                </thead>
                <tbody>
        `;

        grouped[brgy].forEach(bill => {
            const customer = bill.customers;
            const middleInitial = customer?.middle_initial ? ` ${customer.middle_initial}.` : '';
            const name = customer ? `${customer.last_name}, ${customer.first_name}${middleInitial}` : 'Unknown';
            const amount = (parseFloat(bill.balance) || parseFloat(bill.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
            const dueDate = bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '--/--/----';
            const billNumber = `BILL-${String(bill.id).padStart(3, '0')}`;
            const accountNumber = customer?.id ? `ACC-${String(customer.id).padStart(3, '0')}` : '---';
            const disconnDate = customer?.disconnection_date ? new Date(customer.disconnection_date).toLocaleDateString() : '---';

            html += `
                <tr>
                    <td>${billNumber}</td>
                    <td>${accountNumber}</td>
                    <td>${name}</td>
                    <td>${customer?.meter_number || '---'}</td>
                    <td style="text-align: right;">₱${amount}</td>
                    <td>${dueDate}</td>
                    <td>${(bill.status || '').toUpperCase()}</td>
                    ${isDisconnectedReport ? `<td>${disconnDate}</td>` : ''}
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;
    });

    printContainer.innerHTML = html;

    // Trigger Print
    document.body.classList.add('printing-billing-summary');

    // Final check for visibility and layout reflow
    window.dispatchEvent(new Event('resize'));

    // Give browser substantial time to reflow/render a large (5-page) HTML table
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            document.body.classList.remove('printing-billing-summary');
        }, 500);
    }, 500); // Increased to 500ms for large reports
}

// === CUSTOM CONFIRMATION MODALS ===
function showUnsavedChangesModal(onConfirm) {
    const modalHTML = `
        <div class="premium-modal-overlay" id="unsavedModal">
            <div class="ec-modal-card" style="width: 440px;">
                <div class="ec-header-bar" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2);">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div>
                            <h3 class="ec-title">Unsaved Changes</h3>
                            <p class="ec-subtitle">Attention Required</p>
                        </div>
                    </div>
                </div>
                
                <div class="ec-body" style="padding: 2.5rem 2.25rem;">
                    <div style="text-align: center;">
                        <p style="font-size: 1.1rem; color: var(--ec-text-main); font-weight: 700; margin-bottom: 1rem;">
                            Wait! You have unsaved changes.
                        </p>
                        <p style="font-size: 0.95rem; color: var(--ec-text-muted); line-height: 1.6; font-weight: 500;">
                            You have modified system settings. If you leave now, your progress will be permanently lost.
                        </p>
                    </div>
                    
                    <div class="ec-footer" style="padding: 1.5rem 0 0 0; margin-top: 1.5rem; justify-content: center; flex-direction: column-reverse; gap: 0.75rem; border-top: none;">
                        <button type="button" class="ec-btn-ghost" onclick="closeModal('unsavedModal')" style="width: 100%; border-radius: 12px; height: 48px;">
                            <i class="fas fa-arrow-left"></i> Stay & Continue Editing
                        </button>
                        <button type="button" id="confirmDiscardBtn" class="ec-btn-danger" style="width: 100%; border-radius: 12px; height: 50px; justify-content: center; background: linear-gradient(135deg, #ef4444, #dc2626);">
                            <i class="fas fa-trash-alt"></i> Discard All Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    // Activation logic for visibility
    const modal = document.getElementById('unsavedModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    document.getElementById('confirmDiscardBtn').addEventListener('click', () => {
        closeModal('unsavedModal');
        if (onConfirm) onConfirm();
    });

    document.getElementById('confirmSaveBtn').addEventListener('click', () => {
        closeModal('unsavedModal');
        if (window.onSaveSettings) window.onSaveSettings();
    });
}

function showLogoutModal(onConfirm) {
    const modalHTML = `
        <div class="premium-modal-overlay" id="logoutModal">
            <div class="ec-modal-card" style="width: 420px;">
                <div class="ec-header-bar" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2);">
                            <i class="fas fa-sign-out-alt"></i>
                        </div>
                        <div>
                            <h3 class="ec-title">Sign Out</h3>
                            <p class="ec-subtitle">End session safely</p>
                        </div>
                    </div>
                </div>
                <div class="ec-body" style="text-align: center; padding: 2.5rem 2rem;">
                    <p style="font-size: 1.1rem; color: var(--ec-text-main); line-height: 1.6; margin: 0;">
                        Are you sure you want to log out?<br>Any unsaved work will be lost.
                    </p>
                </div>
                <div class="ec-footer" style="padding: 1.5rem 2.25rem; background: rgba(0,0,0,0.02);">
                    <button type="button" class="ec-btn-ghost" onclick="closeModal('logoutModal')">Stay</button>
                    <button type="button" class="ec-btn-danger" id="confirmLogout" style="flex: 1; justify-content: center;">
                        <i class="fas fa-sign-out-alt"></i> Log Out
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    const modal = document.getElementById('logoutModal');
    if (modal) {
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('active'));
    }

    document.getElementById('confirmLogout').onclick = () => {
        closeModal('logoutModal');
        if (onConfirm) onConfirm();
    };
}

// === LOGOUT ===
function initializeLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            showLogoutModal(async () => {
                try {
                    await supabase.auth.signOut({ scope: 'local' });
                    // Explicitly clear to prevent any pick-up loops
                    localStorage.removeItem('sb-admin-token');
                    sessionStorage.removeItem('sb-admin-token');
                    window.location.href = '../index.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                    showNotification('Error signing out. Please try again.', 'error');
                }
            });
        });
    }
}

// === THEME MANAGEMENT ===
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('admin-theme') || 'light';

    // Apply saved theme
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark-theme');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            themeToggle.style.color = '#FFD700'; // Gold Sun
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const isDark = document.documentElement.classList.toggle('dark-theme');

    // Update icon and save preference
    if (isDark) {
        localStorage.setItem('admin-theme', 'dark');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            themeToggle.style.color = '#FFD700'; // Gold Sun
        }
    } else {
        localStorage.setItem('admin-theme', 'light');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            themeToggle.style.color = '#0288D1'; // Original Blue Moon
        }
    }

    // Refresh charts to update theme-dependent elements (like center text)
    if (typeof consumptionChart !== 'undefined' && consumptionChart) consumptionChart.update();
    if (typeof paymentStatusChart !== 'undefined' && paymentStatusChart) paymentStatusChart.update();
}

// === CHART MANAGEMENT ===
let consumptionChart = null;
let paymentStatusChart = null;

function updateDashboardCharts(data) {
    // Update Stat Totals in Pesos
    const statUnpaidAmount = document.getElementById('statUnpaidAmount');
    const statOverdueAmount = document.getElementById('statOverdueAmount');
    if (statUnpaidAmount) statUnpaidAmount.textContent = `₱${(data.status.unpaidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (statOverdueAmount) statOverdueAmount.textContent = `₱${(data.status.overdueAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // 1. Update Consumption Line Chart
    const ctxConsumption = document.getElementById('consumptionChart')?.getContext('2d');
    if (ctxConsumption) {
        if (consumptionChart) {
            consumptionChart.data.labels = data.consumption.labels;
            consumptionChart.data.datasets[0].data = data.consumption.values;
            consumptionChart.update();
        } else {
            consumptionChart = new Chart(ctxConsumption, {
                type: 'line',
                data: {
                    labels: data.consumption.labels,
                    datasets: [{
                        label: 'Consumption (cu.m.)',
                        data: data.consumption.values,
                        borderColor: '#0288D1',
                        backgroundColor: 'rgba(2, 136, 209, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#0288D1',
                        pointBorderColor: '#fff',
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Consumption (cu.m.)', font: { family: 'Inter', size: 11, weight: '600' }, color: '#64748B' },
                            grid: { color: 'rgba(148, 163, 184, 0.05)' },
                            ticks: { font: { family: 'Inter', size: 11 }, color: '#64748B' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Inter', size: 11 }, color: '#64748B', padding: 10 }
                        }
                    }
                }
            });
        }
    }

    // 2. Update Payment Status Pie Chart
    const ctxPayment = document.getElementById('paymentStatusChart')?.getContext('2d');
    if (ctxPayment) {
        const statusValues = [data.status.paid, data.status.unpaid, data.status.overdue];
        const total = statusValues.reduce((a, b) => a + b, 0);

        if (paymentStatusChart) {
            paymentStatusChart.data.datasets[0].data = statusValues;
            paymentStatusChart.options.plugins.centerText.text = total.toString();
            paymentStatusChart.update();
        } else {
            // Register a custom plugin for the center text
            const centerTextPlugin = {
                id: 'centerText',
                text: total.toString(),
                afterDraw: (chart) => {
                    const { ctx, chartArea: { top, bottom, left, right, width, height } } = chart;
                    ctx.save();

                    const isDark = document.documentElement.classList.contains('dark-theme');
                    const centerX = left + width / 2;
                    const centerY = top + height / 2;

                    // Draw "TOTAL" label
                    ctx.font = '500 12px Inter';
                    ctx.fillStyle = isDark ? '#9CA3AF' : '#64748B';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('TOTAL BILLS', centerX, centerY - 12);

                    // Draw the count
                    ctx.font = 'bold 36px Inter';
                    ctx.fillStyle = isDark ? '#F9FAFB' : '#1E293B';
                    ctx.fillText(chart.config.options.plugins.centerText.text, centerX, centerY + 18);

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
                            position: 'bottom',
                            labels: {
                                padding: 25,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                font: {
                                    family: 'Inter',
                                    size: 13,
                                    weight: '500'
                                },
                                color: '#64748B'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(30, 41, 59, 0.9)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            cornerRadius: 8,
                            displayColors: true
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
}

// Expose to window for database operations access
window.updateDashboardCharts = updateDashboardCharts;
// === MASTER LEDGER LOGIC ===

function initializeLedgerPage() {
    const barangayFilter = document.getElementById('ledgerBarangayFilter');
    const periodFilter = document.getElementById('ledgerPeriodFilter');
    const searchInput = document.getElementById('ledgerSearch');
    const backBtn = document.getElementById('backToMasterBtnDetail');

    // Populate Barangays if not already
    populateBarangayFilters('ledgerBarangayFilter');

    // Populate Period filter from billing data
    populateLedgerPeriodFilter();

    // Event Listeners
    const updateLedger = async () => {
        const target = document.getElementById('ledgerMasterTableBody') || document.getElementById('ledgerMasterView');
        if (target) pwdUtils.showLoading(target);

        try {
            await window.dbOperations.loadMasterLedger({
                barangay: barangayFilter?.value || '',
                search: searchInput?.value || '',
                period: periodFilter?.value || ''
            });
        } finally {
            if (target) pwdUtils.hideLoading(target);
        }
    };

    // Expose updateLedger for pagination callback
    window.dispatchLedgerRefresh = updateLedger;

    barangayFilter?.addEventListener('change', updateLedger);
    periodFilter?.addEventListener('change', updateLedger);
    searchInput?.addEventListener('input', debounce(updateLedger, 300));

    // Print Logic
    document.getElementById('printLedgerBtn').onclick = async () => {
        try {
            if (window.showLoadingOverlay) window.showLoadingOverlay('Preparing report...');

            const printDate = document.querySelector('.print-date');
            if (printDate) {
                printDate.textContent = `Generated on: ${formatLocalDateTime(new Date(), true, true)}`;
            }

            const printPeriod = document.getElementById('printLedgerPeriod');
            if (printPeriod) {
                const periodSelect = document.getElementById('ledgerPeriodFilter');
                const selectedPeriod = periodSelect.options[periodSelect.selectedIndex]?.text || 'All Periods';
                printPeriod.textContent = `Period: ${selectedPeriod}`;
            }

            // Load full list for printing
            await window.dbOperations.loadMasterLedger({
                barangay: barangayFilter?.value || '',
                search: searchInput?.value || '',
                period: periodFilter?.value || '',
                fullList: true
            });

            // Specific view isolation classes
            const isMasterView = document.getElementById('ledgerMasterView').style.display !== 'none';
            const specificPrintClass = isMasterView ? 'printing-ledger-master' : 'printing-ledger-detail';

            // Add printing class to body for specialized CSS
            document.body.classList.add('printing-ledger');
            document.body.classList.add(specificPrintClass);

            // Reflow delay to fix blank pages, clipping, and missing data on large reports
            setTimeout(() => {
                if (window.hideLoadingOverlay) window.hideLoadingOverlay();
                window.print();

                setTimeout(() => {
                    document.body.classList.remove('printing-ledger');
                    document.body.classList.remove(specificPrintClass);
                    updateLedger(false);
                }, 500);
            }, 1200);

        } catch (error) {
            console.error('Print Ledger Error:', error);
            if (window.hideLoadingOverlay) window.hideLoadingOverlay();
        }
    };

    // Detail View Controls
    const closeDetail = () => {
        if (ledgerSource === 'billing') {
            const billingNavItem = document.querySelector('.nav-item[data-page="billing"]');
            if (billingNavItem) billingNavItem.click();
            return;
        }

        document.getElementById('ledgerMasterView').style.display = 'block';
        document.getElementById('ledgerDetailView').style.display = 'none';

        // Show filter elements
        document.querySelectorAll('.ledger-controls .search-box, .ledger-controls .filter-select').forEach(el => el.style.display = 'block');

        document.getElementById('backToMasterBtn').style.display = 'none';
        document.getElementById('printLedgerBtn').innerHTML = '<i class="fas fa-print"></i> Print Report';
    };

    if (backBtn) backBtn.onclick = closeDetail;
    document.getElementById('backToMasterBtn').onclick = closeDetail;

    // Initial Load
    document.getElementById('ledgerMasterView').style.display = 'block';
    document.getElementById('ledgerDetailView').style.display = 'none';
    updateLedger();
}


/**
 * Global function to switch to individual customer ledger card
 */
window.viewCustomerLedger = async function (customerId) {
    // 0. Ensure we are on the Ledger page
    const ledgerNavItem = document.querySelector('.nav-item[data-page="ledger"]');
    if (ledgerNavItem && !ledgerNavItem.classList.contains('active')) {
        ledgerNavItem.click();
        // Give a tiny moment for the UI to switch containers if needed, though most logic is synchronous
    }

    // 1. Switch inner views within the ledger page
    const masterView = document.getElementById('ledgerMasterView');
    const detailView = document.getElementById('ledgerDetailView');

    if (masterView) masterView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';

    // 2. Hide only filter elements (search, selects), keep buttons visible
    document.querySelectorAll('.ledger-controls .search-box, .ledger-controls .filter-select').forEach(el => el.style.display = 'none');

    // 3. Show back button and update Print Button
    const backBtn = document.getElementById('backToMasterBtn');
    const printBtn = document.getElementById('printLedgerBtn');

    if (backBtn) backBtn.style.display = 'inline-flex';
    if (printBtn) printBtn.innerHTML = '<i class="fas fa-print"></i> Print Customer Card';

    // 4. Set current tracking ID for realtime refresh
    window.currentLedgerCustomerId = customerId;

    // 5. Load data
    if (window.dbOperations && window.dbOperations.loadLedgerCard) {
        await window.dbOperations.loadLedgerCard(customerId);
    }
};

/**
 * Utility to populate any barangay select element
 */
function populateBarangayFilters(selectId) {
    const filter = document.getElementById(selectId);
    if (!filter || filter.options.length > 1) return;

    const barangays = window.dbOperations ?
        (window.dbOperations.PULUPANDAN_BARANGAYS || []) :
        (window.PULUPANDAN_BARANGAYS || []);

    barangays.forEach(bg => {
        const opt = document.createElement('option');
        opt.value = bg;
        opt.textContent = bg;
        filter.appendChild(opt);
    });
}

/**
 * Populate the ledger period filter from unique billing_period values in DB
 */
async function populateLedgerPeriodFilter() {
    if (window.dbOperations?.populateDynamicPeriodFilters) {
        await window.dbOperations.populateDynamicPeriodFilters();
    }
}

/**
 * Modern Sidebar Persistence & Toggle Logic
 */
// Consolidated Sidebar Toggle & Persistence
function initializeSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');

    if (toggleBtn && sidebar && window.innerWidth > 1024) {
        // Load preference
        const isMini = localStorage.getItem('sidebar-mini') === 'true';
        if (isMini) {
            sidebar.classList.add('mini');
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.add('is-animating'); // Lock tooltips
            sidebar.classList.toggle('mini');

            // Remove lock after transition
            setTimeout(() => {
                sidebar.classList.remove('is-animating');
            }, 400);

            localStorage.setItem('sidebar-mini', sidebar.classList.contains('mini'));
        });
    }
}


// === INTELLIGENT MARQUEE ===
function initializeStatMarquee() {
    const checkOverflow = () => {
        const statValues = document.querySelectorAll('.stat-value');

        statValues.forEach(el => {
            // Reset to allow measurement
            el.classList.remove('is-overflowing');
            el.style.removeProperty('--marquee-distance');

            // Check if content overflows
            if (el.scrollWidth > el.clientWidth) {
                el.classList.add('is-overflowing');

                // Store text content for CSS ::after clone
                el.setAttribute('data-text', el.textContent);

                // Calculate distance to scroll
                // We need to scroll the full width of the element + gap
                const distance = el.scrollWidth + 32; // 32px = 2rem gap
                el.style.setProperty('--marquee-distance', `-${distance}px`);
            } else {
                // Clean up if no longer overflowing
                el.removeAttribute('data-text');
            }
        });
    };

    // Run initially
    // Small delay to ensure layout is settled (fonts loaded, etc)
    setTimeout(checkOverflow, 500);

    // Run on resize
    window.addEventListener('resize', () => {
        // Debounce slightly
        if (window.marqueeResizeTimer) clearTimeout(window.marqueeResizeTimer);
        window.marqueeResizeTimer = setTimeout(checkOverflow, 200);
    });

    // Run when data changes (MutationObserver would be best, but simple hook for now)
    // We can expose it globally to be called by refresh functions
    window.refreshMarquee = checkOverflow;
}


// === EDIT RATE CATEGORY MODAL ===
window.showEditRateModal = async function (category) {
    // 1. Fetch current rate schedules from DB
    let schedules = [];
    try {
        schedules = await window.dbOperations.loadRateSchedules();
    } catch (e) {
        showNotification('Failed to load seasonal rates.', 'error');
        return;
    }

    // 2. Find the requested category
    const schedule = schedules.find(s => s.category_key === category);
    if (!schedule) {
        showNotification('Rate category not found in database.', 'error');
        return;
    }

    // Icon/Color Mapping
    const visuals = {
        'residential': { icon: 'fa-home', color: '#0288D1' },
        'full-commercial': { icon: 'fa-industry', color: '#E53935' },
        'commercial-a': { icon: 'fa-store', color: '#43A047' },
        'commercial-b': { icon: 'fa-store-alt', color: '#FB8C00' },
        'commercial-c': { icon: 'fa-briefcase', color: '#8E24AA' },
        'bulk': { icon: 'fa-truck-loading', color: '#546E7A' }
    };
    const style = visuals[category] || { icon: 'fa-tint', color: 'var(--primary)' };

    const modalHTML = `
        <div class="modal-overlay glass-effect" id="editRateModal" style="--btn-color: ${style.color}; --btn-color-rgb: ${window.hexToRgb ? window.hexToRgb(style.color) : '0, 102, 255'};">
            <div class="modal premium-adjustment">
                <div class="modal-header no-border" style="padding: 1rem 1.25rem 0.5rem 1.25rem;">
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <div style="width: 28px; height: 28px; border-radius: 6px; background: ${style.color}; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem;">
                            <i class="fas ${style.icon}"></i>
                        </div>
                        <div>
                            <h3 style="font-size: 0.9rem; margin: 0; color: var(--text-primary);">Adjust ${schedule.display_name}</h3>
                            <p style="font-size: 0.7rem; color: var(--text-light); margin: 0;">Update factor and base rates</p>
                        </div>
                    </div>
                    <button class="modal-close" onclick="closeModal('editRateModal')" style="color: var(--text-light); background: transparent; border: none; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form class="modal-form" id="editRateForm" style="padding: 1rem 1.25rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group-compact" style="background: rgba(var(--btn-color-rgb), 0.05); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(var(--btn-color-rgb), 0.1);">
                            <label style="color: ${style.color}; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.4rem; display: block;">Classification Factor</label>
                            <input type="number" id="rateFactor" class="input-pill" style="width: 100%; font-size: 1.1rem; height: 40px;" step="0.01" value="${schedule.factor}" required />
                        </div>
                        <div class="form-group-compact" style="background: rgba(var(--text-primary-rgb, 0,0,0), 0.02); padding: 0.75rem; border-radius: 12px; border: 1px solid var(--border-color);">
                            <label style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.4rem; display: block;">Base Minimum (1/2")</label>
                            <input type="number" id="rateMinimum" class="input-pill" style="width: 100%; font-size: 1.1rem; height: 40px;" step="0.01" value="${schedule.min_charge_1_2}" required />
                        </div>
                    </div>

                    <div class="tier-input-grid">
                        <div class="form-group-compact">
                            <label style="font-size: 0.65rem; color: var(--text-light); display: block; margin-bottom: 0.3rem; font-weight: 600;">Tier 1 Base (11-20)</label>
                            <input type="number" id="rateTier1" class="input-pill" style="width: 100%; font-size: 0.85rem; height: 38px;" step="0.01" value="${schedule.tier1_rate}" required />
                        </div>
                        <div class="form-group-compact">
                            <label style="font-size: 0.65rem; color: var(--text-light); display: block; margin-bottom: 0.3rem; font-weight: 600;">Tier 2 Base (21-30)</label>
                            <input type="number" id="rateTier2" class="input-pill" style="width: 100%; font-size: 0.85rem; height: 38px;" step="0.01" value="${schedule.tier2_rate}" required />
                        </div>
                        <div class="form-group-compact">
                            <label style="font-size: 0.65rem; color: var(--text-light); display: block; margin-bottom: 0.3rem; font-weight: 600;">Tier 3 Base (31-40)</label>
                            <input type="number" id="rateTier3" class="input-pill" style="width: 100%; font-size: 0.85rem; height: 38px;" step="0.01" value="${schedule.tier3_rate}" required />
                        </div>
                        <div class="form-group-compact">
                            <label style="font-size: 0.65rem; color: var(--text-light); display: block; margin-bottom: 0.3rem; font-weight: 600;">Tier 4 Base (41-UP)</label>
                            <input type="number" id="rateTier4" class="input-pill" style="width: 100%; font-size: 0.85rem; height: 38px;" step="0.01" value="${schedule.tier4_rate}" required />
                        </div>
                    </div>

                    <div id="pinSection" class="pin-section-container">
                        <label style="font-size: 0.65rem; color: var(--primary); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 0.5rem; text-align: center;">Enter Admin PIN to Confirm</label>
                        <div style="position: relative;">
                            <input type="password" id="ratePIN" class="input-pill" style="width: 100%; letter-spacing: 0.4rem; text-align: center; font-size: 1rem; height: 42px;" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="••••••" />
                        </div>
                    </div>
                    
                    <div class="modal-footer no-border" style="padding-top: 1rem; display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem;">
                        <button type="button" class="btn-premium btn-premium-outline" style="flex: 0.4;" onclick="closeModal('editRateModal')">Discard</button>
                        <button type="submit" id="btnUpdateRates" class="btn-premium btn-premium-primary" style="flex: 1; background: ${style.color}; border: none; color: #fff;">
                            Update Rates
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    // Activation logic for visibility
    const modal = document.getElementById('editRateModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    // Helper to get RGB
    if (!window.hexToRgb) {
        window.hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 102, 255';
        };
    }

    let isPinVisible = false;

    document.getElementById('editRateForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const pinSection = document.getElementById('pinSection');
        const btnUpdate = document.getElementById('btnUpdateRates');

        if (!isPinVisible) {
            pinSection.classList.add('visible');
            btnUpdate.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Changes';
            isPinVisible = true;
            document.getElementById('ratePIN').focus();
            return;
        }

        const pin = document.getElementById('ratePIN').value;
        const factor = document.getElementById('rateFactor').value;
        const minimum = document.getElementById('rateMinimum').value;
        const tier1 = document.getElementById('rateTier1').value;
        const tier2 = document.getElementById('rateTier2').value;
        const tier3 = document.getElementById('rateTier3').value;
        const tier4 = document.getElementById('rateTier4').value;

        if (!pin) {
            showNotification('Please enter PIN', 'error');
            return;
        }

        const originalText = btnUpdate.innerHTML;
        btnUpdate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authorizing...';
        btnUpdate.disabled = true;

        try {
            const pinValid = await window.dbOperations.verifyAdminPIN(pin);
            if (!pinValid) {
                showNotification('Invalid PIN. Authorization denied.', 'error');
                btnUpdate.innerHTML = originalText;
                btnUpdate.disabled = false;
                return;
            }

            btnUpdate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving to DB...';

            await window.dbOperations.updateRateSchedule(schedule.id, {
                factor: parseFloat(factor),
                min_charge_1_2: parseFloat(minimum),
                tier1_rate: parseFloat(tier1),
                tier2_rate: parseFloat(tier2),
                tier3_rate: parseFloat(tier3),
                tier4_rate: parseFloat(tier4)
            });

            showNotification(`${schedule.display_name} saved successfully`, 'success');
            closeModal('editRateModal');

            if (typeof loadSystemSettingsIntoForm === 'function') {
                loadSystemSettingsIntoForm();
            }

            if (window.dbOperations.loadDashboardStats) window.dbOperations.loadDashboardStats();

        } catch (error) {
            console.error('Error updating rates:', error);
            showNotification('Failed to save changes: ' + error.message, 'error');
            btnUpdate.innerHTML = originalText;
            btnUpdate.disabled = false;
        }
    });
};

// Initialize edit rate buttons
function initializeRateEditing() {
    // Clean up old listeners if any (by using delegation we don't need to loop)
    if (window.isRateEditingInitialized) return;

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-edit-rate');
        if (btn) {
            const category = btn.getAttribute('data-category');
            if (category && typeof window.showEditRateModal === 'function') {
                window.showEditRateModal(category);
            }
        }
    });

    window.isRateEditingInitialized = true;
}

// === NOTIFICATIONS LOGIC ===
function initializeNotificationsUI() {
    const bellBtn = document.getElementById('notificationBellBtn');
    const dropdown = document.getElementById('notificationDropdown');
    const markAllReadBtn = document.getElementById('markAllReadBtn');

    if (!bellBtn || !dropdown) return;

    // Toggle dropdown
    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'flex';
        dropdown.style.display = isVisible ? 'none' : 'flex';
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Mark all as read
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', async () => {
            await markAllRead();
        });
    }
}

async function loadNotifications() {
    const badge = document.getElementById('notificationBadge');
    const list = document.getElementById('notificationList');
    if (!list) return;

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        // Update badge (count unread)
        const unreadCount = data.filter(n => !n.is_read).length;
        if (badge) {
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            } else {
                badge.style.display = 'none';
            }
        }

        // Render list
        if (data.length === 0) {
            list.innerHTML = '<div style="padding: 30px 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No new notifications</div>';
            return;
        }

        list.innerHTML = data.map(n => {
            let iconSvg, iconClass;

            if (n.type === 'cutoff_done') {
                iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/></svg>`;
                iconClass = 'cutoff-done';
            } else if (n.type === 'activation_ready') {
                iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                iconClass = 'activation-ready';
            } else if (n.type === 'bill_rollback') {
                iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`;
                iconClass = 'bill-rollback';
            } else if (n.type === 'bill_correction_complete') {
                iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`;
                iconClass = 'bill-correction-complete';
            } else {
                iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
                iconClass = 'default';
            }

            return `
                <div class="notification-item ${n.is_read ? '' : 'unread'}" 
                     onclick="handleNotificationClick('${n.id}', ${n.customer_id})">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div class="notification-icon-wrapper ${iconClass}">
                            ${iconSvg}
                        </div>
                        <div class="notification-content">
                            <p class="notification-message">${n.message}</p>
                            <span class="notification-time">${formatTimeAgo(new Date(n.created_at))}</span>
                        </div>
                        ${!n.is_read ? '<div class="unread-dot"></div>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Load Notifications Error:', err);
    }
}

async function markAllRead() {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('is_read', false);

        if (error) throw error;
        loadNotifications();
    } catch (err) {
        console.error('Mark All Read Error:', err);
    }
}

window.handleNotificationClick = async function (id, customerId) {
    try {
        // Mark as read
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        // Close dropdown
        document.getElementById('notificationDropdown').style.display = 'none';

        // Reload notifications
        loadNotifications();

        // Navigate to customer if customerId exists
        if (customerId) {
            window.navigateToCustomer(customerId);
        }
    } catch (err) {
        console.error('Notification Click Error:', err);
    }
};

window.navigateToCustomer = function (customerId) {
    const customersNavItem = document.querySelector('.nav-item[data-page="customers"]');
    if (customersNavItem) {
        // Set search ID to target customer
        const searchInput = document.getElementById('customerSearch');
        if (searchInput && typeof getAccountID === 'function') {
            searchInput.value = getAccountID(customerId);
        }

        // Trigger navigation
        customersNavItem.click();
    }
};

function formatTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}

/**
 * Opens the Edit Reading Modal
 * Refactored to support customer-centric reading list
 */
window.editReading = function (id, prev, current, name, meterNo, customerId) {
    const modal = document.getElementById('editReadingModal');
    if (!modal) return;

    const periodFilter = document.getElementById('readingListPeriodFilter');
    const selectedPeriod = periodFilter ? periodFilter.value : '';

    // Handle initial state - if current is "--" or empty string, show blank
    const numericCurrent = (current === '--' || current === '') ? '' : current;

    document.getElementById('editReadingBillingId').value = id || '';
    document.getElementById('editReadingCustomerId').value = customerId || '';
    document.getElementById('editReadingPeriod').value = selectedPeriod;

    document.getElementById('editReadingCustomerName').innerText = name;
    document.getElementById('editReadingMeterNo').innerText = `Meter: ${meterNo}`;
    document.getElementById('editReadingPrev').value = prev;
    document.getElementById('editReadingCurrent').value = numericCurrent;

    // Initial consumption calc
    const consumption = (numericCurrent !== '' && numericCurrent >= prev) ? (numericCurrent - prev) : 0;
    document.getElementById('editReadingConsumption').innerText = `${consumption} cu.m.`;

    modal.style.removeProperty('opacity');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

// Initialize Edit Reading Listeners
document.addEventListener('DOMContentLoaded', () => {
    const currentInput = document.getElementById('editReadingCurrent');
    const prevInput = document.getElementById('editReadingPrev');
    const consumptionDisplay = document.getElementById('editReadingConsumption');
    const saveBtn = document.getElementById('saveReadingEditBtn');

    if (currentInput && prevInput && consumptionDisplay) {
        currentInput.addEventListener('input', () => {
            const current = parseFloat(currentInput.value) || 0;
            const prev = parseFloat(prevInput.value) || 0;
            const consumption = Math.max(0, current - prev);
            consumptionDisplay.innerText = `${consumption} cu.m.`;

            // Visual feedback if current < prev
            if (current < prev) {
                currentInput.style.borderColor = 'var(--red)';
                consumptionDisplay.style.color = 'var(--red)';
            } else {
                currentInput.style.borderColor = '';
                consumptionDisplay.style.color = '';
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const id = document.getElementById('editReadingBillingId').value;
            const current = parseFloat(currentInput.value) || 0;
            const prev = parseFloat(prevInput.value) || 0;

            if (current < prev) {
                showNotification('Current reading cannot be less than previous reading', 'error');
                return;
            }

            const originalText = saveBtn.innerHTML;

            // PIN Gate
            showPINVerifyModal(async () => {
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
                saveBtn.disabled = true;

                try {
                    const customerId = document.getElementById('editReadingCustomerId').value;
                    const period = document.getElementById('editReadingPeriod').value;

                    // If NO period is selected, we can't create a new bill
                    if (!id && !period) {
                        showNotification('Please select a specific Billing Period/Month first.', 'warning');
                        saveBtn.innerHTML = originalText;
                        saveBtn.disabled = false;
                        return;
                    }

                    await window.dbOperations.updateReading(id, current, customerId, period);
                    closeModal('editReadingModal');

                    // Refresh current view (Reading List)
                    const activePage = document.querySelector('.page.active');
                    if (activePage && activePage.id === 'readingListPage') {
                        // Re-trigger load with current filters
                        const activePeriod = document.getElementById('readingListPeriodFilter').value;
                        const barangay = document.getElementById('readingListBarangayFilter').value;
                        const search = document.getElementById('readingListSearch').value;
                        window.dbOperations.loadReadingList({ period: activePeriod, barangay, search });
                    }

                    // Globally refresh related billing data so other tabs are up-to-date
                    if (typeof refreshBilling === 'function') refreshBilling();
                    if (typeof refreshLedger === 'function') refreshLedger();
                    if (typeof window.updateDashboardCharts === 'function') window.updateDashboardCharts();
                } catch (error) {
                    console.error('Update reading failed:', error);
                    saveBtn.innerHTML = originalText;
                    saveBtn.disabled = false;
                }
            });
        });
    }
});

// === AUDIT TRAIL LOGIC ===
window.logsPagination = { page: 1, pageSize: 20 };

window.onLogsPageChange = (page) => {
    window.logsPagination.page = page;
    if (window.dbOperations?.loadAuditLogs) {
        window.dbOperations.loadAuditLogs();
    }
};

// Realtime subscription for audit_logs
if (window.subscribeToTable) {
    window.subscribeToTable('audit_logs', (payload) => {
        console.log('[Realtime] ⚡ Audit log event:', payload.eventType);
        // Only auto-refresh if the logs page is currently visible
        const logsPage = document.getElementById('logsPage');
        if (logsPage && logsPage.style.display !== 'none' && window.dbOperations?.loadAuditLogs) {
            window.dbOperations.loadAuditLogs();
        }
    });
}
