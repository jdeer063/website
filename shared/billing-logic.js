/**
 * Unified Billing Logic for PWD Management System
 * Handles all financial calculations and receipt template generation.
 */

(function () {
    const BillingEngine = {
        /**
         * Securely escapes HTML special characters to prevent XSS.
         * Delegates to the global window.escapeHTML from shared/utils.js.
         */
        escapeHTML(str) {
            return window.escapeHTML ? window.escapeHTML(str) : String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
        },

        /**
         * Calculate detailed billing components based on system settings
         * @param {Object} bill - The bill record from DB
         * @param {Object} customer - The customer record from DB
         * @param {Object} settings - System settings from DB
         */
        calculate(bill, customer, settings, schedule = null) {
            const consumption = parseFloat(bill.consumption) || 0;
            const arrears = parseFloat(bill.arrears) || 0;
            
            // 1. Determine Base Rate (Minimum Charge) based on Meter Size
            // Mapping from meter size display to schedule property
            const meterMapping = {
                '1/2"': 'min_charge_1_2',
                '3/4"': 'min_charge_3_4',
                '1"': 'min_charge_1',
                '1 1/2"': 'min_charge_1_1_2',
                '2"': 'min_charge_2',
                '3"': 'min_charge_3',
                '4"': 'min_charge_4'
            };
            
            const meterField = meterMapping[customer.meter_size] || 'min_charge_1_2';
            const baseRate = schedule ? (parseFloat(schedule[meterField]) || 0) : (parseFloat(settings.base_rate) || 260);
            
            // 2. Determine Classification Factor
            const factor = schedule ? (parseFloat(schedule.factor) || 1.0) : 1.0;

            // 3. Tier Calculation (Apply Factor to Base Tier Rates)
            let consumptionCharge = 0;
            
            // Tiers thresholds are fixed per PWD schedule: 11-20, 21-30, 31-40, 41-up
            const tierBaseRates = schedule ? [
                { threshold: 20, rate: parseFloat(schedule.tier1_rate) || 27.25, label: '11-20 m³' },
                { threshold: 30, rate: parseFloat(schedule.tier2_rate) || 28.75, label: '21-30 m³' },
                { threshold: 40, rate: parseFloat(schedule.tier3_rate) || 30.75, label: '31-40 m³' },
                { threshold: Infinity, rate: parseFloat(schedule.tier4_rate) || 33.25, label: '41-UP m³' }
            ] : [
                { threshold: settings.tier1_threshold || 10, rate: settings.tier1_rate || 27.25, label: 'Tier 1' },
                { threshold: settings.tier2_threshold || 20, rate: settings.tier2_rate || 28.75, label: 'Tier 2' },
                { threshold: Infinity, rate: settings.tier3_rate || 30.75, label: 'Tier 3' }
            ];

            const breakdown = [];
            // Minimum covers first 10 m³
            let remaining = consumption > 10 ? consumption - 10 : 0;
            let lastThreshold = 10;

            for (let i = 0; i < tierBaseRates.length; i++) {
                if (remaining <= 0) break;
                const tier = tierBaseRates[i];
                const availableInTier = tier.threshold - lastThreshold;
                const usageInTier = Math.min(remaining, availableInTier);
                
                // Final Rate = Base Tier Rate * Category Factor
                const finalRate = tier.rate * factor;
                const costInTier = usageInTier * finalRate;

                consumptionCharge += costInTier;
                breakdown.push({
                    label: tier.label,
                    usage: usageInTier,
                    rate: finalRate,
                    cost: costInTier,
                    baseRate: tier.rate,
                    factor: factor
                });

                remaining -= usageInTier;
                lastThreshold = tier.threshold;
            }

            // 4. Penalty Calculation
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(bill.due_date);
            dueDate.setHours(0, 0, 0, 0);

            const isPastDue = today > dueDate;
            const shouldApplyPenalty = bill.status === 'overdue' || (bill.status === 'unpaid' && isPastDue);
            const penaltyRate = (settings.penalty_percentage != null ? parseFloat(settings.penalty_percentage) : 10) / 100;
            // NEW PLAN: Penalty only on CURRENT charges (Base + Consumption), ignoring Arrears
            const penalty = shouldApplyPenalty ? (baseRate + consumptionCharge) * penaltyRate : 0;

            // 5. Discount Calculation (Senior/PWD)
            const discountPercent = settings.discount_percentage != null ? parseFloat(settings.discount_percentage) : 5;
            const discountAmount = customer.has_discount ? (baseRate + consumptionCharge) * (discountPercent / 100) : 0;

            // 6. Consumption Limit Validation (15-20 m³)
            const isAbnormalConsumption = consumption > 20;

            // 7. Totals
            const totalDue = baseRate + consumptionCharge + penalty + arrears - discountAmount;

            // 8. Cut-off Logic (Standardized: 14 days overdue + 3 days grace = 17 days total)
            const cutoffGrace = settings.cutoff_grace_period != null ? parseInt(settings.cutoff_grace_period) : 
                               (settings.cutoff_days ? (parseInt(settings.cutoff_days) - (parseInt(settings.overdue_days) || 14)) : 3);
            
            const cutoffDate = new Date(dueDate);
            cutoffDate.setDate(cutoffDate.getDate() + cutoffGrace);
            const isCutoff = today > cutoffDate;

            return {
                consumption,
                baseRate,
                consumptionCharge,
                penalty,
                arrears,
                discountAmount,
                discountPercent,
                totalDue,
                isPastDue,
                isCutoff,
                isAbnormalConsumption,
                breakdown,
                factor
            };
        },

        /**
         * Convert a number to English words (PH Peso format)
         * @param {number} amount - The amount to convert
         */
        numberToWords(amount) {
            if (amount === 0) return "Zero Pesos";
            
            const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
            const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
            
            const convertHundreds = (num) => {
                let str = "";
                if (num > 99) {
                    str += ones[Math.floor(num / 100)] + " Hundred ";
                    num %= 100;
                }
                if (num > 19) {
                    str += tens[Math.floor(num / 10)] + " ";
                    num %= 10;
                    if (num > 0) {
                        str += ones[num] + " ";
                    }
                } else if (num > 0) {
                    str += ones[num] + " ";
                }
                return str;
            };

            let n = Math.floor(amount);
            let cents = Math.round((amount - n) * 100);
            let result = "";

            if (n >= 1000000) {
                result += convertHundreds(Math.floor(n / 1000000)) + "Million ";
                n %= 1000000;
            }
            if (n >= 1000) {
                result += convertHundreds(Math.floor(n / 1000)) + "Thousand ";
                n %= 1000;
            }
            result += convertHundreds(n);

            if (result.trim() === "") {
                result = "Zero";
            }

            result = result.trim() + " Pesos";
            
            if (cents > 0) {
                result += " and " + convertHundreds(cents).trim() + " Cents";
            }

            return result;
        },

        /**
         * Generate Service Invoice HTML (Used by Cashier)
         */
        generateInvoiceHTML(bill, customer, data, options = {}) {
            const middleInitial = customer.middle_initial ? ` ${this.escapeHTML(customer.middle_initial)}.` : '';
            const customerName = options.customerName ? this.escapeHTML(options.customerName) : `${this.escapeHTML(customer.last_name)}, ${this.escapeHTML(customer.first_name)}${middleInitial}`;
            const address = this.escapeHTML(customer.address || '');
            const accountId = window.getAccountID ? window.getAccountID(customer.id) : customer.id;
            const businessStyle = this.escapeHTML(accountId);
            
            // MM/DD/YYYY Format for receipts as requested
            let readingDateStr = '';
            if (bill.reading_date) {
                readingDateStr = new Date(bill.reading_date).toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric'
                });
            } else {
                // Fallback to current date if reading_date is somehow missing
                readingDateStr = new Date().toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric'
                });
            }

            let paymentDateStr = '';
            if (bill.status === 'paid' && bill.payment_date) {
                paymentDateStr = new Date(bill.payment_date).toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric'
                });
            }

            const timestamp = options.premiumTimestamp ? 
                (window.pwdUtils?.formatLocalDateTime ? window.pwdUtils.formatLocalDateTime(new Date(), true, true) : new Date().toLocaleString()) : 
                null;

            return `
                <div class="service-invoice-paper">
                    <div class="invoice-header">
                        <div class="invoice-logo">
                            <img src="../assets/logo.png" alt="Logo">
                        </div>
                        <div class="invoice-district-info">
                            <h1>PULUPANDAN WATER DISTRICT</h1>
                            <p>Pulupandan, Negros Occidental</p>
                            <p>NON-VAT REG. TIN 006-849-454-000</p>
                        </div>
                    </div>

                    <div class="invoice-title-row">
                        <h2 class="invoice-main-title">SERVICE INVOICE</h2>
                        <div class="invoice-date-box">
                            <span>Date</span>
                            <span class="ink-line" style="min-width: 150px; text-align: center;">${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                        </div>
                    </div>

                    <div class="invoice-customer-info">
                        <div class="info-field">
                            <label>RECEIVED from</label>
                            <span class="ink-line" style="flex: 1;">${customerName}</span>
                            <label>TIN</label>
                            <span class="ink-line" style="width: 150px;"></span>
                        </div>
                        <div class="info-field">
                            <label>Address</label>
                            <span class="ink-line" style="flex: 1;">${address}</span>
                        </div>
                        <div class="info-field">
                            <label>Bus No.</label>
                            <span class="ink-line" style="flex: 1;">${businessStyle}</span>
                        </div>
                        <div class="info-field">
                            <label>the sum of</label>
                            <span class="ink-line" style="flex: 1; font-size: 0.9rem; font-weight: 600;">${this.numberToWords(data.totalDue)}</span>
                            <label>(P</label>
                            <span class="ink-line" style="width: 150px; text-align: center;">${data.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <label>)</label>
                        </div>
                    </div>

                    <div class="invoice-payment-details">
                        <div class="payment-grid">
                            <div class="payment-col">
                                <div class="payment-row-item">
                                    <label>in payment for: Current</label>
                                    <span class="ink-line" style="width: 100px;">${(data.baseRate + data.consumptionCharge).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div class="payment-row-item">
                                    <label>CY Arrears</label>
                                    <span class="ink-line" style="width: 100px;"></span>
                                </div>
                                <div class="payment-row-item">
                                    <label>PY Arrears</label>
                                    <span class="ink-line" style="width: 100px;">${data.arrears > 0 ? data.arrears.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</span>
                                </div>
                                <div class="payment-row-item">
                                    <label>Penalty</label>
                                    <span class="ink-line" style="width: 100px;">${data.penalty > 0 ? data.penalty.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</span>
                                </div>
                            </div>
                            <div class="payment-col">
                                <div class="payment-row-item"><label>Installation fees</label><span class="ink-line" style="width: 100px;"></span></div>
                                <div class="payment-row-item"><label>Notary/Inspection</label><span class="ink-line" style="width: 100px;"></span></div>
                                <div class="payment-row-item"><label>Materials</label><span class="ink-line" style="width: 100px;"></span></div>
                                <div class="payment-row-item">
                                    <label>Others</label>
                                    <span class="ink-line" style="width: 100px; text-align: center; color: var(--primary); font-weight: 600;">${customer.has_discount ? `- ${data.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (SC)` : ''}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="invoice-footer-section">
                        <div class="footer-left">
                            <div class="payment-method-boxes">
                                <label>PAYMENT IN FORM OF: [ ${bill.status === 'paid' ? 'x' : ' '} ] CASH</label>
                                <label>[   ] CHECK NO.</label>
                            </div>
                            <div class="bank-info-line">
                                <label>BANK</label><span class="ink-line" style="width: 120px;"></span>
                                <label>DATE</label><span class="ink-line" style="width: 120px; text-align: center;">${paymentDateStr}</span>
                            </div>
                        </div>
                        <div class="footer-right">
                            <div class="signature-box">
                                <span class="ink-line" style="width: 200px; text-align: center; text-transform: uppercase; font-weight: 700;">${options.cashierName || ''}</span>
                                <label>Cashier / Collector</label>
                            </div>
                            <div class="serial-number">
                                № <span class="serial-red">${String(bill.bill_no || bill.id).padStart(6, '0')}</span>
                            </div>
                        </div>
                    </div>

                    <div class="invoice-legal-disclaimer">
                        <p>"THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX"</p>
                        <p>THIS SERVICE INVOICE SHALL BE VALID FOR FIVE (5) YEARS FROM THE DATE OF ATP</p>
                    </div>
                </div>
            `;
        },

        /**
         * Generate Receipt Paper HTML (Used by Admin)
         */
        generateReceiptHTML(bill, customer, data, options = {}) {
            const middleInitial = customer.middle_initial ? ` ${this.escapeHTML(customer.middle_initial)}.` : '';
            const customerName = options.customerName ? this.escapeHTML(options.customerName) : `${this.escapeHTML(customer.last_name)}, ${this.escapeHTML(customer.first_name)}${middleInitial}`;
            const accountNo = this.escapeHTML(window.getAccountID ? window.getAccountID(bill.customer_id) : bill.customer_id);
            const meterNo = this.escapeHTML(customer.meter_number || 'N/A');
            
            const formatDateShort = (d) => {
                if(!d) return 'N/A';
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            };
            const periodStr = formatDateShort(bill.reading_date);

            const breakdownHTML = data.breakdown.map(b => `
                <div class="breakdown-row"><span>${b.label}</span> <span>₱${b.cost.toLocaleString()}</span></div>
            `).join('');

            return `
                <div class="receipt-paper">
                    <div class="status-stamp ${bill.status === 'paid' ? 'paid' : (data.isCutoff ? 'cutoff' : 'unpaid')}">
                        ${data.isCutoff && bill.status !== 'paid' ? 'CUT-OFF' : bill.status}
                    </div>

                    ${data.isCutoff && bill.status !== 'paid' ? `
                        <div class="cutoff-notice">
                            <i class="fas fa-exclamation-triangle"></i> DISCONNECTION NOTICE: This account is past the grace period.
                        </div>
                    ` : ''}

                    <header class="receipt-header">
                        <div class="receipt-brand">
                            <img src="../assets/logo.png" alt="Logo" style="height: 40px; margin-right: 10px;">
                            <span>Pulupandan Water District</span>
                        </div>
                        <div class="receipt-subtitle">Official Water Bill</div>
                    </header>

                    <div class="receipt-id-row">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span>${String(bill.bill_no || bill.id).padStart(6, '0')}</span>
                        </div>
                        <span>${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                    </div>

                    <section class="receipt-section">
                        <h4 class="receipt-section-title">Customer Details</h4>
                        <div class="receipt-row"><span class="receipt-label">Name:</span><span class="receipt-value">${customerName}</span></div>
                        <div class="receipt-row"><span class="receipt-label">Account No:</span><span class="receipt-value mono">${accountNo}</span></div>
                        <div class="receipt-row"><span class="receipt-label">Meter No:</span><span class="receipt-value">${meterNo}</span></div>
                    </section>

                    <section class="receipt-section">
                        <h4 class="receipt-section-title">Consumption (cu.m.)</h4>
                        <div class="receipt-reading-grid">
                            <div class="reading-item"><label>Previous</label><span>${bill.previous_reading}</span></div>
                            <div class="reading-item"><label>Current</label><span>${bill.current_reading}</span></div>
                            <div class="reading-item"><label>Total</label><span style="color: var(--primary)">${data.consumption}</span></div>
                        </div>
                    </section>

                    <section class="receipt-section">
                        <h4 class="receipt-section-title">Charges Breakdown</h4>
                        <div class="receipt-row"><span class="receipt-label">Base Rate</span><span class="receipt-value">₱${data.baseRate.toLocaleString()}</span></div>
                        <div class="receipt-row"><span class="receipt-label">Consumption Charge</span><span class="receipt-value">₱${data.consumptionCharge.toLocaleString()}</span></div>
                        <div class="receipt-row" style="padding-left: 1rem; opacity: 0.7; font-size: 0.8rem;"><span>Tiered Breakdown (cu.m.):</span></div>
                        <div style="padding-left: 1rem; border-left: 2px solid #eee; margin-left: 0.5rem; margin-bottom: 1rem;">${breakdownHTML}</div>

                        ${customer.has_discount ? `
                        <div class="receipt-row" style="color: var(--primary); font-weight: 700;">
                            <span class="receipt-label">Senior Citizen Discount (${data.discountPercent}%)</span>
                            <span class="receipt-value">-₱${data.discountAmount.toLocaleString()}</span>
                        </div>
                        ` : ''}

                        <div class="receipt-row">
                            <span class="receipt-label">Late Penalty</span>
                            <span class="receipt-value" style="${data.penalty > 0 ? 'color: var(--danger); font-weight: bold;' : ''}">₱${data.penalty.toLocaleString()}</span>
                        </div>
                        <div class="receipt-row">
                            <div class="receipt-label-column">
                                <span class="receipt-label">Arrears</span>
                                <small style="display: block; font-size: 0.7rem; color: #888; margin-top: -0.2rem;">(Previous Unpaid Balance)</small>
                            </div>
                            <span class="receipt-value">₱${data.arrears.toLocaleString()}</span>
                        </div>
                    </section>

                    <div class="receipt-total-section">
                        <div class="receipt-total-row">
                            <span class="receipt-total-label">Total Amount Due</span>
                            <span class="receipt-total-value">₱${data.totalDue.toLocaleString()}</span>
                        </div>
                        <div class="receipt-row" style="margin-top: 1rem; font-style: italic; color: #666;">
                            <span>Due Date:</span>
                            <span>${formatDateShort(bill.due_date)}</span>
                        </div>
                    </div>

                    <footer class="receipt-footer">
                        <p class="thanks-msg">Thank you for being a valued customer!</p>
                    </footer>
                </div>
            `;
        }
    };

    window.BillingEngine = BillingEngine;
})();
