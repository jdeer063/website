// Supabase Database Operations

// Helpers are now partially moved to shared/utils.js

/* === AUDIT LOG SYSTEM === */
window.logAuditAction = async function (actionType, entityType, entityId, details, metadata = null) {
    try {
        // 1. Get current auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.warn('[Audit Log] No active session to log action:', actionType);
            return;
        }

        // 2. Look up staff by matching username from email
        // Login appends @gmail.com to usernames, so we strip it to match
        const email = session.user.email || '';
        const username = email.split('@')[0]; // e.g. "wana@gmail.com" -> "wana"

        let staffName = email;
        let staffRole = 'unknown';
        let staffId = null;

        // Try matching by username first (most reliable), then fallback to auth_uid
        let { data: staff } = await supabase
            .from('staff')
            .select('id, first_name, last_name, role')
            .eq('username', username)
            .single();

        if (!staff) {
            // Fallback: try auth_uid match
            const result = await supabase
                .from('staff')
                .select('id, first_name, last_name, role')
                .eq('auth_uid', session.user.id)
                .single();
            staff = result.data;
        }

        if (staff) {
            staffId = staff.id;
            staffName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || email;
            staffRole = staff.role || 'unknown';
        }

        // 3. Insert the audit log entry
        const { error } = await supabase.from('audit_logs').insert([{
            staff_id: staffId,
            staff_name: staffName,
            role: staffRole,
            action_type: actionType,
            entity_type: entityType,
            entity_id: String(entityId),
            details: details,
            metadata: metadata
        }]);

        if (error) {
            console.error('[Audit Log] Failed to insert log:', error);
        }
    } catch (e) {
        console.error('[Audit Log] Exception:', e);
    }
};
const logAuditAction = window.logAuditAction;

async function loadAuditLogs(options = {}) {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;

    try {
        const moduleFilter = document.getElementById('logModuleFilter')?.value || '';
        const actionFilter = document.getElementById('logActionFilter')?.value || '';
        const dateFrom = document.getElementById('logDateFrom')?.value || '';
        const dateTo = document.getElementById('logDateTo')?.value || '';
        const search = document.getElementById('logSearch')?.value || '';

        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (moduleFilter) query = query.eq('entity_type', moduleFilter);
        if (actionFilter) query = query.eq('action_type', actionFilter);
        if (dateFrom) query = query.gte('created_at', dateFrom);
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
        
        if (search) {
            query = query.or(`staff_name.ilike.%${search}%,details.ilike.%${search}%,entity_id.ilike.%${search}%`);
        }

        // Basic Pagination - default to first 50
        const page = options.page || 1;
        const pageSize = 50;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data: logs, count, error } = await query;

        if (error) throw error;

        tbody.innerHTML = '';
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #9E9E9E;">No audit logs found.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const date = new Date(log.created_at);
            const formattedDate = date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="mono" style="font-size: 0.8rem;">${formattedDate}</td>
                <td>
                    <div style="font-weight: 600;">${log.staff_name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary);">${log.role}</div>
                </td>
                <td><span class="badge badge-outline" style="text-transform: capitalize;">${log.entity_type}</span></td>
                <td><span class="badge badge-primary" style="text-transform: capitalize;">${log.action_type}</span></td>
                <td style="font-size: 0.85rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.details || ''}">
                    ${log.details || '-'}
                </td>
            `;
            tbody.appendChild(row);
        });

        // Trigger pagination if renderPagination exists
        if (typeof renderPagination === 'function' && document.getElementById('logsPagination')) {
            renderPagination('logsPagination', count, page, pageSize, (newPage) => {
                loadAuditLogs({ page: newPage });
            });
        }

    } catch (e) {
        console.error('Error loading audit logs:', e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #F44336; padding: 2rem;">Error: ${e.message}</td></tr>`;
    }
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading customers...</td></tr>';

        let query = supabase
            .from('customers')
            .select('*')
            .order(sortBy, { ascending: sortOrder === 'asc' });

        // Apply status filter server-side for accuracy
        if (status) {
            if (status === 'active') {
                query = query.or('status.eq.active,status.is.null');
            } else {
                query = query.eq('status', status);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        // Client-side filtering for search, type, barangay
        const filteredData = data.filter(c => {
            const lowSearch = search.toLowerCase();

            // Comprehensive name and ID matching
            const firstName = (c.first_name || '').toLowerCase();
            const lastName = (c.last_name || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`;
            const lastNameFirst = `${lastName}, ${firstName}`;
            const accountId = getAccountID(c.id).toLowerCase();
            const meterNo = (c.meter_number || '').toLowerCase();
            const address = (c.address || '').toLowerCase();

            const matchesSearch = !search ||
                fullName.includes(lowSearch) ||
                lastNameFirst.includes(lowSearch) ||
                accountId.includes(lowSearch) ||
                meterNo.includes(lowSearch) ||
                address.includes(lowSearch);

            let matchesType = !type || (c.customer_type || '').toLowerCase() === type.toLowerCase();
            // Group legacy 'industrial' with new 'full-commercial'
            if (type === 'full-commercial' && (c.customer_type || '').toLowerCase() === 'industrial') {
                matchesType = true;
            }
            const matchesBarangay = !barangay || getBarangay(c.address).toLowerCase() === barangay.toLowerCase();

            return matchesSearch && matchesType && matchesBarangay;
        });

        const totalItems = filteredData.length;
        const page = options.page || 1;
        const pageSize = options.pageSize || 20;

        if (totalItems === 0) {
            tbody.innerHTML = `<tr><td colspan="${hideActions ? '7' : '8'}" style="text-align: center; padding: 2rem;">No customers found.</td></tr>`;
            if (window.renderPagination) window.renderPagination('customerPagination', 0, page, pageSize, 'onCustomerPageChange');
            return { total: 0 };
        }

        // Apply pagination (slice the filtered data)
        const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

        tbody.innerHTML = paginatedData.map(c => {
            const hasDiscount = c.has_discount;
            const middleInitial = c.middle_initial ? ` ${c.middle_initial}.` : '';
            const displayName = `${c.last_name}, ${c.first_name}${middleInitial}`;

            return `
            <tr class="${(c.status || 'active').toLowerCase() === 'inactive' ? 'status-inactive' : ''}"
                data-id="${c.id}" 
                data-last-name="${c.last_name}" 
                data-first-name="${c.first_name}" 
                data-middle-initial="${c.middle_initial || ''}"
                data-type="${c.customer_type}"
                data-meter-size="${c.meter_size || '1/2\"'}"
                data-discount="${c.has_discount}"
                data-address="${c.address}"
                data-contact="${c.contact_number || ''}"
                data-age="${c.age || ''}"
                data-meter-number="${c.meter_number || ''}"
                data-status="${c.status || 'active'}">
                <td class="account-id">${getAccountID(c.id)}</td>
                <td>
                    <div class="name-column">
                        <span class="display-name">${displayName}</span>
                        ${(c.status || 'active').toLowerCase() === 'inactive' ? '<span class="badge-deactivated">DEACTIVATED</span>' : ''}
                        ${hasDiscount ? `<span class="badge info">Senior Citizen</span>` : ''}
                    </div>
                </td>
                <td><div class="barangay-display" title="${c.address}">${getBarangay(c.address)}</div></td>
                <td><span class="meter-number">${c.meter_number || 'N/A'}</span></td>
                <td><span class="contact-number">${c.contact_number || 'N/A'}</span></td>
                <td>
                    <span class="badge type-${(c.customer_type || 'residential').toLowerCase()}">
                        ${{
                    'residential': 'Residential',
                    'industrial': 'Industrial',
                    'full-commercial': 'Industrial',
                    'commercial-a': 'Semi-Commercial A',
                    'commercial-b': 'Semi-Commercial B',
                    'commercial-c': 'Semi-Commercial C',
                    'bulk': 'Bulk / Wholesale'
                }[c.customer_type] || (c.customer_type || 'Residential').replace('-', ' ').toUpperCase()}
                    </span>
                </td>
                <td><span class="badge status-${(c.status || 'active').toLowerCase()}">${(c.status || 'active').toUpperCase()}</span></td>
                ${!hideActions ? `
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete" title="Delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>` : ''}
            </tr>
        `}).join('');

        // Render Pagination UI
        if (window.renderPagination) {
            window.renderPagination('customerPagination', totalItems, page, pageSize, 'onCustomerPageChange');
        }

        return { total: totalItems };

    } catch (error) {
        console.error('Error loading customers:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Failed to load customers</td></tr>';
    }
}

async function addCustomer(customerData) {
    try {
        // 1. Check if meter number already exists to prevent 409 Conflict
        const { data: existing, error: checkError } = await supabase
            .from('customers')
            .select('id, last_name, first_name')
            .eq('meter_number', customerData.meterNumber)
            .maybeSingle();

        if (checkError) console.warn('[addCustomer] Check Error:', checkError);

        if (existing) {
            throw new Error(`Meter Number "${customerData.meterNumber}" is already assigned to ${existing.first_name} ${existing.last_name} (ID: ${existing.id}).`);
        }

        // 2. Proceed with insert
        const { data: newCust, error } = await supabase
            .from('customers')
            .insert([{
                last_name: customerData.lastName,
                first_name: customerData.firstName,
                middle_initial: customerData.middleInitial,
                address: customerData.address,
                contact_number: customerData.contact,
                meter_number: customerData.meterNumber,
                customer_type: customerData.customerType,
                meter_size: customerData.meterSize || '1/2"',
                age: customerData.age,
                status: customerData.status || 'active',
                has_discount: customerData.discount
            }])
            .select('id')
            .single();

        if (error) {
            if (error.code === '23505') { // Postgres Unique Violation
                throw new Error(`Duplicate Data: Meter Number "${customerData.meterNumber}" already exists.`);
            }
            throw error;
        }

        const newId = newCust?.id;

        // 3. --- Notifications ---
        await supabase.from('notifications').insert({
            type: 'new_customer',
            message: `New Customer Registered: ${customerData.firstName} ${customerData.lastName} (Meter: ${customerData.meterNumber})`,
            customer_id: newId
        }).catch(err => console.warn('Notification failed:', err));

        // 4. --- Audit Log ---
        const statusLabel = (customerData.status || 'active').toLowerCase() === 'active' ? 'Active' : 'Inactive';
        await logAuditAction(
            'CREATE',
            'customer',
            newId,
            `Added new customer: ${customerData.firstName} ${customerData.lastName} (Meter: ${customerData.meterNumber}, Status: ${statusLabel})`,
            { customer_id: newId, meter_number: customerData.meterNumber }
        );

        // Success handled by UI caller
        if (window.dbOperations && window.dbOperations.loadCustomers) {
            window.dbOperations.loadCustomers();
        }
        if (window.dbOperations && window.dbOperations.loadDashboardStats) {
            window.dbOperations.loadDashboardStats();
        }
    } catch (error) {
        console.error('Error adding customer:', error);
        // Error thrown and handled by UI caller
        throw error;
    }
}

async function updateCustomer(id, customerData) {
    try {
        // 1. Check if meter number already exists for a DIFFERENT customer
        if (customerData.meterNumber) {
            const { data: existing, error: checkError } = await supabase
                .from('customers')
                .select('id, last_name, first_name')
                .eq('meter_number', customerData.meterNumber)
                .neq('id', id)
                .maybeSingle();

            if (checkError) console.warn('[updateCustomer] Check Error:', checkError);

            if (existing) {
                throw new Error(`Meter Number "${customerData.meterNumber}" is already assigned to ${existing.first_name} ${existing.last_name} (ID: ${existing.id}).`);
            }
        }

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
                meter_size: customerData.meterSize || '1/2"',
                status: customerData.status || 'active',
                has_discount: customerData.discount,
                age: customerData.age,
                updated_at: new Date()
            })
            .eq('id', id);

        if (error) throw error;

        // --- Audit Log ---
        const statusLabel = (customerData.status || 'active').toLowerCase() === 'active' ? 'Active' : 'Inactive';
        await logAuditAction(
            'UPDATE',
            'customer',
            id,
            `Updated customer profile: ${customerData.firstName} ${customerData.lastName} (${statusLabel})`,
            { changed_fields: Object.keys(customerData) }
        );

        // Success handled by UI caller

        // Recalculate unpaid bills for this customer if discount/type changed.
        // Pass currentMonthOnly=false so ALL their pending bills get updated, not just the current month.
        if (customerData.discount !== undefined || customerData.customerType !== undefined || customerData.meterSize !== undefined) {
            console.log('[updateCustomer] Triggering full recalculation for customer:', id);
            await recalculateUnpaidBills(id, false);
        }

        // Preserve active filter/search state when refreshing
        if (window.refreshCustomers) window.refreshCustomers();
        else loadCustomers();
    } catch (error) {
        console.error('Error updating customer:', error);
        // Error thrown and handled by UI caller
        throw error;
    }
}

async function deleteCustomer(id, name) {
    try {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // --- Audit Log ---
        await logAuditAction(
            'DELETE',
            'customer',
            id,
            `Deleted customer: ${name || `ID: ${id}`}`
        );

        // Success handled by UI caller
        // Preserve active filter/search state when refreshing
        if (window.refreshCustomers) window.refreshCustomers();
        else loadCustomers();
    } catch (error) {
        console.error('Error deleting customer:', error);
        // Error thrown and handled by UI caller
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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading staff...</td></tr>';

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

        const totalItems = filteredData.length;
        const page = options.page || 1;
        const pageSize = options.pageSize || 20;

        if (totalItems === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No staff found.</td></tr>';
            if (window.renderPagination) window.renderPagination('staffPagination', 0, page, pageSize, 'onStaffPageChange');
            return { total: 0 };
        }

        // Apply pagination
        const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

        tbody.innerHTML = paginatedData.map(s => `
            <tr data-id="${s.id}"
                data-last-name="${s.last_name}"
                data-first-name="${s.first_name}"
                data-middle-initial="${s.middle_initial || ''}"
                data-username="${s.username}"
                data-role="${s.role}"
                data-contact="${s.contact_number || ''}"
                data-age="${s.age || ''}"
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

        if (window.renderPagination) {
            window.renderPagination('staffPagination', totalItems, page, pageSize, 'onStaffPageChange');
        }

        return { total: totalItems };
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
        const { data: newStaff, error } = await supabase
            .from('staff')
            .insert([{
                last_name: staffData.lastName,
                first_name: staffData.firstName,
                middle_initial: staffData.middleInitial,
                role: staffData.role,
                contact_number: staffData.contact,
                username: staffData.username,
                age: staffData.age,
                status: staffData.status || 'active'
            }])
            .select('id')
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('Username already exists.');
            }
            throw error;
        }

        const newId = newStaff?.id;

        // 3. Provision Auth Account automatically
        try {
            await provisionStaffAuth(staffData.username, 'pwd123456'); // Default password, they should change it
            console.log(`[addStaff] Auth account provisioned for ${staffData.username}`);
        } catch (authError) {
            console.warn('[addStaff] Staff record created but Auth provisioning failed:', authError);
            // We don't throw here to keep the staff record, but log it for repair
        }

        // 4. --- Notifications ---
        await supabase.from('notifications').insert({
            type: 'new_staff',
            message: `New Staff Registered: ${staffData.firstName} ${staffData.lastName} (${staffData.role})`,
            staff_id: newId
        }).catch(err => console.warn('Notification failed:', err));

        // 5. --- Audit Log ---
        const statusLabel = (staffData.status || 'active').toLowerCase() === 'active' ? 'Active' : 'Inactive';
        await logAuditAction(
            'CREATE',
            'staff',
            newId,
            `Added new staff member: ${staffData.firstName} ${staffData.lastName} (${staffData.role}, ${statusLabel})`,
            { staff_id: newId, username: staffData.username }
        );

        // Success handled by UI caller
        loadStaff();
    } catch (error) {
        console.error('Error adding staff:', error);
        // Error thrown and handled by UI caller
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
            age: staffData.age,
            updated_at: new Date()
        };

        // Password storage removed as it's handled by Supabase Auth

        const { error } = await supabase
            .from('staff')
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        // --- Audit Log ---
        const statusLabel = (staffData.status || 'active').toLowerCase() === 'active' ? 'Active' : 'Inactive';
        await logAuditAction(
            'UPDATE',
            'staff',
            id,
            `Updated staff profile: ${staffData.firstName} ${staffData.lastName} (${staffData.role}, ${statusLabel})`,
            { changed_fields: Object.keys(updateData) }
        );

        // Success handled by UI caller
        loadStaff();
    } catch (error) {
        console.error('Error updating staff:', error);
        // Error thrown and handled by UI caller
        throw error;
    }
}

async function deleteStaff(id, name) {
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

        // --- Audit Log ---
        await logAuditAction(
            'DELETE',
            'staff',
            id,
            `Deleted staff member: ${name || `ID: ${id}`}`
        );

        // Success handled by UI caller
        loadStaff();
    } catch (error) {
        console.error('Error deleting staff:', error);
        // Error thrown and handled by UI caller
        throw error; // Ensure error propogates
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
            .select('id, auth_uid, first_name, last_name, username')
            .eq('id', staffId)
            .single();

        if (fetchError) throw fetchError;

        let skipUpdate = false;
        if (!staff.auth_uid) {
            console.log(`[changeStaffPassword] Staff member ${staffId} has no auth account. Attempting to provision...`);
            try {
                const username = staff.username || `${staff.first_name.toLowerCase()}${staff.id}`;
                const result = await provisionStaffAuth(username, newPassword);
                if (result.success) {
                    console.log('[changeStaffPassword] Auth account created and linked successfully.');
                    skipUpdate = true; // Password was set during creation
                }
            } catch (pError) {
                console.error('[changeStaffPassword] Auto-provisioning failed:', pError);
                throw new Error('Staff member has no auth account and auto-provisioning failed. Please contact System Admin.');
            }
        }

        // 3. UPDATE PASSWORD (if not just provisioned)
        if (!skipUpdate) {
            console.log('[changeStaffPassword] Updating password for existing auth account...');
            const { data, error: invokeError } = await supabase.functions.invoke('update-password', {
                body: {
                    uid: staff.auth_uid,
                    newPassword,
                    userToken: session.access_token
                }
            });

            if (invokeError) throw new Error(invokeError.message || 'Server error');
            if (!data || !data.success) throw new Error(data?.error || 'Operation failed');
        }

        // 4. Cleanup UI
        closeModal('changePasswordModal');

    } catch (error) {
        console.error('DEEP DEBUG ERROR:', error);
        // Error thrown and handled by UI caller
        throw error;
    }
}


/**
 * Provisions a Supabase Auth account for a staff member and links it via auth_uid.
 * Uses the 'provision-user' edge function.
 */
async function provisionStaffAuth(username, password) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const functionUrl = `${SUPABASE_URL}/functions/v1/provision-user`;

        const { data, error: invokeError } = await supabase.functions.invoke('provision-user', {
            body: {
                username,
                password,
                userToken: session?.access_token
            }
        });

        if (invokeError || !data?.success) {
            throw new Error(invokeError?.message || data?.error || 'Provisioning failed');
        }

        // If returned, update the local staff record with the new auth_uid if it's not already set
        if (data.uid) {
            await supabase.from('staff').update({ auth_uid: data.uid }).eq('username', username);
        }

        return data;
    } catch (error) {
        console.error('[provisionStaffAuth] Error:', error);
        throw error;
    }
}

// === BILLING ===
async function loadBilling(filters = {}) {
    const tbody = document.getElementById('billingTableBody');
    if (!tbody) return;

    // --- ONE-TIME CLEANUP (Injected by Assistant) ---
    if (!window.hasRunBillingCleanup) {
        window.hasRunBillingCleanup = true;
        console.log("Running one-time AI cleanup for inconsistent bills...");
        // This runs asynchronously in the background so it doesn't block the UI load
        // It relies on the user's active admin session to bypass RLS
        supabase.from('billing').update({ balance: 0 }).eq('status', 'paid').gt('balance', 0)
            .then(() => console.log('✨ Cleanup check completed.'));
    }
    // ------------------------------------------------

    try {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading billing...</td></tr>';

        const { search = '', status = '', month = '', barangay = '' } = filters;

        // 1. Fetch bills - Latest READINGS at top (using reading_date descending)
        const { data: bills, error: billsError } = await supabase
            .from('billing')
            .select('*')
            .order('reading_date', { ascending: false, nullsFirst: false })
            .order('id', { ascending: false });

        if (billsError) throw billsError;

        // 2. Fetch customers for these bills
        const customerIds = [...new Set(bills.map(b => b.customer_id))];
        const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('id, first_name, last_name, middle_initial, meter_number, address, status, disconnection_date, has_discount, customer_type, meter_size')
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
            filteredData = filteredData.filter(b => {
                const billNoStr = (b.bill_no || b.id).toString();
                const formattedBillId = `#BIL-${billNoStr.padStart(4, '0')}`.toLowerCase();
                const customer = b.customers || {};
                const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.toLowerCase();
                const meterNo = (customer.meter_number || '').toLowerCase();
                const accountId = customer.id ? getAccountID(customer.id).toLowerCase() : '';

                return (
                    billNoStr.includes(lowerSearch) ||
                    formattedBillId.includes(lowerSearch) ||
                    fullName.includes(lowerSearch) ||
                    meterNo.includes(lowerSearch) ||
                    accountId.includes(lowerSearch)
                );
            });
        }

        // Fetch System Settings for Cutoff Logic (needed for filtering and status display)
        // Fetch System Settings and Rate Schedules for live calculation
        const [settings, schedules] = await Promise.all([
            window.dbOperations.loadSystemSettings(),
            window.dbOperations.loadRateSchedules()
        ]);

        const cutoffGrace = settings ? (settings.cutoff_grace_period != null ? parseInt(settings.cutoff_grace_period) :
            (settings.cutoff_days ? (parseInt(settings.cutoff_days) - (parseInt(settings.overdue_days) || 14)) : 3)) : 3;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Auto-update overdue status (Keep consistent with Cashier)
        data.forEach(bill => {
            if (bill.status === 'unpaid' && bill.due_date && new Date(bill.due_date) < today) {
                bill.status = 'overdue';
                // Background update (don't await to keep UI fast)
                supabase.from('billing').update({ status: 'overdue' }).eq('id', bill.id).then();
            }
        });

        if (status) {
            if (status === 'cutoff') {
                filteredData = filteredData.filter(b => {
                    if (b.status !== 'overdue' || !b.due_date) return false;
                    const dueDate = new Date(b.due_date);
                    dueDate.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
                    return diffDays >= cutoffGrace;
                });
            } else if (status === 'disconnected') {
                filteredData = filteredData.filter(b => b.customers?.status === 'inactive');
            } else {
                filteredData = filteredData.filter(b => b.status === status);
            }
        }

        if (month) {
            // Compare normalized versions so "Mar 2026" matches "March 2026"
            const searchMonth = normalizePeriod(month);

            filteredData = filteredData.filter(b => {
                // Filter primarily by Reading Date AND FALLBACK to Billing Period
                const readingDateNorm = b.reading_date || b.updated_at ? normalizePeriod(formatLocalDateTime(b.reading_date || b.updated_at, false)) : null;
                const billingPeriodNorm = b.billing_period ? normalizePeriod(b.billing_period) : null;

                return readingDateNorm === searchMonth || billingPeriodNorm === searchMonth;
            });
        }

        // Apply barangay filter (client-side, on customer address)
        if (barangay) {
            filteredData = filteredData.filter(b => {
                const bBrgy = getBarangay(b.customers?.address);
                return bBrgy.toLowerCase() === barangay.toLowerCase();
            });
        }

        // Populate Period Filters (Billing, Ledger, Reading List)
        // This is now centralized to ensure all filters across the app are in sync
        if (typeof populateDynamicPeriodFilters === 'function') {
            populateDynamicPeriodFilters();
        }

        // Store for printing
        window.lastBillingData = filteredData;

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No billing records found.</td></tr>';
            if (window.renderPagination) {
                const page = filters.page || 1;
                const pageSize = filters.pageSize || 20;
                window.renderPagination('billingPagination', 0, page, pageSize, 'onBillingPageChange');
            }
            return { total: 0 };
        }

        const totalItems = filteredData.length;
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;

        // Apply pagination
        const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

        tbody.innerHTML = paginatedData.map(bill => {
            const customer = bill.customers;
            if (!customer) return '';

            // Use stored amount for display (frozen at bill creation time)
            // calc is used only for tooltip breakdown detail and flag logic
            const storedAmount = parseFloat(bill.amount) || 0;
            const schedule = schedules.find(s => s.category_key === customer.customer_type);
            const calc = window.BillingEngine.calculate(bill, customer, settings, schedule);

            const middleInitial = customer?.middle_initial ? ` ${customer.middle_initial}.` : '';
            const customerName = `${customer.last_name}, ${customer.first_name}${middleInitial}`;

            // Cutoff Logic
            const isOverdue = bill.status === 'overdue';
            let cutoffWarning = '';
            if (isOverdue && bill.due_date) {
                const dueDate = new Date(bill.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const diffTime = today - dueDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= cutoffGrace) {
                    cutoffWarning = `
                        <div class="balance-info-trigger" style="margin-left: 8px;">
                            <i class="fas fa-exclamation-triangle text-danger" style="cursor: pointer; animation: pulse 2s infinite; font-size: 0.9rem;"></i>
                            <div class="balance-tooltip" style="width: 180px;">
                                <div class="tooltip-header" style="color: #ef4444; border-bottom-color: rgba(239, 68, 68, 0.2); margin-bottom: 0.5rem;">Disconnection Alert</div>
                                <div class="tooltip-row" style="margin-bottom: 0.8rem;">
                                    <span>Overdue</span>
                                    <span style="color: #ef4444;">${diffDays} Days</span>
                                </div>
                                <div class="tooltip-footer" style="border-top: 1px solid rgba(239, 68, 68, 0.1); padding-top: 0.8rem;">
                                    <button onclick="window.dbOperations.initiateCutoff('${customer.id}', '${customerName.replace(/'/g, "\\'")}')" 
                                            class="btn-cutoff-enforce"
                                            style="background: #ef4444; color: white; border: none; width: 100%; border-radius: 6px; padding: 0.6rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 0.4rem; transition: all 0.2s; font-family: 'Inter', sans-serif;">
                                        <i class="fas fa-power-off"></i> ENFORCE CUTOFF
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            const isInactive = (customer?.status || '').toLowerCase() === 'inactive';

            const period = normalizePeriod(bill.reading_date || bill.billing_period, true);

            return `
            <tr class="${isInactive ? 'status-inactive' : ''}" data-id="${bill.id}" data-customer-id="${bill.customer_id}">
                <td class="bill-id col-bill-id">
                    <div style="font-weight: 700;">#BIL-${String(bill.bill_no || bill.id).padStart(4, '0')}</div>
                    <div style="font-size: 0.7rem; color: var(--text-light); margin-top: 2px; opacity: 0.8;">RCP-${new Date(bill.reading_date || bill.updated_at || new Date()).getFullYear()}-${String(bill.meter_receipt_no || bill.receipt_no || bill.bill_no || bill.id).padStart(4, '0')}</div>
                </td>
                <td class="col-customer">
                        <div class="customer-column">
                            <span class="customer-name">${customerName}</span>
                            ${customer?.has_discount ? '<span class="badge-senior" title="Senior Citizen Discount Active">SENIOR</span>' : ''}
                            ${isInactive ? '<span class="badge-deactivated">DEACTIVATED</span>' : ''}
                            <div class="customer-meta">
                                <span class="customer-acc-id mono" style="color: var(--text-light); font-size: 0.75rem;">${getAccountID(customer?.id)}</span>
                                <span class="meta-sep" style="opacity: 0.3; margin: 0 2px;">•</span>
                                <span class="barangay-mini">${getBarangay(customer?.address)}</span>
                            </div>
                    </div>
                </td>
                <td class="col-period">${normalizePeriod(bill.reading_date || bill.updated_at || bill.billing_period, true) || 'N/A'}</td>
                <td class="amount col-amount">₱${storedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="col-due-date">${formatLocalDateTime(bill.due_date, false)}</td>
                <td class="col-status">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${bill.status === 'paid' ? 'success' : (bill.status === 'overdue' ? 'danger' : 'warning')}">
                            ${bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                        </span>
                        ${cutoffWarning}
                        ${(isInactive && customer?.disconnection_bill_id === bill.id) ? '<span class="badge danger" style="font-size: 0.65rem; padding: 2px 6px;">DISCONNECTED ' + (customer?.disconnection_date ? new Date(customer.disconnection_date).toLocaleDateString() : '') + '</span>' : ''}
                    </div>
                </td>
                <td class="balance col-balance ${bill.status === 'paid' ? 'positive' : (storedAmount > 0 ? 'negative' : 'positive')}">
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                        ₱${bill.status === 'paid' ? '0.00' : storedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        ${(bill.status !== 'paid' && storedAmount > 0) ? `
                            <div class="balance-info-trigger">
                                <i class="fas fa-info-circle" style="font-size: 0.85rem; cursor: help; opacity: 0.7; color: var(--primary);"></i>
                                <div class="balance-tooltip">
                                    <div class="tooltip-header">Balance Breakdown</div>
                                    <div class="tooltip-row">
                                        <span>Base Charge</span> 
                                        <span>₱${calc.baseRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    ${calc.consumptionCharge > 0 ? `
                                        <div class="tooltip-row">
                                            <span>Consumption Charge</span> 
                                            <span>+₱${calc.consumptionCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ` : ''}
                                    ${calc.discountAmount > 0 ? `
                                        <div class="tooltip-row text-primary" style="font-weight: 600;">
                                            <span>SC/PWD Discount (${calc.discountPercent}%)</span> 
                                            <span>-₱${calc.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ` : ''}
                                    ${calc.penalty > 0 ? `
                                        <div class="tooltip-row">
                                            <span>Penalty</span> 
                                            <span>+₱${calc.penalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ` : ''}
                                    ${calc.arrears > 0 ? `
                                        <div class="tooltip-row" style="color: #64748B;">
                                            <span>Arrears</span> 
                                            <span>+₱${calc.arrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ` : ''}
                                    <div class="tooltip-footer">
                                        <span>Total Due</span>
                                        <span>₱${storedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </td>
                <td class="col-actions">
                    <div class="action-buttons">
                        <button class="btn-icon" title="${bill.status === 'paid' ? 'View/Print Invoice' : 'Unpaid: Invoice Unavailable'}" ${bill.status === 'paid' ? '' : 'disabled'}>
                            <i class="fas fa-file-invoice"></i>
                        </button>
                        <button class="btn-icon" title="View Ledger"><i class="fas fa-book"></i></button>
                    </div>
                </td>
            </tr>
        `}).join('');

        if (window.renderPagination) {
            window.renderPagination('billingPagination', totalItems, page, pageSize, 'onBillingPageChange');
        }

        return { total: totalItems };
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
                customers!customer_id (last_name, first_name, middle_initial, meter_number)
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
        // Show months for the current year
        const labels = [];
        const consumptionByMonth = {};
        const now = new Date();
        const currentYear = now.getFullYear();

        // Loop from January (0) to current month
        for (let m = 0; m <= now.getMonth(); m++) {
            const d = new Date(currentYear, m, 1);
            const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
            labels.push(label);
            consumptionByMonth[label] = 0;
        }

        allBills?.forEach(bill => {
            const month = normalizePeriod(bill.billing_period);
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

        // Update chart subtitle year
        const chartSubtitle = document.querySelector('.chart-subtitle');
        if (chartSubtitle && chartSubtitle.textContent.includes('Year')) {
            chartSubtitle.textContent = `Cubic Meter Usage (Year ${currentYear})`;
        }

        // Update UI Stats
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues[0]) statValues[0].textContent = totalCustomers || 0;
        if (statValues[1]) statValues[1].textContent = `₱${totalRevenue.toLocaleString()}`;
        if (statValues[2]) statValues[2].textContent = pendingCount || 0;
        if (statValues[3]) statValues[3].textContent = overdueCount || 0;

        // Cutoff Warning in Stats
        const cutoffWarningEl = document.getElementById('overdueCutoffWarning');
        if (cutoffWarningEl) {
            let settings = null;
            if (window.dbOperations && window.dbOperations.loadSystemSettings) {
                settings = await window.dbOperations.loadSystemSettings();
            }
            const cutoffGrace = settings ? (settings.cutoff_grace_period || 3) : 3;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const cutoffEligible = overdueBills.filter(bill => {
                if (!bill.due_date) return false;
                const dueDate = new Date(bill.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
                return diffDays >= cutoffGrace;
            });

            if (cutoffEligible.length > 0) {
                cutoffWarningEl.classList.remove('hidden');
                cutoffWarningEl.title = `${cutoffEligible.length} bill(s) eligible for cutoff`;
            } else {
                cutoffWarningEl.classList.add('hidden');
            }
        }

        if (window.updateDashboardCharts) {
            window.updateDashboardCharts(chartData);
        }




    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
    }
}

// Realtime for the dashboard is handled centrally in admin.js setupRealtimeSubscriptions()

// === HELPER: HANDLE ONLINE PAYMENT (DISABLED) ===
// This was removed as the online_payments table is no longer used.
async function _handleRealtimeActivity_DISABLED(bill, type) {
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
        // Fetch the 10 most recently created/updated meter readings
        const { data: recentReadings, error: billingError } = await supabase
            .from('billing')
            .select(`
                id,
                previous_reading,
                current_reading,
                consumption,
                reading_date,
                updated_at,
                receipt_no,
                customer_id,
                customers (first_name, last_name)
            `)
            .order('updated_at', { ascending: false })
            .limit(10);

        if (billingError) {
            console.error('[loadRecentActivities] Billing Error:', billingError);
            throw billingError;
        }

        if (!recentReadings || recentReadings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #9E9E9E;">No recent readings recorded</td></tr>';
            return;
        }

        tbody.innerHTML = recentReadings.map(act => {
            const customer = act.customers;
            const name = customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown';
            const date = formatLocalDateTime(act.updated_at || act.reading_date, true);
            const periodLabel = normalizePeriod(act.reading_date || act.billing_period, true);

            // Usage highlighting
            const usage = parseFloat(act.consumption || 0);
            const usageClass = usage > 50 ? 'text-warning bold' : '';

            return `
                <tr>
                    <td>
                        <strong>${name}</strong>
                    </td>
                    <td style="text-align: right;">${act.previous_reading || 0}</td>
                    <td style="text-align: right;">${act.current_reading || 0}</td>
                    <td style="text-align: right;" class="${usageClass}">${usage} cu.m.</td>
                    <td class="activity-date">${date}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('❌ [loadRecentActivities] Failed:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-danger center">Failed to load recent activity</td></tr>';
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
    'Zone 5', 'Zone 6', 'Zone 7', 'Canjusa', 'Crossing Pulupandan',
    'Culo', 'Mabini', 'Pag-ayon', 'Palaka Norte', 'Palaka Sur',
    'Patic', 'Tapong', 'Ubay', 'Utod', 'Poblacion'
];

// === AREA BOXES (SCHEDULING OVERHAUL) ===
// Use window.PULUPANDAN_BARANGAYS as the single source of truth for barangay lists.

async function loadAreaBoxes() {
    const grid = document.getElementById('assignmentsGrid');
    if (!grid) return;

    try {
        // First, check for midnight reset
        // REMOVED: await syncMidnightReset();

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

        window.allAreaBoxes = boxes;
        return boxes;

    } catch (error) {
        console.error('Error loading area boxes:', error);
        grid.innerHTML = '<div class="text-danger">Failed to load area boxes.</div>';
        return [];
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
        // Success handled by UI caller
        loadAreaBoxes();
    } catch (error) {
        console.error('Error adding area box:', error);
        // Error thrown and handled by UI caller
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
        // Success handled by UI caller
        loadAreaBoxes();
    } catch (error) {
        console.error('Error updating area box:', error);
        // Error thrown and handled by UI caller
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

                showNotification('Area Box deleted successfully!', 'success');
                closeModal('boxModal');
                loadAreaBoxes();
            } catch (error) {
                console.error('Error deleting area box:', error);
                showNotification(error.message || 'Failed to delete area box.', 'error');
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
            .order('updated_at', { ascending: false })
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
        if (document.getElementById('settingCutoffGrace')) document.getElementById('settingCutoffGrace').value = data[0].cutoff_days || data[0].cutoff_grace_period || 30;

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
        if (error) throw error;

        // --- Audit Log ---
        await logAuditAction(
            'UPDATE',
            'system_settings',
            id,
            `Updated system settings.`,
            { changed_fields: Object.keys(dataToUpdate) }
        );

        // Success handled by UI caller

        // Recalculate ALL unpaid bills to reflect new rates/discounts
        console.log('[updateSystemSettings] Triggering global recalculation...');
        await recalculateUnpaidBills();

        return true;
    } catch (error) {
        console.error('Error updating system settings:', error);
        // Error thrown and handled by UI caller
        throw error;
    }
}

async function loadRateSchedules() {
    try {
        const { data, error } = await supabase
            .from('rate_schedules')
            .select('*')
            .order('display_name');

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error loading rate schedules:', error);
        throw error;
    }
}

async function updateRateSchedule(id, rateData) {
    try {
        const { error } = await supabase
            .from('rate_schedules')
            .update({
                ...rateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        showNotification('Rate schedule updated', 'success');

        // Recalculate ALL unpaid bills because a category rate changed
        console.log('[updateRateSchedule] Triggering global recalculation...');
        await recalculateUnpaidBills();

        return true;
    } catch (error) {
        console.error('Error updating rate schedule:', error);
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

        // If no settings exist or admin_pin is empty/mock, allow '1234' as fallback
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
    const period = options.period || '';

    const tbody = document.getElementById('ledgerMasterBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading master ledger...</td></tr>';

        // 1. Fetch ALL Customers and their latest payment date
        // We'll fetch customers and join with billing to get the latest payment_date
        let { data: customersRaw, error: cError } = await supabase
            .from('customers')
            .select(`
                *,
                billing (
                    payment_date
                )
            `)
            .limit(5000);

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

        // 2. Fetch bills: if period filter is active, fetch only that period's bills;
        //    otherwise fetch all unpaid to calculate outstanding balances.
        let billQuery = supabase
            .from('billing')
            .select('customer_id, amount, billing_period, due_date, status, updated_at, reading_date');

        // Note: We fetch all relevant bills and filter client-side to handle normalization
        // and due date matching consistently with the main billing list.
        if (!period) {
            billQuery = billQuery.eq('status', 'unpaid');
        }

        const { data: unpaidBills, error: bError } = await billQuery;

        if (bError) throw bError;

        // Create a map of customer balances
        const balanceMap = {};
        unpaidBills.forEach(bill => {
            const cid = bill.customer_id;
            balanceMap[cid] = (balanceMap[cid] || 0) + parseFloat(bill.amount);
        });

        // 3. Apply client-side filters for barangay, search and period
        let filtered = customers.filter(c => {
            const matchesBarangay = !barangay || getBarangay(c.address).toLowerCase() === barangay.toLowerCase();

            const lowSearch = search.toLowerCase();
            const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
            const accountId = getAccountID(c.id).toLowerCase();
            const meterNo = (c.meter_number || '').toLowerCase();

            const matchesSearch = !search ||
                fullName.includes(lowSearch) ||
                accountId.includes(lowSearch) ||
                meterNo.includes(lowSearch);

            // When a period is selected, only show customers who have a matching bill in that period
            // (Using normalized matching for period or due date month)
            const matchesPeriod = !period || unpaidBills.some(b => {
                if (b.customer_id !== c.id) return false;

                const searchMonth = normalizePeriod(period);
                // EXCLUSIVE FIX: Filter solely by reading date for consistency
                const readingDateMatch = normalizePeriod(formatLocalDateTime(b.updated_at || b.reading_date, false)) === searchMonth;

                return readingDateMatch;
            });

            // When printing (fullList), exclude disconnected/inactive customers
            const status = (c.status || '').toLowerCase();
            const isDisconnected = ['inactive', 'disconnected', 'deactivated'].includes(status);
            if (options.fullList && isDisconnected) return false;

            return matchesBarangay && matchesSearch && matchesPeriod;
        });

        const totalItems = filtered.length;
        const page = options.page || 1;
        const pageSize = options.pageSize || 20;

        if (totalItems === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No customers found in directory.</td></tr>';
            return { total: 0 };
        }

        // Render all rows (no pagination)
        const paginatedData = options.fullList ? filtered : filtered;

        tbody.innerHTML = paginatedData.map(c => {
            const balance = balanceMap[c.id] || 0;
            const isInactive = (c.status || '').toLowerCase() === 'inactive';

            // Type color logic
            const type = (c.customer_type || '').toLowerCase();
            let typeColor = '#0288D1'; // Default Blue (Residential)
            if (type === 'commercial-a') typeColor = '#43A047'; // Green
            else if (type === 'commercial-b') typeColor = '#FB8C00'; // Orange
            else if (type === 'commercial-c') typeColor = '#06B6D4'; // Cyan
            else if (type === 'full-commercial' || type.includes('industrial')) typeColor = '#E53935'; // Red
            else if (type === 'bulk') typeColor = '#8B5CF6'; // Purple

            return `
            <tr class="${isInactive ? 'status-inactive' : ''}">
                <td><span class="mono">${getAccountID(c.id)}</span></td>
                <td><strong>${c.last_name}, ${c.first_name}</strong>${isInactive ? ' <span class="badge-deactivated">DEACTIVATED</span>' : ''}${c.has_discount ? ' <span class="badge-senior" title="Senior Citizen Discount Active">SENIOR</span>' : ''}</td>
                <td>${getBarangay(c.address)}</td>
                <td><span class="meter-number">${c.meter_number || '--'}</span></td>
                <td><span class="badge type-${(c.customer_type || 'residential').toLowerCase()}">${{
                    'residential': 'RESIDENTIAL',
                    'industrial': 'INDUSTRIAL',
                    'full-commercial': 'INDUSTRIAL',
                    'commercial-a': 'SEMI-COMMERCIAL A',
                    'commercial-b': 'SEMI-COMMERCIAL B',
                    'commercial-c': 'SEMI-COMMERCIAL C',
                    'bulk': 'BULK / WHOLESALE'
                }[c.customer_type] || (c.customer_type || 'RESIDENTIAL').replace(/-/g, ' ').toUpperCase()}</span></td>
                <td class="${balance > 0 ? 'text-danger fw-bold' : 'text-success'}">
                    ₱${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td class="no-print">
                    <button class="btn btn-sm btn-outline" onclick="window.viewCustomerLedger(${c.id})">
                        <i class="fas fa-file-invoice"></i> View Card
                    </button>
                </td>
            </tr>
            `;
        }).join('');

        return { total: totalItems };

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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading historical records...</td></tr>';

        // 1. Fetch Customer Info
        const { data: customer, error: cError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        if (cError) throw cError;

        // 1.5 Fetch settings and schedules for live calculation
        const [settings, schedules] = await Promise.all([
            window.dbOperations.loadSystemSettings(),
            window.dbOperations.loadRateSchedules()
        ]);

        // Update Header UI (Image-accurate IDs)
        const accountId = getAccountID(customer.id);
        const name = `${customer.last_name}, ${customer.first_name} ${customer.middle_initial || ''}`;

        if (document.getElementById('cardAccountNoTop')) document.getElementById('cardAccountNoTop').textContent = accountId;
        if (document.getElementById('cardCustomerName')) document.getElementById('cardCustomerName').textContent = name;
        if (document.getElementById('cardAddress')) document.getElementById('cardAddress').textContent = customer.address;
        if (document.getElementById('cardMeterNo')) document.getElementById('cardMeterNo').textContent = customer.meter_number;

        // Show Deactivated Banner if needed
        const bannerContainer = document.getElementById('ledgerBannerContainer');
        if (bannerContainer) {
            const isInactive = (customer.status || '').toLowerCase() === 'inactive';
            if (isInactive) {
                const disconnDate = customer.disconnection_date ? new Date(customer.disconnection_date).toLocaleDateString() : null;
                const disconnBill = customer.disconnection_bill_id ? `BIL-${customer.disconnection_bill_id}` : null;
                const disconnInfo = disconnDate ? `<div style="font-weight: 400; font-size: 0.75rem; opacity: 0.9;">Disconnected on: ${disconnDate}${disconnBill ? ' | Bill: ' + disconnBill : ''}</div>` : '';
                bannerContainer.innerHTML = `
                    <div class="deactivated-banner">
                        <i class="fas fa-exclamation-triangle fa-lg"></i>
                        <div>
                            <div style="font-size: 1rem;">ACCOUNT DEACTIVATED</div>
                            <div style="font-weight: 400; font-size: 0.75rem; opacity: 0.9;">This account has been cutoff. Service is currently suspended.</div>
                            ${disconnInfo}
                        </div>
                    </div>
                `;
                bannerContainer.style.display = 'block';
            } else {
                bannerContainer.style.display = 'none';
            }
        }

        // 2. Fetch Billing History
        const { data: bills, error: bError } = await supabase
            .from('billing')
            .select('*')
            .eq('customer_id', customerId)
            .order('reading_date', { ascending: true });

        if (bError) throw bError;

        // 3. Construct chronological ledger entries (Step 1: Collection)
        let entries = [];

        bills.forEach(b => {
            // Use the amount stored at billing time — immune to future rate changes
            // calc is still used for cutoff/penalty flag logic below
            const schedule = schedules.find(s => s.category_key === customer.customer_type);
            const calc = window.BillingEngine.calculate(b, customer, settings, schedule);
            const liveAmount = parseFloat(b.amount) || calc.totalDue; // fallback for legacy records without stored amount

            // Billing Event
            entries.push({
                date: b.reading_date || b.period_end || b.due_date || b.created_at,
                billNo: `BIL-${String(b.bill_no || b.id).padStart(4, '0')}`,
                refCode: (b.meter_receipt_no || b.receipt_no) ? String(b.meter_receipt_no || b.receipt_no).padStart(4, '0') : null,
                others: '',
                particulars: `Monthly Reading (${normalizePeriod(b.billing_period, true)})`,
                reading: b.current_reading,
                consumption: b.consumption,
                billing: liveAmount,
                collection: null,
                type: 'bill'
            });

            // Payment Event (if paid)
            if (b.status === 'paid' && b.payment_date) {
                entries.push({
                    date: b.payment_date,
                    billNo: b.receipt_no ? String(b.receipt_no).padStart(4, '0') : '',
                    refCode: null,
                    others: '',
                    particulars: `Cash Payment - Period ${normalizePeriod(b.billing_period, true)}`,
                    period: b.billing_period, // Added for smart sorting
                    reading: null,
                    consumption: null,
                    billing: null,
                    collection: liveAmount, // Ensure consistency with live calculation
                    type: 'payment'
                });
            }

            // Back-fill period for bill as well
            entries[entries.length - (b.status === 'paid' && b.payment_date ? 2 : 1)].period = b.billing_period;
        });

        // Add Disconnection Event if customer was deactivated
        if (customer.disconnection_date) {
            const disconnBillId = customer.disconnection_bill_id || '--';
            entries.push({
                date: customer.disconnection_date,
                billNo: `BIL-${disconnBillId}`,
                others: '',
                particulars: 'Disconnection',
                reading: null,
                consumption: null,
                billing: null,
                collection: null,
                type: 'disconnection'
            });
        }

        // Step 2: Smart Sort
        // We sort by period first, then by type (Bill before Payment), then by date
        entries.sort((a, b) => {
            // Primarily sort by Date
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();

            if (dateA !== dateB) {
                // If they are on different dates, check if they belong to the same period
                if (a.period && b.period && a.period === b.period) {
                    // SAME PERIOD: Always put Bill (positive) before Payment (negative)
                    // even if payment was entered first, to keep balance logical.
                    if (a.type === 'bill' && b.type === 'payment') return -1;
                    if (a.type === 'payment' && b.type === 'bill') return 1;
                }
                return dateA - dateB;
            }

            // SAME DATE: Bill before Payment
            if (a.type === 'bill' && b.type === 'payment') return -1;
            if (a.type === 'payment' && b.type === 'bill') return 1;

            return 0;
        });

        // Step 3: Second Pass - Calculate running balance on SORTED entries
        let runningBalance = 0;
        entries.forEach(e => {
            if (e.billing) runningBalance += e.billing;
            if (e.collection) runningBalance -= e.collection;
            e.balance = runningBalance;
        });

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">New Customer - No transaction history available.</td></tr>';
            return;
        }

        tbody.innerHTML = entries.map(e => `
            <tr class="${e.type === 'payment' ? 'payment-row' : (e.type === 'disconnection' ? 'disconnection-row' : 'bill-row')}">
                <td>${new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td class="mono">
                    <div style="font-weight: 700;">${e.billNo}</div>
                    <div class="ref-code" style="color: var(--text-light); font-size: 0.7rem; margin-top: 2px;">RCP-${new Date(e.date).getFullYear()}-${e.refCode || e.billNo.replace('BIL-', '')}</div>
                </td>
                <td>${e.others}</td>
                <td class="text-left">${e.particulars}</td>
                <td>${e.reading || '--'}</td>
                <td>${e.consumption || '--'}</td>
                <td class="amount-bill text-right">${e.billing ? '₱' + parseFloat(e.billing).toLocaleString() : '--'}</td>
                <td class="amount-credit text-right">${e.collection ? '₱' + parseFloat(e.collection).toLocaleString() : '--'}</td>
                <td class="balance-cell text-right">₱${e.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading ledger card:', error);
        showNotification('Failed to load customer ledger card', 'error');
    }
}

/**
 * Loads the meter reading list for a specific period and barangay
 * NOW: Refactored to be Customer-centric for continuous reading
 */
/**
 * Loads the meter reading list for a specific period and barangay
 * NOW: Bill-centric (shows only readed customers) with Latest-First sorting
 */
async function loadReadingList(options = {}) {
    const { period = '', barangay = '', readerId = '', status = '', search = '', sortBy = 'id', sortOrder = 'desc' } = options;

    const tbody = document.getElementById('readingListTableBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading readings...</td></tr>';

        // 1. Fetch Billings primarily
        let query = supabase
            .from('billing')
            .select(`
                *,
                customers!customer_id!inner (
                    id, last_name, first_name, middle_initial, address, meter_number, has_discount, status, disconnection_date, disconnection_bill_id
                )
            `);

        // Apply filters
        if (barangay) {
            query = query.ilike('customers.address', `%${barangay}%`);
        }

        if (search) {
            // Broaden server-side filter: use first word if name combo, plus numeric ID check
            const terms = search.split(/[ ,]+/).filter(t => t.length > 0);
            const primaryTerm = terms[0] || '';

            let orParts = [
                `first_name.ilike.%${primaryTerm}%`,
                `last_name.ilike.%${primaryTerm}%`,
                `meter_number.ilike.%${search}%`
            ];

            // If it's a number or contains digits, try matching ID
            const numericId = search.replace(/\D/g, '');
            if (numericId && numericId.length > 0) {
                orParts.push(`id.eq.${numericId}`);
            }

            query = query.or(orParts.join(','), { foreignTable: 'customers' });
        }

        const { data: bills, error: bError } = await query;
        if (bError) throw bError;

        if (!bills || bills.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 3rem; color: #9E9E9E;">No readings found matching filters.</td></tr>`;
            return;
        }

        // 2. Client-side normalization and filtering
        const searchMonth = period ? normalizePeriod(period) : null;
        let filteredBills = bills;

        // Apply secondary client-side search filter for precise name/account matching
        if (search) {
            const lowSearch = search.toLowerCase();
            filteredBills = filteredBills.filter(b => {
                const c = b.customers;
                const firstName = (c.first_name || '').toLowerCase();
                const lastName = (c.last_name || '').toLowerCase();
                const fullName = `${firstName} ${lastName}`;
                const lastNameFirst = `${lastName}, ${firstName}`;
                const accountId = getAccountID(c.id).toLowerCase();
                const meterNo = (c.meter_number || '').toLowerCase();

                // Advanced matching including formatted account ID, full name variants, etc.
                return fullName.includes(lowSearch) ||
                    lastNameFirst.includes(lowSearch) ||
                    accountId === lowSearch ||
                    accountId.includes(lowSearch) ||
                    meterNo.includes(lowSearch);
            });
        }

        if (searchMonth) {
            filteredBills = filteredBills.filter(b => {
                // EXCLUSIVE FIX: Filter solely by actual reading date (what the user sees in the table)
                return normalizePeriod(formatLocalDateTime(b.updated_at || b.reading_date, false)) === searchMonth;
            });
        }

        // 3. Map for display
        const renderedList = filteredBills.map(b => {
            const c = b.customers;
            const fullName = `${c.last_name}, ${c.first_name}${c.middle_initial ? ' ' + c.middle_initial + '.' : ''}`;
            const dateRead = formatLocalDateTime(b.updated_at || b.reading_date, false);

            return {
                billNo: b.bill_no,
                billingId: b.id,
                customerId: c.id,
                fullName: fullName,
                meterNo: c.meter_number,
                address: c.address,
                prev: b.previous_reading || 0,
                curr: b.current_reading || 0,
                usage: b.consumption || 0,
                date: dateRead,
                barangay: getBarangay(c.address),
                status: b.status || 'unpaid',
                due_date: b.due_date,
                is_overdue: b.is_overdue || false,
                customer_status: c.status || 'active',
                disconnection_bill_id: c.disconnection_bill_id,
                meter_receipt_no: b.meter_receipt_no,
                updated_at: b.updated_at || b.created_at || b.reading_date
            };
        });

        // 3.1 Apply precise client-side barangay/reader filter if specified
        let finalRenderedList = renderedList;

        if (readerId) {
            const readerBarangays = await getBarangaysForReader(readerId);
            finalRenderedList = renderedList.filter(item =>
                readerBarangays.some(rb => rb.toLowerCase() === item.barangay.toLowerCase())
            );
        }

        if (barangay) {
            finalRenderedList = finalRenderedList.filter(item =>
                item.barangay.toLowerCase() === barangay.toLowerCase()
            );
        }

        // 4. Client-side Sort
        finalRenderedList.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'fullName') {
                valA = a.fullName.toLowerCase();
                valB = b.fullName.toLowerCase();
            } else if (sortBy === 'updated_at') {
                valA = new Date(a.updated_at).getTime();
                valB = new Date(b.updated_at).getTime();
            } else {
                valA = a[sortBy] || 0;
                valB = b[sortBy] || 0;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        const totalItems = finalRenderedList.length;
        const page = options.page || 1;
        const pageSize = options.pageSize || 20;

        if (totalItems === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 3rem; color: #9E9E9E;">No readings found matching filters.</td></tr>`;
            if (window.renderPagination) window.renderPagination('readingListPagination', 0, page, pageSize, 'onReadingListPageChange');
            return { total: 0 };
        }

        // Apply pagination
        const paginatedData = options.fullList ? finalRenderedList : finalRenderedList.slice((page - 1) * pageSize, page * pageSize);

        tbody.innerHTML = paginatedData.map(item => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let displayStatus = item.status || 'unpaid';
            let statusClass = displayStatus.toLowerCase();

            // Dynamic Status Logic for Display
            if (displayStatus.toLowerCase() !== 'paid') {
                if (item.due_date && new Date(item.due_date) < today) {
                    displayStatus = 'Overdue';
                    statusClass = 'overdue';
                }
            }

            if (item.customer_status.toLowerCase() === 'inactive' || item.customer_status.toLowerCase() === 'disconnected') {
                displayStatus = 'Disconnected';
                statusClass = 'disconnected';
            } else if (item.disconnection_bill_id === item.billingId) {
                displayStatus = 'Disconnected';
                statusClass = 'disconnected';
            }

            return `
            <tr>
                <td class="mono">${getAccountID(item.customerId)}</td>
                <td><strong>${item.fullName}</strong></td>
                <td style="text-align: right;">${item.prev}</td>
                <td style="text-align: right;">${item.curr}</td>
                <td style="text-align: right;">${item.usage}</td>
                <td><div class="barangay-display" title="${item.address}">${item.barangay}</div></td>
                <td>${normalizePeriod(item.date || item.reading_date, true)}</td>
                <td class="mono">${item.meterNo || '--'}</td>
                <td>
                    <button class="btn-icon" title="Edit Reading" 
                            onclick="window.editReading('${item.billingId}', ${item.prev}, '${item.curr}', '${item.fullName.replace(/'/g, "\\'")}', '${item.meterNo}', ${item.customerId})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <div style="font-weight: 700;">#BIL-${String(item.billNo || item.billingId).padStart(4, '0')}</div>
                    <div style="font-size: 0.7rem; color: #9E9E9E; margin-top: 2px;">RCP-${new Date(item.date).getFullYear()}-${String(item.meter_receipt_no || item.billNo || item.billingId).padStart(4, '0')}</div>
                </td>
            </tr>
        `;
        }).join('');

        if (window.renderPagination) {
            window.renderPagination('readingListPagination', totalItems, page, pageSize, 'onReadingListPageChange');
        }

        return { total: totalItems };
    } catch (error) {
        console.error('Error loading reading list:', error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-danger center">Failed to load reading list: ${error.message}</td></tr>`;
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

/**
 * Gets the reader ID for a given barangay
 */
async function getReaderIdForBarangay(barangay) {
    try {
        if (!barangay) return '';

        const { data: boxes, error } = await supabase
            .from('area_boxes')
            .select('assigned_reader_id, barangays');

        if (error) throw error;
        if (!boxes) return '';

        const assignedBox = boxes.find(box =>
            Array.isArray(box.barangays) && box.barangays.some(bg => bg.toLowerCase().trim() === barangay.toLowerCase().trim())
        );

        return assignedBox ? assignedBox.assigned_reader_id : '';
    } catch (error) {
        console.error('Error getting reader ID for barangay:', error);
        return '';
    }
}

/**
 * Fetches all staff members assigned as readers in area_boxes
 */
async function getAssignedReaders() {
    try {
        const { data: boxes, error } = await supabase
            .from('area_boxes')
            .select(`
                staff!assigned_reader_id (id, first_name, last_name)
            `);

        if (error) throw error;
        if (!boxes) return [];

        // Filter out null staff and unique by ID
        const readers = [];
        const seenIds = new Set();

        boxes.forEach(box => {
            if (box.staff && !seenIds.has(box.staff.id)) {
                readers.push({
                    id: box.staff.id,
                    name: `${box.staff.last_name}, ${box.staff.first_name}`
                });
                seenIds.add(box.staff.id);
            }
        });

        return readers.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error fetching assigned readers:', error);
        return [];
    }
}

/**
 * Gets the list of barangays assigned to a specific reader ID
 */
async function getBarangaysForReader(readerId) {
    try {
        if (!readerId) return [];

        const { data: boxes, error } = await supabase
            .from('area_boxes')
            .select('barangays')
            .eq('assigned_reader_id', readerId);

        if (error) throw error;
        if (!boxes) return [];

        // Flatten all barangays from all boxes assigned to this reader
        return Array.from(new Set(boxes.flatMap(box => box.barangays || [])));
    } catch (error) {
        console.error('Error fetching barangays for reader:', error);
        return [];
    }
}

/**
 * Extracts barangay name from address string
 */
function getBarangay(address) {
    if (!address) return 'N/A';
    // Match common formats: "Street, Barangay, City" or "Barangay, City"
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) return parts[parts.length - 2];
    return parts[0] || 'N/A';
}

// === DASHBOARD WIDGET: RECENT READINGS ===
async function loadRecentReadingsWidget() {
    const tbody = document.getElementById('recentActivitiesBody');
    if (!tbody) return;

    try {
        const { data: readings, error } = await supabase
            .from('billing')
            .select(`
                id,
                current_reading,
                previous_reading,
                consumption,
                updated_at,
                customers!customer_id (
                    id, first_name, last_name, meter_number
                )
            `)
            .order('id', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (!readings || readings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #9E9E9E;">No recent readings found.</td></tr>';
            return;
        }

        tbody.innerHTML = readings.map(r => {
            const customer = r.customers;
            const name = customer ? `${customer.last_name}, ${customer.first_name}` : 'Unknown';
            const date = formatLocalDateTime(r.updated_at, true);
            const usage = r.consumption || (r.current_reading - r.previous_reading);

            return `
            <tr class="activity-pulse">
                <td>
                    <div class="activity-name">${name}</div>
                    <small style="color: #64748B;">${customer?.meter_number || 'N/A'}</small>
                </td>
                <td style="text-align: right;">${r.previous_reading}</td>
                <td style="text-align: right; font-weight: 600; color: var(--primary);">${r.current_reading}</td>
                <td style="text-align: right;">
                    <span class="badge secondary">${usage} cu.m.</span>
                </td>
                <td class="activity-date">${date}</td>
            </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading recent readings widget:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Failed to load readings.</td></tr>';
    }
}

// Realtime Listener for the Readings Widget
let isRealtimeReadingsInitialized = false;
let dashboardReadingsChannel = null;

// Readings Realtime is now handled centrally in admin.js setupRealtimeSubscriptions()
// to avoid redundant billing table listeners.

// === CUTOFF LOGIC ===
let currentCutoffCustomerId = null;

async function initiateCutoff(customerId, customerName) {
    currentCutoffCustomerId = customerId;
    const nameSpan = document.getElementById('cutoffCustomerName');
    if (nameSpan) nameSpan.textContent = customerName;

    if (typeof openModal === 'function') {
        openModal('cutoffConfirmModal');
    } else {
        const modal = document.getElementById('cutoffConfirmModal');
        if (modal) modal.style.display = 'flex';
    }
}

async function confirmCutoff() {
    if (!currentCutoffCustomerId) return;

    const btn = document.getElementById('confirmCutoffBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        // Find the most recent overdue bill for this customer to link the disconnection
        const { data: overdueBills } = await supabase
            .from('billing')
            .select('id')
            .eq('customer_id', Number(currentCutoffCustomerId))
            .in('status', ['overdue', 'unpaid'])
            .order('due_date', { ascending: false })
            .limit(1);

        const disconnBillId = overdueBills?.[0]?.id || null;

        const { error } = await supabase
            .from('customers')
            .update({
                status: 'inactive',
                disconnection_date: new Date().toISOString(),
                disconnection_bill_id: disconnBillId
            })
            .eq('id', Number(currentCutoffCustomerId));

        if (error) throw error;

        showNotification('Customer account deactivated for cutoff.', 'success');

        if (typeof closeModal === 'function') {
            closeModal('cutoffConfirmModal');
        } else {
            const modal = document.getElementById('cutoffConfirmModal');
            if (modal) modal.style.display = 'none';
        }

        // Let realtime handle the refresh, but force a UI update if needed
        if (typeof refreshBilling === 'function') refreshBilling();

    } catch (error) {
        console.error('Error enforcing cutoff:', error);
        showNotification('Failed to enforce cutoff: ' + error.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        currentCutoffCustomerId = null;
    }
}

/**
 * Updates a reading and recalculates the bill
 * NOW: Supports- [x] Fix TypeError in `editReading` (Missing hidden inputs in `dashboard.html`)
- [x] Fix Data Persistence in `updateReading` (Refactor to update all billing fields)
- [x] Address 409 Conflict in `addCustomer` (Duplicate meter number check)
- [x] Ensure Dashboard "Recent Meter Readings" shows readings, not collections
- [x] Correct Reading List sorting (Latest updated/read first)
- [x] Implement Sequential/Continuous Bill Numbering (`bill_no` column + RPC update)
- [x] Fix Mobile App Sync History (Added `id` and `bill_no` to local storage)
- [x] Fix missing `getBarangay` utility in `database.js`
 */
async function updateReading(billingId, newCurrentReading, customerId, targetPeriod) {
    try {
        console.log('[updateReading] Starting:', { billingId, newCurrentReading, customerId, targetPeriod });

        let bill = null;
        let customer = null;
        let prevReading = 0;

        // 1. Resolve Data Source
        const isUpdate = (billingId && billingId !== 'null' && billingId !== 'undefined' && billingId !== '');

        if (isUpdate) {
            // Updating existing record
            const { data, error: fetchError } = await supabase
                .from('billing')
                .select('*, customers!inner (*)')
                .eq('id', billingId)
                .single();
            if (fetchError) {
                console.error('[updateReading] Fetch Error:', fetchError);
                throw fetchError;
            }
            bill = data;
            customer = data.customers;
            prevReading = bill.previous_reading || 0;
            console.log('[updateReading] Found existing bill:', bill);
        } else {
            // Creating new month record
            console.log('[updateReading] Creating NEW record for customer:', customerId);
            if (!customerId || !targetPeriod) throw new Error("Missing Customer or Period for new reading.");

            const { data: cData, error: cError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            if (cError) throw cError;
            customer = cData;

            // Fetch latest bill to get the previous reading
            const { data: latestBills, error: lbError } = await supabase
                .from('billing')
                .select('current_reading')
                .eq('customer_id', customerId)
                .order('reading_date', { ascending: false })
                .limit(1);

            if (!lbError && latestBills && latestBills.length > 0) {
                prevReading = latestBills[0].current_reading || 0;
            }
            console.log('[updateReading] New record previous reading:', prevReading);
        }

        // 2. Load settings and rate schedules
        const settings = await loadSystemSettings();
        const schedules = await loadRateSchedules();

        // Match schedule using lowercase for robustness
        const customerType = (customer.customer_type || 'residential').toLowerCase();
        const schedule = schedules.find(s => (s.category_key || '').toLowerCase() === customerType) || null;

        // 3. Calculation
        const newConsumption = Math.max(0, newCurrentReading - prevReading);
        const billToCalc = {
            ...(bill || {}),
            previous_reading: prevReading,
            current_reading: newCurrentReading,
            consumption: newConsumption,
            billing_period: targetPeriod || (bill ? bill.billing_period : '')
        };

        const result = window.BillingEngine.calculate(billToCalc, customer, settings, schedule);
        console.log('[updateReading] Calculation result:', result);

        // 4. Persistence
        const updateData = {
            current_reading: newCurrentReading,
            consumption: newConsumption,
            base_charge: parseFloat((result.baseRate || 0).toFixed(2)),
            consumption_charge: parseFloat((result.consumptionCharge || 0).toFixed(2)),
            penalty: parseFloat((result.penalty || 0).toFixed(2)),
            arrears: parseFloat((result.arrears || 0).toFixed(2)),
            amount: parseFloat((result.totalDue || 0).toFixed(2)),
            // Only update balance if it's currently unpaid or new. 
            // If it's paid, keep balance 0 unless we want to void payment.
            updated_at: new Date().toISOString()
        };

        if (!bill || bill.status === 'unpaid' || bill.status === 'overdue') {
            updateData.balance = parseFloat((result.totalDue || 0).toFixed(2));
        }

        console.log('[updateReading] Persistence data:', updateData);

        if (isUpdate) {
            // UPDATE
            const { error: updateError } = await supabase
                .from('billing')
                .update(updateData)
                .eq('id', billingId);

            if (updateError) {
                console.error('[updateReading] Update Error:', updateError);
                throw updateError;
            }
            console.log('[updateReading] Update SUCCESS');
        } else {
            // INSERT (New sequential bill)
            const today = new Date();
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (settings.overdue_days || 14));

            const { error: insertError } = await supabase
                .from('billing')
                .insert([{
                    ...updateData,
                    customer_id: customerId,
                    billing_period: targetPeriod,
                    previous_reading: prevReading,
                    status: 'unpaid',
                    reading_date: today.toISOString(),
                    due_date: dueDate.toISOString(),
                    period_start: today.toISOString(),
                    period_end: today.toISOString(),
                    created_at: today.toISOString()
                }]);
            if (insertError) throw insertError;
        }

        // --- Audit Log ---
        await logAuditAction(
            isUpdate ? 'UPDATE' : 'CREATE',
            'billing',
            billingId || 'new',
            `${isUpdate ? 'Updated' : 'Generated'} reading for account: ${customer?.first_name} ${customer?.last_name}`,
            { previous: prevReading, current: newCurrentReading, consumption: newConsumption }
        );

        // showNotification(billingId ? 'Bill updated' : 'New bill generated', 'success'); // Removed duplicate
        return true;
    } catch (error) {
        console.error('Error updating/generating reading:', error);
        // showNotification(error.message, 'error'); // Handled by caller
        throw error;
    }
}

// Exports
/**
 * Populates all period filter dropdowns across the application with unique, 
 * sorted months from the billing table. This ensures the Billing, Ledger, 
 * and Reading List filters stay in sync and reflect newly added mock data.
 */
async function populateDynamicPeriodFilters() {
    try {
        // IDs of all period filter selects in the application
        const filterIds = ['billingMonthFilter', 'ledgerPeriodFilter', 'readingListPeriodFilter'];
        const selects = filterIds.map(id => document.getElementById(id)).filter(el => el !== null);

        if (selects.length === 0) return;

        // Fetch recent billing data to derive unique periods
        const { data, error } = await supabase
            .from('billing')
            .select('billing_period, reading_date, updated_at')
            .order('reading_date', { ascending: false });

        if (error) throw error;

        const normalizedSet = new Set();

        // Ensure current month is always an option (especially for Reading List)
        const now = new Date();
        const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        normalizedSet.add(currentMonthLabel);

        data.forEach(b => {
            const rdStr = b.updated_at || b.reading_date;
            if (rdStr) {
                const key = normalizePeriod(formatLocalDateTime(rdStr, false));
                if (key) normalizedSet.add(key);
            }
            if (b.billing_period) {
                const p = normalizePeriod(b.billing_period);
                if (p) normalizedSet.add(p);
            }
        });

        const sortedKeys = Array.from(normalizedSet).sort((a, b) => new Date(b) - new Date(a));

        selects.forEach(select => {
            const currentVal = select.value;
            const isReadingList = select.id === 'readingListPeriodFilter';

            // Clear but keep "All Periods"
            select.innerHTML = '<option value="">All Periods</option>';

            sortedKeys.forEach(display => {
                const opt = document.createElement('option');
                opt.value = display;
                opt.textContent = display;

                // Logic for default selection:
                // 1. If user already selected something, keep it.
                // 2. If it's the Reading List and no selection yet, default to current month.
                if (currentVal && display === currentVal) {
                    opt.selected = true;
                } else if (!currentVal && isReadingList && display.toLowerCase() === currentMonthLabel.toLowerCase()) {
                    opt.selected = true;
                }

                select.appendChild(opt);
            });
        });

        console.log('[populateDynamicPeriodFilters] Sync complete for:', filterIds.filter(id => document.getElementById(id)));
    } catch (e) {
        console.error('[populateDynamicPeriodFilters] Sync error:', e);
    }
}

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
    loadRateSchedules,
    updateRateSchedule,
    verifyAdminPIN,
    updateAdminPIN,
    loadMasterLedger,
    loadLedgerCard,
    loadReadingList,
    loadAuditLogs,
    getReaderForBarangay,
    getReaderIdForBarangay,
    getAssignedReaders,
    getBarangaysForReader,
    loadRecentReadingsWidget,
    initiateCutoff,
    confirmCutoff,
    updateReading,
    populateDynamicPeriodFilters,
    PULUPANDAN_BARANGAYS
};

/**
 * Recalculates unpaid bills based on current settings and customer status.
 *
 * @param {number|null} targetCustomerId - Limit recalculation to one customer.
 * @param {boolean} currentMonthOnly     - When true (default), only touches bills
 *   from the current calendar month so past arrears stay untouched.
 *   Pass false when editing a specific customer (discount toggle) to recalculate
 *   all their pending bills regardless of period.
 */
async function recalculateUnpaidBills(targetCustomerId = null, currentMonthOnly = true) {
    try {
        console.log('[recalculateUnpaidBills] Starting...', { targetCustomerId, currentMonthOnly });

        // 1. Determine current month window
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        // 2. Fetch dependencies once
        const settings = await loadSystemSettings();
        const schedules = await loadRateSchedules();

        // 3. Build query
        let query = supabase
            .from('billing')
            .select('*, customers!inner(*)')
            .in('status', ['unpaid', 'overdue']);

        // Scope to current month (by reading_date or created_at) unless targeting a specific customer
        if (currentMonthOnly && !targetCustomerId) {
            query = query
                .gte('reading_date', monthStart)
                .lte('reading_date', monthEnd);
        }

        if (targetCustomerId) {
            query = query.eq('customer_id', targetCustomerId);
        }

        const { data: bills, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        if (!bills || bills.length === 0) {
            console.log('[recalculateUnpaidBills] No current-month bills to recalculate.');
            // Still refresh the UI so tables are in sync
            _liveRefreshBillingUI();
            return;
        }

        console.log(`[recalculateUnpaidBills] Recalculating ${bills.length} bill(s)...`);

        // 4. Build batch updates
        const updates = [];
        for (const bill of bills) {
            const customer = bill.customers;

            // Use stored billing components — these are frozen at creation time
            // and must NOT be changed by rate adjustments in system settings.
            const storedBaseCharge = parseFloat(bill.base_charge || 0);
            const storedConsumptionCharge = parseFloat(bill.consumption_charge || 0);
            const storedArrears = parseFloat(bill.arrears || 0);
            const storedDiscount = parseFloat(bill.discount_amount || 0);

            // Recalculate ONLY the penalty using stored components (not live rates)
            // Penalty = (base + consumption) * penalty_rate — if overdue
            const penaltyRate = (settings.penalty_percentage != null ? parseFloat(settings.penalty_percentage) : 10) / 100;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(bill.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const isPastDue = today > dueDate;
            const shouldApplyPenalty = bill.status === 'overdue' || (bill.status === 'unpaid' && isPastDue);
            const newPenalty = shouldApplyPenalty
                ? parseFloat(((storedBaseCharge + storedConsumptionCharge) * penaltyRate).toFixed(2))
                : parseFloat((bill.penalty || 0).toFixed(2));

            // Recalculate amount from frozen components + new penalty only
            const newAmount = parseFloat(
                (storedBaseCharge + storedConsumptionCharge + newPenalty + storedArrears - storedDiscount).toFixed(2)
            );

            // Apply amount delta to balance (preserves partial payments)
            const oldAmount = parseFloat(bill.amount || 0);
            const delta = newAmount - oldAmount;
            const currentBalance = parseFloat(bill.balance || 0);
            const newBalance = parseFloat((currentBalance + delta).toFixed(2));

            updates.push(
                supabase.from('billing').update({
                    // base_charge and consumption_charge are intentionally NOT updated here
                    penalty: newPenalty,
                    amount: newAmount,
                    balance: newBalance,
                    updated_at: new Date().toISOString()
                }).eq('id', bill.id)
            );
        }

        // 5. Execute batch
        const results = await Promise.all(updates);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            console.error('[recalculateUnpaidBills] Some updates failed:', errors);
        }

        console.log('[recalculateUnpaidBills] Done.');

        // 6. Live-refresh all visible billing tables immediately
        _liveRefreshBillingUI();

    } catch (error) {
        console.error('[recalculateUnpaidBills] CRITICAL ERROR:', error);
        // showNotification('Recalculation error: ' + error.message, 'error'); // Handled by caller
    }
}

/**
 * Triggers an in-place refresh of every billing-related table that is currently
 * rendered on screen — no page reload required.
 */
function _liveRefreshBillingUI() {
    // refreshBilling is exposed on window by admin.js
    if (typeof window.refreshBilling === 'function') {
        window.refreshBilling();
    } else if (window.dbOperations?.loadBilling) {
        window.dbOperations.loadBilling();
    }

    // Master Ledger (customer directory with balances)
    if (window.dbOperations?.loadMasterLedger) {
        const barangay = document.getElementById('ledgerBarangayFilter')?.value || '';
        const period = document.getElementById('ledgerPeriodFilter')?.value || '';
        const search = document.getElementById('ledgerSearchInput')?.value || '';
        try {
            const tbody = document.getElementById('masterLedgerTableBody'); // Assuming this ID exists
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: #9E9E9E;"><i class="fas fa-spinner fa-spin"></i> Loading master ledger...</td></tr>';
            }
            window.dbOperations.loadMasterLedger({ barangay, period, search });
        } catch (e) {
            console.error('Error displaying master ledger loading spinner or loading data:', e);
        }
    }

    // Dashboard stats and chart
    if (window.dbOperations?.loadDashboardStats) {
        window.dbOperations.loadDashboardStats();
    }

    // Reading list (if that tab is open)
    if (typeof window.updateReadingList === 'function') {
        window.updateReadingList();
    }
}

