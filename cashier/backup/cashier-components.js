/**
 * Cashier UI Components & Modals
 * Strictly isolated from the Admin side.
 */

(function() {
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
                                    <label>Consumption (m³)</label>
                                    <input type="number" id="readingConsumption" class="form-control" readonly value="0">
                                </div>
                                <div class="form-group-elegant">
                                    <label>Date of Reading</label>
                                    <input type="date" id="readingDate" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
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
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

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
                submitBtn.disabled = false;
                submitBtn.textContent = 'Generate Bill';
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
                .select('id, last_name, first_name, has_discount')
                .eq('id', bill.customer_id)
                .single();

            if (customerError) throw customerError;
            
            // Compute account number
            const accountNumber = `ACC-${String(customer.id).padStart(3, '0')}`;

            const modalHTML = `
                <div class="modal-overlay" id="${modalId}">
                    <div class="modal">
                        <div class="modal-header">
                            <h2 class="modal-title">Process Payment</h2>
                            <button class="modal-close" onclick="closeModal('${modalId}')">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="payment-info-card">
                                <div class="info-row">
                                    <span>Customer:</span>
                                    <strong>${customer.last_name}, ${customer.first_name}</strong>
                                </div>
                                <div class="info-row">
                                    <span>Account No:</span>
                                    <strong>${accountNumber}</strong>
                                </div>
                                <div class="info-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee;">
                                    <span>Bill Amount:</span>
                                    <strong>₱${parseFloat(bill.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                </div>
                                <div class="info-row">
                                    <span>Current Balance:</span>
                                    <strong class="text-primary" style="font-size: 1.2rem;">₱${parseFloat(bill.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                </div>
                            </div>

                            <form id="paymentForm" class="elegant-form" style="margin-top: 1.5rem;">
                                <div class="form-group-elegant">
                                    <label>Payment Method</label>
                                    <select id="paymentMethod" class="form-control" required>
                                        <option value="cash">Cash</option>
                                        <option value="gcash">GCash</option>
                                        <option value="bank">Bank Transfer</option>
                                    </select>
                                </div>

                                <div class="form-group-elegant">
                                    <label>Amount Received</label>
                                    <input type="number" id="amountReceived" class="form-control" required step="0.01" value="${bill.balance}">
                                </div>

                                <div id="onlineRefGroup" class="form-group-elegant" style="display: none;">
                                    <label>Reference Number</label>
                                    <input type="text" id="onlineReference" class="form-control" placeholder="TXN-123456">
                                </div>

                                <div class="payment-summary" style="margin-top: 15px; background: #f9f9f9; padding: 10px; border-radius: 8px;">
                                    <div class="info-row">
                                        <span>Change:</span>
                                        <strong id="paymentChange" style="color: #2e7d32;">₱0.00</strong>
                                    </div>
                                </div>

                                <div class="modal-actions" style="margin-top: 1.5rem;">
                                    <button type="button" class="btn btn-outline" onclick="closeModal('${modalId}')">Cancel</button>
                                    <button type="submit" class="btn btn-primary" style="flex: 1;">Finalize Payment</button>
                                </div>
                            </form>
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
                const balance = parseFloat(bill.balance);
                const change = Math.max(0, received - balance);
                changeText.textContent = `₱${change.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            };

            amountInput.addEventListener('input', updateChange);
            updateChange();

            form.onsubmit = async (e) => {
                e.preventDefault();
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

                try {
                    const received = parseFloat(amountInput.value);
                    const method = methodSelect.value;
                    const reference = document.getElementById('onlineReference').value;

                    await window.cashierDb.recordPayment(billId, received, method, reference);
                    
                    showNotification('Payment recorded successfully!', 'success');
                    closeModal(modalId);
                    if (typeof loadInitialData === 'function') loadInitialData();
                } catch (error) {
                    console.error('Payment failed:', error);
                    showNotification('Payment failed', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Finalize Payment';
                }
            };

        } catch (error) {
            console.error('Error opening payment modal:', error);
            showNotification('Failed to load bill details', 'error');
        }
    }

    // Receipt/Bill Modal (Mirroring Admin Version)
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
            
            // Settings for logic
            const settings = await window.cashierDb.loadSystemSettings();

            // Calculations
            const consumption = parseFloat(bill.consumption) || 0;
            const baseRate = parseFloat(settings.base_rate) || 150;
            
            let consumptionCharge = 0;
            let breakdownHTML = '';
            const t1T = settings.tier1_threshold || 10;
            const t1R = settings.tier1_rate || 15;
            const t2T = settings.tier2_threshold || 20;
            const t2R = settings.tier2_rate || 20;
            const t3R = settings.tier3_rate || 25;

            if (consumption > 0) {
                const t1Usage = Math.min(consumption, t1T);
                const t1Cost = t1Usage * t1R;
                consumptionCharge += t1Cost;
                breakdownHTML += `<div class="breakdown-row"><span>First ${t1T} m³ (Tier 1)</span> <span>₱${t1Cost.toLocaleString()}</span></div>`;
                
                if (consumption > t1T) {
                    const t2Usage = Math.min(consumption - t1T, t2T - t1T);
                    const t2Cost = t2Usage * t2R;
                    consumptionCharge += t2Cost;
                    breakdownHTML += `<div class="breakdown-row"><span>Next ${t2T - t1T} m³ (Tier 2)</span> <span>₱${t2Cost.toLocaleString()}</span></div>`;
                    
                    if (consumption > t2T) {
                        const t3Usage = consumption - t2T;
                        const t3Cost = t3Usage * t3R;
                        consumptionCharge += t3Cost;
                        breakdownHTML += `<div class="breakdown-row"><span>Above ${t2T} m³ (Tier 3)</span> <span>₱${t3Cost.toLocaleString()}</span></div>`;
                    }
                }
            }

            const taxRate = 0.052; // Matching the receipt UI (5.2%)
            
            // Logical Penalty Check
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(bill.due_date);
            dueDate.setHours(0, 0, 0, 0);
            
            const isPastDue = today > dueDate;
            const shouldApplyPenalty = bill.status === 'overdue' || (bill.status === 'unpaid' && isPastDue);
            
            const penaltyRate = (parseFloat(settings.penalty_percentage) || 10) / 100;
            const tax = (baseRate + consumptionCharge) * taxRate;
            const penalty = shouldApplyPenalty ? (baseRate + consumptionCharge) * penaltyRate : 0;
            const arrears = parseFloat(bill.arrears) || 0;
            const discountPercent = settings.discount_percentage || 20;
            const discountAmount = customer.has_discount ? (baseRate + consumptionCharge) * (discountPercent / 100) : 0;
            const totalDue = baseRate + consumptionCharge + tax + penalty + arrears - discountAmount;

            const modalHTML = `
                <div class="modal-overlay" id="billModal">
                    <div class="modal receipt-modal">
                        <button class="modal-close" onclick="closeModal('billModal')" style="position: absolute; top: 1rem; right: 1rem; z-index: 20; background: rgba(255,255,255,0.8); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-times"></i>
                        </button>
                        
                        <div class="receipt-paper">
                            <div class="status-stamp ${bill.status === 'paid' ? 'paid' : 'unpaid'}">
                                ${bill.status}
                            </div>
    
                            <header class="receipt-header">
                                <div class="receipt-brand">
                                    <i class="fas fa-droplet"></i>
                                    <span>AquaFlow</span>
                                </div>
                                <div class="receipt-subtitle">Official Water Bill</div>
                            </header>
    
                            <div class="receipt-id-row">
                                <span>#BIL-${String(bill.id).padStart(4, '0')}</span>
                                <span>${new Date().toLocaleDateString()}</span>
                            </div>
    
                            <section class="receipt-section">
                                <h4 class="receipt-section-title">Customer Details</h4>
                                <div class="receipt-row">
                                    <span class="receipt-label">Name:</span>
                                    <span class="receipt-value">${customerName}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="receipt-label">Account No:</span>
                                    <span class="receipt-value mono">${window.getAccountID ? window.getAccountID(bill.customer_id) : bill.customer_id}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="receipt-label">Meter No:</span>
                                    <span class="receipt-value">${customer.meter_number || 'N/A'}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="receipt-label">Period:</span>
                                    <span class="receipt-value">${bill.billing_period || 'N/A'}</span>
                                </div>
                            </section>
    
                            <section class="receipt-section">
                                <h4 class="receipt-section-title">Consumption (m³)</h4>
                                <div class="receipt-reading-grid">
                                    <div class="reading-item">
                                        <label>Previous</label>
                                        <span>${bill.previous_reading}</span>
                                    </div>
                                    <div class="reading-item">
                                        <label>Current</label>
                                        <span>${bill.current_reading}</span>
                                    </div>
                                    <div class="reading-item">
                                        <label>Total</label>
                                        <span style="color: var(--primary)">${consumption}</span>
                                    </div>
                                </div>
                            </section>
    
                            <section class="receipt-section">
                                <h4 class="receipt-section-title">Charges Breakdown</h4>
                                <div class="receipt-row">
                                    <span class="receipt-label">Base Rate</span>
                                    <span class="receipt-value">₱${baseRate.toLocaleString()}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="receipt-label">Consumption Charge</span>
                                    <span class="receipt-value">₱${consumptionCharge.toLocaleString()}</span>
                                </div>
                                
                                <div class="receipt-row" style="padding-left: 1rem; opacity: 0.7; font-size: 0.8rem;">
                                    <span>Tiered Breakdown:</span>
                                </div>
                                <div style="padding-left: 1rem; border-left: 2px solid #eee; margin-left: 0.5rem; margin-bottom: 1rem;">
                                    ${breakdownHTML}
                                </div>
    
                                ${customer.has_discount ? `
                                <div class="receipt-row" style="color: var(--primary); font-weight: 700;">
                                    <span class="receipt-label">SC/PWD Discount (${discountPercent}%)</span>
                                    <span class="receipt-value">-₱${discountAmount.toLocaleString()}</span>
                                </div>
                                ` : ''}
    
                                <div class="receipt-row">
                                    <span class="receipt-label">Gov't Tax (5.2%)</span>
                                    <span class="receipt-value">₱${tax.toLocaleString()}</span>
                                </div>
                                <div class="receipt-row">
                                    <span class="receipt-label">Late Penalty</span>
                                    <span class="receipt-value" style="${penalty > 0 ? 'color: var(--danger); font-weight: bold;' : ''}">₱${penalty.toLocaleString()}</span>
                                </div>
                                <div class="receipt-row" title="Unpaid balance from previous months">
                                    <div class="receipt-label-column">
                                        <span class="receipt-label">Arrears</span>
                                        <small style="display: block; font-size: 0.7rem; color: #888; margin-top: -0.2rem;">(Previous Unpaid Balance)</small>
                                    </div>
                                    <span class="receipt-value">₱${arrears.toLocaleString()}</span>
                                </div>
                            </section>
    
                            <div class="receipt-total-section">
                                <div class="receipt-total-row">
                                    <span class="receipt-total-label">Total Amount Due</span>
                                    <span class="receipt-total-value">₱${totalDue.toLocaleString()}</span>
                                </div>
                                <div class="receipt-row" style="margin-top: 1rem; font-style: italic; color: #666;">
                                    <span>Due Date:</span>
                                    <span>${new Date(bill.due_date).toLocaleDateString()}</span>
                                </div>
                            </div>
    
                            <footer class="receipt-footer">
                                <p class="thanks-msg">Thank you for being a valued customer!</p>
                                <p class="receipt-timestamp">Generated on ${new Date().toLocaleString()}</p>
                            </footer>
                        </div>
    
                        <div class="button-row-receipt" style="display: flex; gap: 10px; padding: 1rem 2rem;">
                            <button type="button" class="btn btn-secondary flex-1" onclick="closeModal('billModal')">Close</button>
                            <button type="button" class="btn btn-primary flex-1" onclick="window.printBill(${bill.id})">
                                <i class="fas fa-print"></i> Print
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

    // Add Print Helper (Mirroring Admin behavior)
    window.printBill = function(billId) {
        window.print();
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
