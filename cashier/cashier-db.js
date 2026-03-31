/**
 * Cashier Database Operations
 * Strictly isolated from the Admin side.
 */

(function () {
    async function loadSystemSettings() {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error loading settings for cashier:', error);
            throw error;
        }
    }

    async function loadRateSchedules() {
        try {
            const { data, error } = await supabase
                .from('rate_schedules')
                .select('*')
                .order('id');
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error loading rate schedules for cashier:', error);
            throw error;
        }
    }

    async function generateBillFromReading(customerId, currentReading, prevReading, readingDate) {
        try {
            const [settings, schedules] = await Promise.all([
                loadSystemSettings(),
                loadRateSchedules()
            ]);

            // Fetch Customer Details for Discounts and Type
            const { data: customer, error: custError } = await supabase
                .from('customers')
                .select('*') // Get all fields including meter_size and has_discount
                .eq('id', customerId)
                .single();

            if (custError) throw custError;

            // Determine proper schedule
            const schedule = schedules.find(s => s.category_key === customer.customer_type);

            // Use Centered Billing Engine
            const billData = {
                consumption: Math.max(0, currentReading - prevReading),
                customer_id: customerId,
                due_date: new Date(new Date(readingDate).getTime() + (parseInt(settings.overdue_days || 14) * 24 * 60 * 60 * 1000)).toISOString()
            };

            const calculation = window.BillingEngine.calculate(billData, customer, settings, schedule);

            // 6. Insert New Bill via RPC (Secure)
            const { data: result, error: rpcError } = await supabase.rpc('generate_bill', {
                p_customer_id: customerId,
                p_current_reading: currentReading,
                p_previous_reading: prevReading,
                p_month_date: readingDate,
                p_amount: calculation.totalDue,
                p_consumption: calculation.consumption,
                p_due_date: billData.due_date.split('T')[0],
                p_base_charge: calculation.baseRate,
                p_consumption_charge: calculation.consumptionCharge,
                p_penalty: calculation.penalty,
                p_arrears: calculation.arrears
            });

            if (rpcError) throw rpcError;

            // --- Audit Log ---
            if (window.logAuditAction) {
                await window.logAuditAction(
                    'CREATE',
                    'billing',
                    result || 'new',
                    `Cashier generated manual bill for customer ID: ${customerId}`
                );
            }

            return result;
        } catch (error) {
            console.error('Cashier DB Error generating bill:', error);
            throw error;
        }
    }

    async function recordPayment(billId, amount, method, reference) {
        try {
            if (method === 'cash') {
                return await finalizePayment(billId, amount, method, reference);
            } else {
                // Online payment goes to the verification queue
                return await submitOnlinePayment(billId, amount, method, reference);
            }
        } catch (error) {
            console.error('Cashier DB Error recording payment:', error);
            throw error;
        }
    }

    async function submitOnlinePayment(billId, amount, method, reference) {
        try {
            const { data: bill } = await supabase.from('billing').select('customer_id').eq('id', billId).single();

            const { error } = await supabase
                .from('online_payments')
                .insert([{
                    bill_id: billId,
                    customer_id: bill.customer_id,
                    amount: amount,
                    platform: method,
                    reference_number: reference,
                    status: 'pending'
                }]);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error submitting online payment:', error);
            throw error;
        }
    }

    async function verifyOnlinePayment(paymentId, action) {
        try {
            if (action === 'approve') {
                const { data: payment } = await supabase
                    .from('online_payments')
                    .select('*')
                    .eq('id', paymentId)
                    .single();

                // Finalize the payment on the bill
                await finalizePayment(payment.bill_id, payment.amount, payment.platform, payment.reference_number);

                const { error } = await supabase
                    .from('online_payments')
                    .update({ status: 'verified', updated_at: new Date().toISOString() })
                    .eq('id', paymentId);

                if (error) throw error;

                // --- Audit Log ---
                if (window.logAuditAction) {
                    await window.logAuditAction(
                        'UPDATE',
                        'payment',
                        paymentId,
                        `Verified online payment for Bill ID: ${payment.bill_id} (Ref: ${payment.reference_number})`
                    );
                }
            } else {
                const { error } = await supabase
                    .from('online_payments')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', paymentId);

                if (error) throw error;

                // --- Audit Log ---
                if (window.logAuditAction) {
                    await window.logAuditAction(
                        'UPDATE',
                        'payment',
                        paymentId,
                        `Rejected online payment`
                    );
                }
            }
            return true;
        } catch (error) {
            console.error('Error verifying payment:', error);
            throw error;
        }
    }

    async function finalizePayment(billId, amount, method, reference) {
        try {
            // Call Secure RPC
            const { data, error } = await supabase.rpc('record_payment', {
                p_bill_id: billId,
                p_amount: amount,
                p_method: method,
                p_reference: reference
            });

            if (error) throw error;

            // --- Audit Log ---
            if (window.logAuditAction) {
                const billRef = `#BIL-${String(billId).padStart(3, '0')}`;
                await window.logAuditAction(
                    'PAYMENT',
                    'billing',
                    billId,
                    `Processed ${method} payment of ₱${amount} for ${billRef}${reference ? ` (Ref: ${reference})` : ''}`
                );
            }

            return true;
        } catch (error) {
            console.error('Finalize Payment Error:', error);
            throw error;
        }
    }

    async function reactivateCustomer(customerId) {
        try {
            const { data, error } = await supabase.rpc('reactivate_customer', {
                p_customer_id: customerId
            });

            if (error) throw error;

            // --- Audit Log ---
            if (window.logAuditAction) {
                await window.logAuditAction(
                    'UPDATE',
                    'customer',
                    customerId,
                    `Cashier reactivated customer account (ID: ${customerId})`
                );
            }

            return true;
        } catch (error) {
            console.error('Error reactivating customer:', error);
            throw error;
        }
    }

    // Export to window
    window.cashierDb = {
        generateBillFromReading,
        recordPayment,
        loadSystemSettings,
        loadRateSchedules,
        verifyOnlinePayment,
        reactivateCustomer
    };
})();
