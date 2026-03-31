/**
 * Cashier UI Components & Modals
 * Strictly isolated from the Admin side.
 */

(function () {
    // Add Reading Modal
    async function showAddReadingModal() {
        const modalId = 'addReadingModal';
        const container = document.getElementById('modalContainer');

        // Fetch customers for the selection
        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, first_name, last_name, meter_number')
            .eq('status', 'active')
            .order('last_name', { ascending: true });

        if (error) {
            showNotification('Failed to load customers', 'error');
            return;
        }

        const modalHTML = `
            <div class="modal-overlay" id="${modalId}">
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Record Water Reading</h2>
                        <button class="modal-close" onclick="closeModal('${modalId}')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="addReadingForm" class="elegant-form">
                            <div class="form-group-elegant">
                                <label>Select Customer</label>
                                <select id="readingCustomerId" class="form-control" required>
                                    <option value="">-- Choose Customer --</option>
                                    ${customers.map(c => {
            const accNum = `ACC-${String(c.id).padStart(3, '0')}`;
            return `<option value="${c.id}" data-meter="${c.meter_number}">${c.last_name}, ${c.first_name} (${accNum})</option>`;
        }).join('')}
                                </select>
                            </div>

                            <div class="form-row">
                                <div class="form-group-elegant">
                                    <label>Previous Reading</label>
                                    <input type="number" id="prevReading" class="form-control" readonly value="0">
                                </div>
                                <div class="form-group-elegant">
                                    <label>Current Reading</label>
                                    <input type="number" id="currReading" class="form-control" required min="0">
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group-elegant">
                                    <label>Consumption (cu.m.)</label>
                                    <input type="number" id="readingConsumption" class="form-control" readonly value="0">
                                </div>
                                <div class="form-group-elegant">
                                    <label>Date of Reading</label>
                                    <input type="date" id="readingDate" class="form-control" required value="${getLocalISODate()}">
                                </div>
                            </div>

                            <div class="reading-summary" id="readingSummary" style="display: none;">
                                <div class="summary-item">
                                    <span>Estimated Bill:</span>
                                    <strong id="estimatedBill">₱0.00</strong>
                                </div>
                            </div>

                            <div class="modal-actions" style="margin-top: 1.5rem;">
                                <button type="button" class="btn btn-outline" onclick="closeModal('${modalId}')">Cancel</button>
                                <button type="submit" class="btn btn-primary">Generate Bill</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', modalHTML);

        const form = document.getElementById('addReadingForm');
        const customerSelect = document.getElementById('readingCustomerId');
        const prevInput = document.getElementById('prevReading');
        const currInput = document.getElementById('currReading');
        const consInput = document.getElementById('readingConsumption');
        const summary = document.getElementById('readingSummary');
        const estBill = document.getElementById('estimatedBill');

        customerSelect.addEventListener('change', async () => {
            const customerId = customerSelect.value;
            if (!customerId) {
                prevInput.value = 0;
                return;
            }

            try {
                const { data: latestBill, error: billError } = await supabase
                    .from('billing')
                    .select('current_reading')
                    .eq('customer_id', customerId)
                    .order('period_end', { ascending: false })
                    .limit(1);

                if (billError) throw billError;

                prevInput.value = (latestBill && latestBill.length > 0) ? latestBill[0].current_reading : 0;
                updateConsumption();
            } catch (error) {
                console.error('Error fetching prev reading:', error);
                prevInput.value = 0;
            }
        });

        const updateConsumption = () => {
            const prev = parseFloat(prevInput.value) || 0;
            const curr = parseFloat(currInput.value) || 0;
            const cons = Math.max(0, curr - prev);
            consInput.value = cons;

            if (curr > 0) {
                summary.style.display = 'block';
                calculateEstimate(cons);
            } else {
                summary.style.display = 'none';
            }
        };

        currInput.addEventListener('input', updateConsumption);

        async function calculateEstimate(consumption) {
            const settings = await window.cashierDb.loadSystemSettings();

            let total = parseFloat(settings.base_rate) || 0;
            const t1T = settings.tier1_threshold || 10;
            const t1R = settings.tier1_rate || 0;
            const t2T = settings.tier2_threshold || 20;
            const t2R = settings.tier2_rate || 0;
            const t3R = settings.tier3_rate || 0;

            if (consumption > 0) {
                const t1 = Math.min(consumption, t1T);
                total += t1 * t1R;
                if (consumption > t1T) {
                    const t2 = Math.min(consumption - t1T, t2T - t1T);
                    total += t2 * t2R;
                    if (consumption > t2T) {
                        const t3 = consumption - t2T;
                        total += t3 * t3R;
                    }
                }
            }
            estBill.textContent = `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        }

        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }

            try {
                const customerId = customerSelect.value;
                const currentReading = parseFloat(currInput.value);
                const prevReading = parseFloat(prevInput.value);
                const readingDate = document.getElementById('readingDate').value;

                await window.cashierDb.generateBillFromReading(customerId, currentReading, prevReading, readingDate);

                showNotification('Bill generated successfully!', 'success');
                closeModal(modalId);
                if (typeof loadInitialData === 'function') loadInitialData();
            } catch (error) {
                console.error('Bill generation failed:', error);
                showNotification('Failed to generate bill', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        };
    }

    // Payment Modal
    async function showPaymentModal(billId) {
        const modalId = 'paymentModal';
        const container = document.getElementById('modalContainer');

        try {
            // 1. Fetch bill details
            const { data: bill, error: billError } = await supabase
                .from('billing')
                .select('*')
                .eq('id', billId)
                .single();

            if (billError) throw billError;

            // 2. Fetch customer details
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('id, last_name, first_name, has_discount, status, meter_number, customer_type')
                .eq('id', bill.customer_id)
                .single();

            if (customerError) throw customerError;

            // Compute account number
            const accountNumber = `ACC-${String(customer.id).padStart(3, '0')}`;

            // Fetch settings + rate schedules for live recalculation
            const [settings, rateSchedules] = await Promise.all([
                window.cashierDb.loadSystemSettings(),
                window.cashierDb.loadRateSchedules()
            ]);

            // Find matching rate schedule for this customer's type
            const schedule = rateSchedules ? rateSchedules.find(s => s.category_key === customer.customer_type) : null;

            // --- LIVE RECALCULATION using BillingEngine ---
            const calc = window.BillingEngine.calculate(bill, customer, settings, schedule);

            // Use live computed values for display
            const baseAmount = calc.baseRate;
            const consumptionCharge = calc.consumptionCharge;
            const livePenalty = calc.penalty;
            const discountAmount = calc.discountAmount;
            const discountPercent = calc.discountPercent;
            let totalDue = calc.totalDue;

            // --- SILENTLY SYNC CORRECT BALANCE BACK TO DB ---
            // This ensures the billing list always shows the live-calculated correct amount.
            const correctedBalance = parseFloat(calc.totalDue.toFixed(2));
            if (Math.abs(correctedBalance - parseFloat(bill.balance || 0)) > 0.01) {
                supabase.from('billing').update({
                    balance: correctedBalance,
                    amount: correctedBalance,
                    base_charge: parseFloat(calc.baseRate.toFixed(2)),
                    consumption_charge: parseFloat(calc.consumptionCharge.toFixed(2)),
                    penalty: parseFloat(calc.penalty.toFixed(2))
                }).eq('id', bill.id).then(({ error }) => {
                    if (error) console.warn('Could not sync bill balance to DB:', error.message);
                });
            }

            // Cutoff check
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(bill.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const cutoffGrace = settings ? (settings.cutoff_grace_period || settings.cutoff_days || 30) : 30;

            let isForCutoff = false;
            if (bill.due_date) {
                const diffTime = today - dueDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                isForCutoff = (bill.status === 'overdue' || bill.status === 'unpaid') && diffDays >= cutoffGrace;
            }

            // --- FETCH ARREARS (Previous Unpaid Bills excluding the current one) ---
            const { data: arrearsData, error: arrearsError } = await supabase
                .from('billing')
                .select('balance')
                .eq('customer_id', customer.id)
                .in('status', ['unpaid', 'overdue'])
                .neq('id', bill.id);

            let totalArrears = 0;
            if (!arrearsError && arrearsData && arrearsData.length > 0) {
                totalArrears = arrearsData.reduce((sum, item) => sum + (parseFloat(item.balance) || 0), 0);
            }

            // Add arrears to the total due (arrears only shown in modal, NOT stored in this bill's balance)
            totalDue += totalArrears;

            const modalHTML = `
                <style>
                    .super-modal-overlay {
                        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                        background: rgba(10, 15, 25, 0.85); backdrop-filter: blur(8px);
                        display: flex; justify-content: center; align-items: center; z-index: 9999;
                        animation: superFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    .super-modal-card {
                        background: linear-gradient(145deg, #1e293b, #0f172a);
                        width: 95%; max-width: 880px;
                        border-radius: 20px;
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05) inset;
                        overflow: hidden;
                        transform: scale(0.95) translateY(20px); opacity: 0;
                        animation: superSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
                        font-family: inherit; color: #f8fafc;
                        display: flex; flex-direction: column; max-height: 90vh;
                    }
                    @keyframes superFadeIn { to { opacity: 1; } }
                    @keyframes superSlideUp { to { transform: scale(1) translateY(0); opacity: 1; } }
                    
                    .super-header {
                        display: flex; align-items: center; justify-content: space-between;
                        padding: 1.25rem 1.75rem;
                        border-bottom: 1px solid rgba(255,255,255,0.06);
                        background: rgba(255,255,255,0.02);
                        flex-shrink: 0;
                    }
                    .super-header h2 {
                        margin: 0; font-size: 1.4rem; font-weight: 700;
                        background: linear-gradient(90deg, #38bdf8, #818cf8);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        display: flex; align-items: center; gap: 0.75rem;
                    }
                    .super-close {
                        background: rgba(255,255,255,0.05); border: none; color: #94a3b8;
                        width: 32px; height: 32px; border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        cursor: pointer; transition: all 0.2s;
                    }
                    .super-close:hover { background: rgba(239, 68, 68, 0.2); color: #f87171; transform: rotate(90deg); }
                    
                    .super-body-container { 
                        display: flex; flex-direction: column; overflow-y: auto; 
                    }
                    
                    .super-body { 
                        padding: 1.75rem; display: flex; gap: 2rem; align-items: stretch;
                        flex-wrap: wrap;
                    }
                    
                    @media (max-width: 768px) {
                        .super-body { flex-direction: column; }
                    }

                    .super-col-left { flex: 1.3; display: flex; flex-direction: column; gap: 1.25rem; min-width: 320px; }
                    .super-col-right { flex: 1; display: flex; flex-direction: column; gap: 1.25rem; min-width: 320px; }
                    
                    .super-info-grid {
                        display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
                        background: rgba(0,0,0,0.2); border-radius: 12px; padding: 1.25rem;
                        border: 1px solid rgba(255,255,255,0.04);
                    }
                    .super-lbl { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; margin-bottom: 0.3rem; }
                    .super-val { font-size: 1.05rem; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .super-subval { font-size: 0.8rem; color: #94a3b8; margin-top: 0.15rem; }
                    
                    .super-readings {
                        display: flex; justify-content: space-between; align-items: center;
                        padding: 1rem 1.25rem; background: rgba(56, 189, 248, 0.05);
                        border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.1);
                    }
                    .super-read-item { text-align: center; }
                    .super-read-val { font-size: 1.25rem; font-weight: 700; color: #f8fafc; margin-top: 0.25rem; }
                    .super-read-val.highlight { color: #38bdf8; }
                    
                    .super-breakdown { 
                        background: rgba(0,0,0,0.2); border-radius: 12px; padding: 1.25rem;
                        border: 1px solid rgba(255,255,255,0.04); flex-grow: 1;
                    }
                    .super-bd-row { display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.95rem; color: #cbd5e1; }
                    .super-bd-row:last-child { margin-bottom: 0; }
                    
                    .super-total-card {
                         background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); 
                         border-radius: 16px; padding: 1.5rem; text-align: center;
                    }
                    
                    .super-input-group { 
                        background: rgba(0,0,0,0.2); padding: 1.25rem; border-radius: 16px; 
                        border: 1px solid rgba(255,255,255,0.05); flex-grow: 1; display: flex; flex-direction: column; gap: 1.25rem;
                    }
                    .super-control {
                        width: 100%; height: 50px; background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
                        color: #f8fafc; font-size: 1rem; padding: 0 1rem; transition: all 0.2s;
                        box-sizing: border-box; font-family: inherit;
                    }
                    .super-control:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15); }
                    .super-control.amount-field { font-size: 1.4rem; font-weight: 700; color: #38bdf8; }
                    
                    .super-change-box {
                        display: flex; justify-content: space-between; align-items: center;
                        padding: 1rem 1.25rem; background: rgba(16, 185, 129, 0.1);
                        border-radius: 10px; border: 1px solid rgba(16, 185, 129, 0.2);
                        margin-top: auto;
                    }
                    .super-change-lbl { font-weight: 700; color: #10b981; letter-spacing: 1px; }
                    .super-change-val { font-weight: 800; font-size: 1.7rem; color: #34d399; }
                    
                    .super-actions {
                        display: flex; gap: 1rem; padding: 1.25rem 1.75rem; background: rgba(255,255,255,0.02);
                        border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
                    }
                    .super-btn {
                        flex: 1; height: 50px; border-radius: 12px; font-weight: 600; font-size: 1rem;
                        display: flex; align-items: center; justify-content: center; gap: 0.5rem;
                        cursor: pointer; transition: all 0.2s; border: none; font-family: inherit;
                    }
                    .super-btn-cancel { background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); flex: 0.5; }
                    .super-btn-cancel:hover { background: rgba(255,255,255,0.1); color: #fff; }
                    .super-btn-confirm { background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4); }
                    .super-btn-confirm:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(2, 132, 199, 0.6); }
                    
                    /* Hiding native number arrows */
                    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                    
                    .super-alert {
                        background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px;
                        padding: 1rem; display: flex; gap: 1rem; align-items: flex-start; width: 100%;
                        margin-bottom: 1rem;
                    }
                </style>

                <div class="super-modal-overlay" id="${modalId}">
                    <div class="super-modal-card">
                        
                        <div class="super-header">
                            <h2><i class="fas fa-wallet"></i> Process Payment</h2>
                            <button class="super-close" onclick="closeModal('${modalId}')"><i class="fas fa-times"></i></button>
                        </div>
                        
                        <div class="super-body-container">
                            <div class="super-body">
                                ${customer.status === 'inactive' ? `
                                <div class="super-alert">
                                    <i class="fas fa-exclamation-triangle fa-2x" style="color: #ef4444;"></i>
                                    <div>
                                        <div style="font-weight: 700; color: #fca5a5; margin-bottom: 2px;">ACCOUNT DEACTIVATED</div>
                                        <div style="font-size: 0.85rem; color: #fecaca; opacity: 0.9;">Full payment required for reconnection eligibility.</div>
                                        ${customer.disconnection_date ? `<div style="font-size: 0.8rem; margin-top: 6px; color: #ef4444;"><i class="fas fa-calendar-alt"></i> Disconnected: ${new Date(customer.disconnection_date).toLocaleDateString()}</div>` : ''}
                                    </div>
                                </div>
                                ` : ''}

                                <!-- LEFT COLUMN: Details & Breakdown -->
                                <div class="super-col-left">
                                    <div class="super-info-grid">
                                        <div>
                                            <div class="super-lbl">Billed To</div>
                                            <div class="super-val" title="${customer.last_name}, ${customer.first_name}">${customer.last_name}, ${customer.first_name}</div>
                                            <div class="super-subval">${accountNumber} &bull; ${(customer.customer_type || 'Residential')}</div>
                                        </div>
                                        <div>
                                            <div class="super-lbl">Billing Details</div>
                                            <div class="super-val">Period: <span style="color:#38bdf8;">${bill.billing_period || 'N/A'}</span></div>
                                            <div class="super-subval">Meter No: ${customer.meter_number || 'N/A'}</div>
                                        </div>
                                    </div>

                                    <div class="super-readings">
                                        <div class="super-read-item">
                                            <div class="super-lbl">Prev Read</div>
                                            <div class="super-read-val">${bill.previous_reading !== null ? bill.previous_reading : '---'}</div>
                                        </div>
                                        <div style="height: 30px; width: 1px; background: rgba(255,255,255,0.1);"></div>
                                        <div class="super-read-item">
                                            <div class="super-lbl">Pres Read</div>
                                            <div class="super-read-val">${bill.current_reading !== undefined && bill.current_reading !== null ? bill.current_reading : '---'}</div>
                                        </div>
                                        <div style="height: 30px; width: 1px; background: rgba(255,255,255,0.1);"></div>
                                        <div class="super-read-item">
                                            <div class="super-lbl">Consumed</div>
                                            <div class="super-read-val highlight">${bill.consumption !== null ? bill.consumption : '---'} <span style="font-size: 0.8rem; opacity: 0.7;">m³</span></div>
                                        </div>
                                    </div>

                                    <div class="super-breakdown">
                                        <div style="font-size: 0.9rem; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 1rem; letter-spacing: 0.5px;">Financial Breakdown</div>
                                        <div class="super-bd-row">
                                            <span>Base Charge</span>
                                            <span style="font-weight: 600; color: #f8fafc;">₱${baseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        ${consumptionCharge > 0 ? `
                                        <div class="super-bd-row">
                                            <span>Consumption Charge</span>
                                            <span style="font-weight: 600; color: #f8fafc;">+₱${consumptionCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        ` : ''}
                                        ${discountAmount > 0 ? `
                                        <div class="super-bd-row" style="color: #38bdf8;">
                                            <span>SC/PWD Discount (${discountPercent}%)</span>
                                            <span style="font-weight: 600;">-₱${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        ` : ''}
                                        ${isForCutoff ? `
                                        <div class="super-bd-row" style="color: #fca5a5; margin-top: 0.5rem;">
                                            <span style="background: rgba(239, 68, 68, 0.15); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2);"><i class="fas fa-exclamation-triangle"></i> Cutoff Notice</span>
                                        </div>
                                        ` : ''}
                                        ${livePenalty > 0 ? `
                                        <div class="super-bd-row" style="color: #fca5a5;">
                                            <span>Late Penalty (${settings.penalty_percentage || 10}%)</span>
                                            <span style="font-weight: 600;">+₱${livePenalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        ` : ''}
                                        ${totalArrears > 0 ? `
                                        <div class="super-bd-row" style="color: #fbbf24; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed rgba(251, 191, 36, 0.2);">
                                            <span>Previous Arrears</span>
                                            <span style="font-weight: 600;">+₱${totalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        ` : ''}
                                        <div class="super-bd-row" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                                            <span style="font-weight: 600; color: #94a3b8;">Total Computed</span>
                                            <span style="font-weight: 700; color: #f8fafc;">₱${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- RIGHT COLUMN: Total & Form -->
                                <div class="super-col-right">
                                    <div class="super-total-card">
                                        <div style="font-size: 0.85rem; color: #38bdf8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Total Amount Due</div>
                                        <div style="font-size: 2.75rem; font-weight: 800; color: #f8fafc; letter-spacing: -1px; line-height: 1; display: flex; justify-content: center; align-items: baseline; gap: 4px;">
                                            <span style="font-size: 1.5rem; color: #38bdf8; font-weight: 700;">₱</span>${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    <form id="paymentForm" style="display: flex; flex-direction: column; flex-grow: 1;">
                                        <div class="super-input-group">
                                            <div>
                                                <div class="super-lbl" style="margin-bottom: 0.5rem;">Payment Method</div>
                                                <select id="paymentMethod" class="super-control">
                                                    <option value="cash">Cash</option>
                                                </select>
                                            </div>
                                            
                                            <div>
                                                <div class="super-lbl" style="margin-bottom: 0.5rem;">Amount Received</div>
                                                <div style="position: relative;">
                                                    <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #64748b; font-weight: 700;">₱</span>
                                                    <input type="number" id="amountReceived" class="super-control amount-field" required step="0.01" value="${totalDue.toFixed(2)}" style="padding-left: 2.2rem;">
                                                </div>
                                            </div>

                                            <div id="onlineRefGroup" style="display: none;">
                                                <div class="super-lbl" style="margin-bottom: 0.5rem;">Reference Number</div>
                                                <input type="text" id="onlineReference" class="super-control" placeholder="e.g. TXN-123456">
                                            </div>

                                            <div class="super-change-box">
                                                <span class="super-change-lbl">CHANGE</span>
                                                <span id="paymentChange" class="super-change-val">₱0.00</span>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                        
                        <div class="super-actions">
                            <button type="button" class="super-btn super-btn-cancel" onclick="closeModal('${modalId}')">Cancel</button>
                            <button type="submit" id="finalizePaymentBtn" form="paymentForm" class="super-btn super-btn-confirm">
                                <i class="fas fa-check-circle"></i> Confirm Payment
                            </button>
                        </div>

                    </div>
                </div>
            `;

            container.insertAdjacentHTML('beforeend', modalHTML);

            const form = document.getElementById('paymentForm');
            const methodSelect = document.getElementById('paymentMethod');
            const amountInput = document.getElementById('amountReceived');
            const changeText = document.getElementById('paymentChange');
            const refGroup = document.getElementById('onlineRefGroup');

            methodSelect.addEventListener('change', () => {
                refGroup.style.display = (methodSelect.value === 'cash') ? 'none' : 'block';
            });

            const updateChange = () => {
                const received = parseFloat(amountInput.value) || 0;
                const balance = totalDue;
                const change = Math.max(0, received - balance);
                changeText.textContent = `₱${change.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            };

            amountInput.addEventListener('input', updateChange);
            updateChange();

            form.onsubmit = async (e) => {
                e.preventDefault();
                const submitBtn = document.getElementById('finalizePaymentBtn');
                const originalText = submitBtn ? submitBtn.innerHTML : '';

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                }

                try {
                    const received = parseFloat(amountInput.value);
                    const method = methodSelect.value;
                    const reference = document.getElementById('onlineReference').value;

                    const result = await window.cashierDb.recordPayment(billId, received, method, reference);

                    showNotification('Payment recorded successfully!', 'success');
                    closeModal(modalId);

                    // Check for reactivation if customer was inactive and balance is now 0
                    if (customer.status === 'inactive' && result.total_balance <= 0) {
                        const confirmReactivate = confirm(`Customer ${customer.last_name} has cleared their total balance. Reactivate account now?`);
                        if (confirmReactivate) {
                            try {
                                await window.cashierDb.reactivateCustomer(customer.id);
                                showNotification('Customer reactivated successfully!', 'success');
                                
                                // Notify Admin
                                if (typeof supabase !== 'undefined') {
                                    await supabase.from('notifications').insert([{
                                        customer_id: customer.id,
                                        message: `Customer ${customer.last_name}, ${customer.first_name} paid in full and was REACTIVATED.`,
                                        type: 'activation',
                                        is_read: false
                                    }]);
                                }
                            } catch (reactError) {
                                console.error('Delayed reactivation failed:', reactError);
                                showNotification('Reactivation failed, but payment was recorded.', 'error');
                            }
                        } else {
                            // Notify Admin that they paid but remain inactive
                            if (typeof supabase !== 'undefined') {
                                await supabase.from('notifications').insert([{
                                    customer_id: customer.id,
                                    message: `Customer ${customer.last_name}, ${customer.first_name} paid in full but remains INACTIVE.`,
                                    type: 'payment',
                                    is_read: false
                                }]);
                            }
                        }
                    }

                    if (typeof loadInitialData === 'function') loadInitialData();

                    // Auto-Show Receipt for Printing
                    setTimeout(() => {
                        window.showBillModal(billId);
                    }, 300); // Slight delay for smoother transition

                } catch (error) {
                    console.error('Payment failed:', error);
                    showNotification('Payment failed', 'error');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }
                }
            };

        } catch (error) {
            console.error('Error opening payment modal:', error);
            showNotification('Failed to load bill details', 'error');
        }
    }

    // Receipt/Bill Modal (Refactored to use BillingEngine)
    async function showBillModal(billId) {
        try {
            const { data: bill, error: billError } = await supabase
                .from('billing')
                .select('*')
                .eq('id', billId)
                .single();

            if (billError) throw billError;

            // Fetch customer details
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', bill.customer_id)
                .single();

            if (customerError) throw customerError;

            const middleInitial = customer.middle_initial ? ` ${customer.middle_initial}.` : '';
            const customerName = `${customer.last_name}, ${customer.first_name}${middleInitial}`;

            // Settings and Schedules for logic
            const [settings, schedules] = await Promise.all([
                window.cashierDb.loadSystemSettings(),
                window.cashierDb.loadRateSchedules()
            ]);

            const schedule = schedules.find(s => s.category_key === customer.customer_type);

            const data = window.BillingEngine.calculate(bill, customer, settings, schedule);
            const invoiceHTML = window.BillingEngine.generateInvoiceHTML(bill, customer, data, { customerName });

            const modalHTML = `
                <div class="modal-overlay" id="billModal">
                    <div class="modal service-invoice-modal">
                        <button class="modal-close no-print" onclick="closeModal('billModal')" style="position: absolute; top: 1rem; right: 1rem; z-index: 20; background: rgba(255,255,255,0.8); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd;">
                            <i class="fas fa-times"></i>
                        </button>
                        
                        ${invoiceHTML}
    
                        <div class="button-row-receipt no-print" style="display: flex; gap: 10px; padding: 1rem 2rem; background: #f8f9fa; border-top: 1px solid #ddd;">
                            <button type="button" class="btn btn-secondary flex-1" onclick="closeModal('billModal')">Close</button>
                            <button type="button" class="btn btn-primary flex-1" onclick="window.printBill(${bill.id})">
                                <i class="fas fa-print"></i> Print Invoice
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('modalContainer').innerHTML = modalHTML;
        } catch (error) {
            console.error('Error opening receipt:', error);
            showNotification('Failed to load bill details', 'error');
        }
    }

    // Add Print Helper
    window.printBill = function (billId) {
        document.body.classList.add('printing-invoice');
        window.print();
        document.body.classList.remove('printing-invoice');
    };

    // Export to window
    window.cashierComponents = {
        showAddReadingModal,
        showPaymentModal,
        showBillModal
    };

    // Override global
    window.showBillModal = showBillModal;
})();
