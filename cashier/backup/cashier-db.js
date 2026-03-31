/**
 * Cashier Database Operations
 * Strictly isolated from the Admin side.
 */

(function() {
    async function loadSystemSettings() {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('*')
                .order('id')
                .limit(1)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error loading settings for cashier:', error);
            throw error;
        }
    }

    async function generateBillFromReading(customerId, currentReading, prevReading, readingDate) {
        try {
            const settings = await loadSystemSettings();
            const consumption = Math.max(0, currentReading - prevReading);
            
            // 1. Calculate Consumption Charge
            let consumptionCharge = 0;
            const t1T = settings.tier1_threshold || 10;
            const t1R = settings.tier1_rate || 15;
            const t2T = settings.tier2_threshold || 20;
            const t2R = settings.tier2_rate || 20;
            const t3R = settings.tier3_rate || 25;

            if (consumption > 0) {
                const t1Usage = Math.min(consumption, t1T);
                consumptionCharge += t1Usage * t1R;
                if (consumption > t1T) {
                    const t2Usage = Math.min(consumption - t1T, t2T - t1T);
                    consumptionCharge += t2Usage * t2R;
                    if (consumption > t2T) {
                        const t3Usage = consumption - t2T;
                        consumptionCharge += t3Usage * t3R;
                    }
                }
            }

            // 2. Fetch Customer Details for Discounts
            const { data: customer, error: custError } = await supabase
                .from('customers')
                .select('has_discount, customer_type')
                .eq('id', customerId)
                .single();
            
            if (custError) throw custError;

            // 3. Final Total Calculation
            const baseRate = parseFloat(settings.base_rate) || 150;
            let totalAmount = baseRate + consumptionCharge;

            // Apply SC/PWD Discount if applicable
            if (customer.has_discount) {
                const discountAmount = totalAmount * (parseFloat(settings.discount_percentage || 0) / 100);
                totalAmount -= discountAmount;
            }

            // 4. Check for Arrears (Previous Unpaid Bills)
            const { data: unpaidBills } = await supabase
                .from('billing')
                .select('balance')
                .eq('customer_id', customerId)
                .neq('status', 'paid');
            
            const arrears = unpaidBills ? unpaidBills.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0) : 0;
            totalAmount += arrears;

            // 5. Insert New Bill
            const periodEnd = new Date(readingDate);
            const periodStart = new Date(readingDate);
            periodStart.setMonth(periodStart.getMonth() - 1);
            
            const dueDate = new Date(readingDate);
            dueDate.setDate(dueDate.getDate() + (settings.cutoff_days || 15));

            const { data: newBill, error: insertError } = await supabase
                .from('billing')
                .insert([{
                    customer_id: customerId,
                    period_start: periodStart.toISOString().split('T')[0],
                    period_end: periodEnd.toISOString().split('T')[0],
                    due_date: dueDate.toISOString().split('T')[0],
                    previous_reading: prevReading,
                    current_reading: currentReading,
                    consumption: consumption,
                    amount: totalAmount,
                    balance: totalAmount,
                    status: 'unpaid',
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            return newBill;
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
            } else {
                const { error } = await supabase
                    .from('online_payments')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', paymentId);
                
                if (error) throw error;
            }
            return true;
        } catch (error) {
            console.error('Error verifying payment:', error);
            throw error;
        }
    }

    async function finalizePayment(billId, amount, method, reference) {
        try {
            const { data: bill, error: fetchError } = await supabase
                .from('billing')
                .select('balance')
                .eq('id', billId)
                .single();
            
            if (fetchError) throw fetchError;

            const newBalance = Math.max(0, bill.balance - amount);
            const status = (newBalance <= 0) ? 'paid' : 'unpaid';

            const { error: updateError } = await supabase
                .from('billing')
                .update({
                    balance: newBalance,
                    status: status,
                    payment_date: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', billId);

            if (updateError) throw updateError;
            return true;
        } catch (error) {
            throw error;
        }
    }

    // Export to window
    window.cashierDb = {
        generateBillFromReading,
        recordPayment,
        loadSystemSettings,
        verifyOnlinePayment
    };
})();
