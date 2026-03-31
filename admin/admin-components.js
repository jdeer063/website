/**
 * Admin Dashboard - UI Components & Template Generators
 * Modularized to keep the main logic clean.
 */

// Global state mirrors or shared references
const PREMIUM_PALETTE = window.PREMIUM_PALETTE || [];
let modalSelectedBarangays = [];
let tempSubSelectedBarangays = [];

// === UI HELPERS ===
function closeModal(modalId) {
    if (window.pwdUtils && window.pwdUtils.closeModal) {
        window.pwdUtils.closeModal(modalId);
    } else {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }
}

function openModal(id) {
    console.log('Opening modal:', id);
    if (id === 'customerModal') return showCustomerModal();
    if (id === 'staffModal') return showStaffModal();
    
    // Generic fallback for fixed modals (like cutoffConfirmModal)
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

// Make globally accessible
window.closeModal = closeModal;
window.openModal = openModal;


/**
 * Customer Modal Generator
 */
function showCustomerModal() {
    const modalHTML = `
        <div class="modal-overlay premium-modal-overlay" id="customerModal">
            <div class="ec-modal-card">

                <!-- Gradient Top Bar -->
                <div class="ec-header-bar">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle">
                            <i class="fas fa-user-plus"></i>
                        </div>
                        <div>
                            <h2 class="ec-title">New Customer</h2>
                            <p class="ec-subtitle">Registration Form</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('customerModal')" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Step Progress -->
                <div class="ec-stepper">
                    <div class="ec-step active" id="custStep1Ind">
                        <div class="ec-step-bubble">1</div>
                        <span class="ec-step-text">Personal</span>
                    </div>
                    <div class="ec-step-line"><div class="ec-step-line-fill" id="customerStepperFill"></div></div>
                    <div class="ec-step" id="custStep2Ind">
                        <div class="ec-step-bubble">2</div>
                        <span class="ec-step-text">Service</span>
                    </div>
                </div>

                <!-- Form Body -->
                <div class="ec-body">
                    <form class="premium-form" id="customerForm" novalidate>

                        <!-- STEP 1: Personal Info -->
                        <div class="modal-step active" id="custStep1">
                            <div class="ec-form-grid ec-col-3">
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">Last Name <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="lastName" placeholder="Dela Cruz" required />
                                </div>
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">First Name <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="firstName" placeholder="Juan" required />
                                </div>
                                <div class="ec-field ec-span-1">
                                    <label class="ec-label">M.I.</label>
                                    <input class="ec-input ec-input-center" type="text" name="middleInitial" placeholder="—" maxlength="1" />
                                </div>
                            </div>

                            <div class="ec-form-grid ec-col-3">
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">Contact Number <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="tel" name="contact" id="custContact" placeholder="09XXXXXXXXX" maxlength="11" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11); window.validateCustomerStep1();" required />
                                    <div class="ec-error-message" id="custContactError">Must start with 09 and be 11 digits.</div>
                                </div>
                                <div class="ec-field ec-span-1">
                                    <label class="ec-label">Age <span class="ec-req">*</span></label>
                                    <input class="ec-input ec-input-center" type="number" name="age" id="custAge" placeholder="—" min="1" max="150" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3); window.validateCustomerStep1();" required />
                                    <div class="ec-error-message" id="custAgeError">Must be 18 or older.</div>
                                </div>
                            </div>

                            <div class="ec-footer">
                                <button type="button" class="ec-btn-ghost" onclick="closeModal('customerModal')">Cancel</button>
                                <button type="button" class="ec-btn-primary" id="custBtnNext" disabled>
                                    Next Step <i class="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>

                        <!-- STEP 2: Service Info -->
                        <div class="modal-step" id="custStep2">
                            <div class="ec-form-grid ec-col-2">
                                <div class="ec-field">
                                    <label class="ec-label">Barangay <span class="ec-req">*</span></label>
                                    <select class="ec-select" name="address" required>
                                        <option value="">-- Select --</option>
                                        ${(window.PULUPANDAN_BARANGAYS || []).map(b => `<option value="${b}">${b}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="ec-field">
                                    <label class="ec-label">Customer Type <span class="ec-req">*</span></label>
                                    <select class="ec-select" name="customerType" required>
                                        <option value="residential">Residential</option>
                                        <option value="commercial-a">Semi-Commercial A</option>
                                        <option value="commercial-b">Semi-Commercial B</option>
                                        <option value="commercial-c">Semi-Commercial C</option>
                                        <option value="full-commercial">Industrial</option>
                                        <option value="bulk">Bulk / Wholesale</option>
                                    </select>
                                </div>

                                <div class="ec-field">
                                    <label class="ec-label">Meter Number <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="meterNumber" placeholder="Serial No." required />
                                </div>
                            </div>

                            <div class="ec-field" style="margin-top: 1rem;">
                                <div class="senior-discount-card" id="seniorDiscountCard">
                                    <div class="senior-info">
                                        <div class="senior-icon"><i class="fas fa-wheelchair"></i></div>
                                        <div class="senior-text">
                                            <span class="senior-label">Senior Citizen Discount</span>
                                            <span class="senior-percentage">${window.currentSettings ? (window.currentSettings.discount_percentage || 0) : 5}% reduction applied</span>
                                        </div>
                                    </div>
                                    <label class="ec-switch">
                                        <input type="checkbox" name="discount" id="custDiscount" value="true" />
                                        <span class="ec-switch-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div class="ec-footer">
                                <button type="button" class="ec-btn-ghost" id="custBtnBack">
                                    <i class="fas fa-arrow-left"></i> Back
                                </button>
                                <button type="submit" class="ec-btn-success" id="custBtnSubmit">
                                    <i class="fas fa-save"></i> Save Customer
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;
    
    // Initial Validation Setup
    window.validateCustomerStep1 = () => {
        const form = document.getElementById('customerForm');
        const nextBtn = document.getElementById('custBtnNext');
        if (!form || !nextBtn) return;

        const lastName = (form.lastName.value || '').trim();
        const firstName = (form.firstName.value || '').trim();
        const contact = (form.contact.value || '').trim();
        const agePart = form.age.value;
        const age = parseInt(agePart);

        let isValid = true;

        // Reset errors
        document.querySelectorAll('#customerModal .ec-field').forEach(f => f.classList.remove('has-error'));

        // Basic Check
        if (!lastName || !firstName) isValid = false;

        // Contact Check: 09XXXXXXXXX (11 digits)
        const contactValid = /^09\d{9}$/.test(contact);
        if (contact && !contactValid) {
            const err = document.getElementById('custContactError');
            if (err) err.parentElement.classList.add('has-error');
            isValid = false;
        } else if (!contact) {
            isValid = false;
        }

        // Age Check: 18+
        if (agePart && age < 18) {
            const err = document.getElementById('custAgeError');
            if (err) err.parentElement.classList.add('has-error');
            isValid = false;
        } else if (!agePart) {
            isValid = false;
        }

        // Auto-check Senior Discount (60+)
        const discountCheck = document.getElementById('custDiscount');
        const seniorCard = document.getElementById('seniorDiscountCard');
        if (discountCheck) {
            if (age >= 60) {
                discountCheck.checked = true;
                if (seniorCard) seniorCard.classList.add('active');
            } else if (agePart && age < 60) {
                // Optionally could uncheck here if it was auto-checked, 
                // but usually better to leave manual state unless specifically asked for "strict uncheck"
            }
        }

        nextBtn.disabled = !isValid;
    };

    // Meter Suggestion Logic
    async function suggestNextMeterNumber() {
        const input = document.querySelector('#customerForm input[name="meterNumber"]');
        if (!input) return;

        try {
            // Get the latest one by ID (most recent)
            const { data, error } = await supabase
                .from('customers')
                .select('meter_number')
                .order('id', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const latest = data[0].meter_number;
                if (!latest || latest === 'N/A') return;

                const currentYear = new Date().getFullYear();
                
                // Common Patterns: MTR-YYYY-NNN or MTR-NNN
                const parts = latest.split('-');
                if (parts.length >= 2) {
                    const lastPart = parts[parts.length - 1];
                    const numMatch = lastPart.match(/\d+/);
                    if (numMatch) {
                        const nextNum = parseInt(numMatch[0]) + 1;
                        const padded = nextNum.toString().padStart(lastPart.length, '0');
                        
                        // Construct next logical ID
                        const nextStr = `MTR-${currentYear}-${padded}`;
                        input.placeholder = `e.g. ${nextStr}`;
                    }
                }
            }
        } catch (e) {
            console.warn('Meter suggestion failed:', e);
        }
    }

    // Manual Switch Logic
    document.getElementById('customerForm').addEventListener('change', (e) => {
        if (e.target.id === 'custDiscount') {
            const card = document.getElementById('seniorDiscountCard');
            if (card) {
                if (e.target.checked) card.classList.add('active');
                else card.classList.remove('active');
            }
        }
    });

    // Add listners for name fields too
    const step1Inputs = document.querySelectorAll('#custStep1 input');
    step1Inputs.forEach(input => {
        if (!input.hasAttribute('oninput')) {
            input.addEventListener('input', window.validateCustomerStep1);
        }
    });

    // Show modal
    const modal = document.getElementById('customerModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        // Run initial validation
        window.validateCustomerStep1();
        // Predict next meter number
        suggestNextMeterNumber();
    }

    // Stepper Logic
    let currentStep = 1;
    const totalSteps = 2;
    const fill = document.getElementById('customerStepperFill');

    function updateStepper() {
        document.querySelectorAll('#customerModal .modal-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`custStep${currentStep}`).classList.add('active');
 
        document.querySelectorAll('#customerModal .ec-step').forEach((item, idx) => {
            if (idx + 1 < currentStep) {
                item.classList.add('completed');
                item.classList.remove('active');
            } else if (idx + 1 === currentStep) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });
 
        if (fill) fill.style.width = currentStep === 1 ? '0%' : '100%';
    }
 
    // Attach event delegation for navigation
    document.getElementById('customerForm').addEventListener('click', (e) => {
        const nextBtn = e.target.closest('#custBtnNext');
        const backBtn = e.target.closest('#custBtnBack');
 
        if (nextBtn) {
            e.preventDefault();
            const step1 = document.getElementById('custStep1');
            const inputs = step1.querySelectorAll('input[required]');
            let valid = true;
            inputs.forEach(i => {
                if (!i.checkValidity()) {
                    i.style.borderColor = 'var(--danger)';
                    valid = false;
                } else {
                    i.style.borderColor = '';
                }
            });
 
            if (!valid) {
                showNotification('Please fill in all personal details.', 'error');
                return;
            }
            if (currentStep < totalSteps) {
                currentStep++;
                updateStepper();
            }
        }
  
        if (backBtn) {
            e.preventDefault();
            if (currentStep > 1) {
                currentStep--;
                updateStepper();
            }
        }
    });

    document.getElementById('customerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!e.target.checkValidity()) {
            showNotification('Please complete all required fields.', 'error');
            return;
        }
        const formData = new FormData(e.target);
        const customer = Object.fromEntries(formData);
        customer.discount = formData.get('discount') === 'true';

        const submitBtn = document.getElementById('custBtnSubmit');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            await window.dbOperations.addCustomer(customer);
            closeModal('customerModal');
            showNotification('Customer added successfully!', 'success');
        } catch (error) {
            console.error('Failed to add customer:', error);
            showNotification(error.message || 'Failed to add customer.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}
window.showCustomerModal = showCustomerModal;

/**
 * Staff Modal Generator
 */
function showStaffModal() {
    const modalHTML = `
        <div class="modal-overlay premium-modal-overlay" id="staffModal">
            <div class="ec-modal-card" style="width: 500px;">
                
                <!-- Header -->
                <div class="ec-header-bar">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle">
                            <i class="fas fa-user-plus"></i>
                        </div>
                        <div>
                            <h2 class="ec-title">New Staff</h2>
                            <p class="ec-subtitle">Registration Form</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('staffModal')" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Step Progress -->
                <div class="ec-stepper">
                    <div class="ec-step active" id="staffStep1Ind">
                        <div class="ec-step-bubble">1</div>
                        <span class="ec-step-text">Personal</span>
                    </div>
                    <div class="ec-step-line"><div class="ec-step-line-fill" id="staffStepperFill"></div></div>
                    <div class="ec-step" id="staffStep2Ind">
                        <div class="ec-step-bubble">2</div>
                        <span class="ec-step-text">Security</span>
                    </div>
                </div>

                <!-- Form Body -->
                <div class="ec-body">
                    <form class="premium-form" id="staffForm" novalidate>
                        
                        <!-- STEP 1: Personal Info -->
                        <div class="modal-step active" id="staffStep1">
                            <div class="ec-form-grid ec-col-3">
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">Last Name <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="lastName" placeholder="e.g. Dela Cruz" required />
                                </div>
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">First Name <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="firstName" placeholder="e.g. Juan" required />
                                </div>
                                <div class="ec-field ec-span-1">
                                    <label class="ec-label">M.I.</label>
                                    <input class="ec-input ec-input-center" type="text" name="middleInitial" placeholder="—" maxlength="1" />
                                </div>
                            </div>

                            <div class="ec-form-grid ec-col-2">
                                <div class="ec-field">
                                    <label class="ec-label">Role <span class="ec-req">*</span></label>
                                    <select class="ec-select" name="role" required>
                                        <option value="cashier">Cashier</option>
                                        <option value="reader">Meter Reader</option>
                                    </select>
                                </div>
                                <div class="ec-field">
                                    <label class="ec-label">Contact Number <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="tel" name="contact" id="staffContact" placeholder="09XXXXXXXXX" maxlength="11" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11); window.validateStaffStep1();" required />
                                    <div class="ec-error-message" id="staffContactError">Must start with 09 and be 11 digits.</div>
                                </div>
                            </div>

                            <div class="ec-form-grid ec-col-3">
                                <div class="ec-field ec-span-1">
                                    <label class="ec-label">Age <span class="ec-req">*</span></label>
                                    <input class="ec-input ec-input-center" type="number" name="age" id="staffAge" placeholder="25" min="1" max="150" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3); window.validateStaffStep1();" required />
                                    <div class="ec-error-message" id="staffAgeError">Must be 18 or older.</div>
                                </div>
                            </div>

                            <div class="ec-footer">
                                <button type="button" class="ec-btn-ghost" onclick="closeModal('staffModal')">Cancel</button>
                                <button type="button" class="ec-btn-primary" id="staffBtnNext" disabled>
                                    Next Step <i class="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>

                        <!-- STEP 2: Security Info -->
                        <div class="modal-step" id="staffStep2">
                            <div class="ec-form-grid">
                                <div class="ec-field">
                                    <label class="ec-label">Username <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="username" placeholder="Enter username" required />
                                </div>
                            </div>

                            <div class="ec-form-grid ec-col-2">
                                <div class="ec-field">
                                    <label class="ec-label">Password <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="password" id="staffPassword" name="password" placeholder="••••••••" minlength="6" required />
                                </div>
                                <div class="ec-field">
                                    <label class="ec-label">Confirm Password <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="password" id="staffConfirmPassword" placeholder="••••••••" required />
                                </div>
                            </div>

                            <div class="ec-footer">
                                <button type="button" class="ec-btn-ghost" id="staffBtnBack">
                                    <i class="fas fa-arrow-left"></i> Back
                                </button>
                                <button type="submit" class="ec-btn-success" id="staffBtnSubmit">
                                    <i class="fas fa-user-check"></i> Register Staff
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    const modal = document.getElementById('staffModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    // Validation Logic
    window.validateStaffStep1 = () => {
        const form = document.getElementById('staffForm');
        const nextBtn = document.getElementById('staffBtnNext');
        if (!form || !nextBtn) return;

        const lastName = form.lastName.value.trim();
        const firstName = form.firstName.value.trim();
        const contact = form.contact.value.trim();
        const age = parseInt(form.age.value);

        let isValid = true;

        // Reset errors
        document.querySelectorAll('#staffModal .ec-field').forEach(f => f.classList.remove('has-error'));

        // Basic Check
        if (!lastName || !firstName) isValid = false;

        // Contact Check: 09XXXXXXXXX (11 digits)
        const contactValid = /^09\d{9}$/.test(contact);
        if (contact && !contactValid) {
            document.getElementById('staffContactError').parentElement.classList.add('has-error');
            isValid = false;
        } else if (!contact) {
            isValid = false;
        }

        // Age Check: 18+
        if (form.age.value && age < 18) {
            document.getElementById('staffAgeError').parentElement.classList.add('has-error');
            isValid = false;
        } else if (!form.age.value) {
            isValid = false;
        }

        nextBtn.disabled = !isValid;
    };

    // Add listners for all step 1 fields
    const step1Inputs = document.querySelectorAll('#staffStep1 input, #staffStep1 select');
    step1Inputs.forEach(input => {
        if (!input.hasAttribute('oninput')) {
            input.addEventListener('input', window.validateStaffStep1);
        }
    });

    // Run initial validation
    window.validateStaffStep1();

    // Stepper Navigation Logic
    let currentStep = 1;
    const totalSteps = 2;
    const fill = document.getElementById('staffStepperFill');

    function updateStepper() {
        // Handle Content
        document.querySelectorAll('#staffModal .modal-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`staffStep${currentStep}`).classList.add('active');

        // Handle Indicators
        document.querySelectorAll('#staffModal .ec-step').forEach((item, idx) => {
            if (idx + 1 < currentStep) {
                item.classList.add('completed');
                item.classList.remove('active');
            } else if (idx + 1 === currentStep) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });

        // Handle Progress Bar
        if (fill) fill.style.width = currentStep === 1 ? '0%' : '100%';
    }

    // Attach event delegation for navigation
    document.getElementById('staffForm').addEventListener('click', (e) => {
        const nextBtn = e.target.closest('#staffBtnNext');
        const backBtn = e.target.closest('#staffBtnBack');

        if (nextBtn) {
            e.preventDefault();
            // Basic validation for Step 1
            const step1 = document.getElementById('staffStep1');
            const inputs = step1.querySelectorAll('input[required], select[required]');
            let valid = true;
            inputs.forEach(i => {
                if (!i.checkValidity()) {
                    i.style.borderColor = 'var(--danger)';
                    valid = false;
                } else {
                    i.style.borderColor = '';
                }
            });

            if (!valid) {
                showNotification('Please fill in all personal details correctly.', 'error');
                return;
            }

            if (currentStep < totalSteps) {
                currentStep++;
                updateStepper();
            }
        }

        if (backBtn) {
            e.preventDefault();
            if (currentStep > 1) {
                currentStep--;
                updateStepper();
            }
        }
    });


    // Initialize password toggles
    if (window.initPasswordToggles) {
        window.initPasswordToggles('#staffModal');
    }

    document.getElementById('staffForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        // Validate missing fields in Step 2
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');
        const confirmPassword = document.getElementById('staffConfirmPassword').value;

        if (!username || !password || !confirmPassword) {
            showNotification('Please fill in all authentication details.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        // Validate password match
        if (password !== confirmPassword) {
            showNotification('Passwords do not match!', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        if (password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        const email = username + '@gmail.com'; 

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No active session.');

            const role = formData.get('role');
            const firstName = formData.get('firstName');
            const lastName = formData.get('lastName');
            const middleInitial = formData.get('middleInitial');
            const contact = formData.get('contact');
            const age = formData.get('age');

            const { data, error } = await supabase.functions.invoke('create-user', {
                body: { email, password, role, firstName, lastName, middleInitial, username, contact, age }
            });

            if (error) throw error;
            if (!data || !data.success) throw new Error(data?.error || 'Unknown Error');

            showNotification('Staff created successfully!', 'success');
            closeModal('staffModal');

            if (window.dbOperations?.loadStaff) window.dbOperations.loadStaff();
        } catch (err) {
            console.error('Staff creation failed:', err);
            showNotification(err.message || 'Failed to create user', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}
window.showStaffModal = showStaffModal;

/**
 * Area Box Modal Overhaul (Scheduling)
 */
async function showAreaBoxModal(box = null) {
    if (!window.dbOperations || !window.dbOperations.PULUPANDAN_BARANGAYS) {
        showNotification('System Error: Required data not loaded.', 'error');
        return;
    }

    const isEdit = !!box;
    modalSelectedBarangays = isEdit ? (box.barangays || []) : [];
    const initialPalette = PREMIUM_PALETTE.find(p => p.color === box?.color) || PREMIUM_PALETTE[0];
    const selectedColor = isEdit ? box.color : initialPalette.color;
    const { data: readers } = await supabase
        .from('staff')
        .select('id, first_name, last_name, username')
        .ilike('role', '%reader%');

    const colorPickerHTML = PREMIUM_PALETTE.map(p => `
        <div class="color-opt ${p.color === selectedColor ? 'active' : ''}" 
             style="background: ${p.color}" 
             title="${p.name}"
             onclick="selectModalColor(this, '${p.color}', '${p.rgb}')"></div>
    `).join('');

    const modalHTML = `
        <div class="modal-overlay premium-modal-overlay" id="boxModal">
            <div class="ec-modal-card" style="width: 560px; --primary: ${selectedColor}; --primary-rgb: ${initialPalette.rgb}; --active-tag-color: ${selectedColor}; --active-tag-rgb: ${initialPalette.rgb}">
                
                <!-- Header -->
                <div class="ec-header-bar" style="background: linear-gradient(135deg, ${selectedColor} 0%, ${selectedColor}cc 100%); padding: 1.25rem 1.5rem;">
                    <div class="ec-header-left" style="gap: 1rem;">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2); color: #fff; border-color: rgba(255,255,255,0.3); width: 44px; height: 44px; border-radius: 14px; font-size: 1.2rem;">
                            <i class="fas fa-layer-group"></i>
                        </div>
                        <div>
                            <h2 class="ec-title" style="font-size: 1.15rem;">${isEdit ? 'Edit Sector' : 'New Sector'}</h2>
                            <p class="ec-subtitle" style="font-size: 0.75rem;">Area Configuration</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('boxModal')" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Body -->
                <div class="ec-body">
                    <form class="premium-form" id="areaBoxForm" novalidate>
                        <input type="hidden" name="color" id="modalSelectedColor" value="${selectedColor}" />
                        
                        <!-- Row 1: Sector Name (full width) -->
                        <div class="ec-form-grid" style="margin-bottom: 0;">
                            <div class="ec-field">
                                <label class="ec-label" style="font-size: 0.75rem;">Sector Name <span class="ec-req">*</span></label>
                                <input class="ec-input" type="text" name="name" required placeholder="e.g. North Sector" value="${isEdit ? box.name : ''}" style="padding: 0.6rem 0.875rem;" />
                            </div>
                        </div>

                        <!-- Row 2: Theme Color -->
                        <div class="ec-field" style="margin-bottom: 1rem;">
                            <label class="ec-label" style="font-size: 0.75rem;">Sector Theme Color</label>
                            <div class="color-options" style="padding: 0.5rem; gap: 0.75rem;">
                                ${colorPickerHTML}
                            </div>
                        </div>

                        <!-- Row 3: Assigned Barangays -->
                        <div class="ec-field" style="margin-bottom: 1rem;">
                            <label class="ec-label" style="font-size: 0.75rem;">Assigned Barangays <span class="ec-req">*</span></label>
                            <div id="selectedBarangaysContainer" class="selected-barangays-flex" style="padding: 0.75rem; min-height: 50px;"></div>
                            <button type="button" class="ec-btn-ghost" style="margin-top: 0.5rem; width: 100%; justify-content: center; display: flex; align-items: center; gap: 0.5rem; height: 38px;" onclick="showBarangaySelector(${isEdit ? box.id : 'null'})">
                                <i class="fas fa-plus-circle"></i> Manage Locations
                            </button>
                        </div>

                        <!-- Row 4: Assigned Reader -->
                        <div class="ec-form-grid" style="margin-bottom: 0;">
                            <div class="ec-field">
                                <label class="ec-label" style="font-size: 0.75rem;">Assigned Reader</label>
                                <select class="ec-select" name="readerId" style="padding: 0.6rem 0.875rem;">
                                    <option value="">-- No Reader Assigned --</option>
                                    ${(readers || []).map(r => `<option value="${r.id}" ${isEdit && box.assigned_reader_id === r.id ? 'selected' : ''}>${r.last_name}, ${r.first_name} (@${r.username || r.id})</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- Footer Actions -->
                        <div class="ec-footer" style="padding-top: 1rem;">
                            ${isEdit ? `<button type="button" class="ec-btn-danger" style="margin-right: auto; padding: 0.6rem 1rem;" onclick="window.dbOperations.deleteAreaBox(${box.id})"><i class="fas fa-trash-alt"></i></button>` : ''}
                            <button type="button" class="ec-btn-ghost" onclick="closeModal('boxModal')" style="padding: 0.6rem 1.25rem;">Cancel</button>
                            <button type="submit" class="ec-btn-primary" style="padding: 0.6rem 1.5rem;">
                                <i class="fas fa-check-circle"></i> ${isEdit ? 'Save Changes' : 'Create Sector'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;
    
    // Show modal
    const modal = document.getElementById('boxModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    renderSelectedBarangayTags();

    const form = document.getElementById('areaBoxForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        if (modalSelectedBarangays.length === 0) {
            showNotification('Please select at least one Barangay.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }
        const formData = new FormData(form);
        const data = {
            name: formData.get('name'),
            color: formData.get('color'),
            barangays: modalSelectedBarangays,
            readerId: formData.get('readerId') ? parseInt(formData.get('readerId')) : null
        };
        try {
            if (isEdit) await window.dbOperations.updateAreaBox(box.id, data);
            else await window.dbOperations.addAreaBox(data);
            showNotification(isEdit ? 'Area Box updated!' : 'Area Box created!', 'success');
            closeModal('boxModal');
        } catch (error) {
            console.error('Failed to save area box:', error);
            showNotification(error.message || 'Failed to save area box.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}
window.showAreaBoxModal = showAreaBoxModal;
window.showAddBoxModal = () => showAreaBoxModal();
window.showEditBoxModal = (box) => showAreaBoxModal(box);

function renderSelectedBarangayTags() {
    const container = document.getElementById('selectedBarangaysContainer');
    if (!container) return;
    if (modalSelectedBarangays.length === 0) {
        container.innerHTML = '<span style="color: #94A3B8; font-size: 0.85rem; width: 100%; text-align: center;">No barangays selected yet</span>';
        return;
    }
    container.innerHTML = modalSelectedBarangays.map(bg => `
        <div class="selected-tag">
            <span>${bg}</span>
            <i class="fas fa-times" onclick="removeBarangayFromModal('${bg}')"></i>
        </div>
    `).join('');
}

window.removeBarangayFromModal = function (bg) {
    modalSelectedBarangays = modalSelectedBarangays.filter(item => item !== bg);
    renderSelectedBarangayTags();
};

window.showBarangaySelector = function (currentBoxId = null) {
    tempSubSelectedBarangays = [...modalSelectedBarangays];

    // Create assignment lookup map (Barangay -> Box Info)
    const assignments = {};
    if (window.allAreaBoxes) {
        window.allAreaBoxes.forEach(box => {
            if (box.id !== currentBoxId) { // Skip current box
                (box.barangays || []).forEach(bg => {
                    assignments[bg] = {
                        boxName: box.name,
                        color: box.color,
                        rgb: (window.PREMIUM_PALETTE || []).find(p => p.color === box.color)?.rgb || '148, 163, 184'
                    };
                });
            }
        });
    }

    const selectorHTML = `
        <div class="modal-overlay sub-modal" id="barangaySelectorModal">
            <div class="modal small-modal">
                <div class="modal-header">
                    <h3>Select Barangays</h3>
                    <button class="modal-close" onclick="closeModal('barangaySelectorModal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="sub-modal-content">
                    <div class="search-input-wrapper">
                        <i class="fas fa-search search-icon-sub"></i>
                        <input type="text" class="search-field-sub" placeholder="Search barangays or areas..." oninput="filterBarangayList(this.value)" />
                    </div>
                    <div class="barangay-select-list" id="fullBarangayList"></div>
                    <div class="modal-footer themed-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('barangaySelectorModal')">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="confirmBarangaySelection()">Confirm Selection</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    // 1. Cleanup existing sub-modal container to prevent duplicate IDs
    const existing = document.getElementById('subModalContainer');
    if (existing) existing.remove();

    const subContainer = document.createElement('div');
    subContainer.id = 'subModalContainer';
    document.body.appendChild(subContainer);
    subContainer.innerHTML = selectorHTML;

    // Show sub-modal
    const modal = document.getElementById('barangaySelectorModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    renderFullBarangayList('', assignments);
};

function renderFullBarangayList(filter = '', assignments = {}) {
    const listEl = document.getElementById('fullBarangayList');
    if (!listEl) return;
    const allBarangays = window.dbOperations.PULUPANDAN_BARANGAYS;
    const filtered = allBarangays.filter(bg => bg.toLowerCase().includes(filter.toLowerCase()));
    listEl.innerHTML = filtered.map(bg => {
        const isSelected = tempSubSelectedBarangays.includes(bg);
        const assigned = assignments[bg];

        if (assigned) {
            return `
                <div class="select-item assigned-elsewhere" 
                     style="--box-color: ${assigned.color}; --box-color-rgb: ${assigned.rgb}"
                     title="Assigned to ${assigned.boxName} (Locked)">
                    <span class="bg-name">${bg}</span>
                </div>
            `;
        }

        return `<div class="select-item ${isSelected ? 'selected' : ''}" onclick="toggleBarangaySelection('${bg}', this)">${bg}</div>`;
    }).join('');
}
window.filterBarangayList = renderFullBarangayList;

window.toggleBarangaySelection = function (bg, el) {
    if (tempSubSelectedBarangays.includes(bg)) {
        tempSubSelectedBarangays = tempSubSelectedBarangays.filter(item => item !== bg);
        el.classList.remove('selected');
    } else {
        tempSubSelectedBarangays.push(bg);
        el.classList.add('selected');
    }
};

window.confirmBarangaySelection = function () {
    modalSelectedBarangays = [...tempSubSelectedBarangays];
    renderSelectedBarangayTags();
    closeModal('barangaySelectorModal');
};

window.selectModalColor = function (el, color, rgb) {
    document.querySelectorAll('.color-opt').forEach(opt => opt.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('modalSelectedColor').value = color;
    const modal = document.querySelector('#boxModal .ec-modal-card');
    if (modal) {
        modal.style.setProperty('--primary', color);
        modal.style.setProperty('--primary-rgb', rgb);
        modal.style.setProperty('--active-tag-color', color);
        modal.style.setProperty('--active-tag-rgb', rgb);
        
        // Also update header background
        const header = modal.querySelector('.ec-header-bar');
        if (header) {
            header.style.background = `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`;
        }
    }
};

/**
 * Bill Detailed Modal
 */
async function showBillModal(billId) {
    try {
        const { data: bill, error } = await supabase
            .from('billing')
            .select(`*, 
                customers (id, last_name, first_name, middle_initial, address, meter_number, customer_type, has_discount, meter_size), 
                collector:profiles!collected_by(first_name, last_name)`)
            .eq('id', billId)
            .maybeSingle();

        if (error) throw error;
        const customer = bill.customers;
        if (!customer) throw new Error('Customer information missing');

        const middleInitial = customer.middle_initial ? ` ${customer.middle_initial}.` : '';
        const customerName = `${customer.last_name}, ${customer.first_name}${middleInitial}`;

        // Dynamic attribution: Pull the name of the staff member who processed this specific payment
        // We use the alias 'collector' from our join
        const collectorProfile = bill.collector;
        const cashierName = collectorProfile ? `${collectorProfile.first_name} ${collectorProfile.last_name}` : 'CASHIER';

        // Settings and Schedules for logic
        const [settings, schedules] = await Promise.all([
            window.dbOperations.loadSystemSettings(),
            window.dbOperations.loadRateSchedules()
        ]);

        const schedule = schedules.find(s => s.category_key === customer.customer_type);

        const data = window.BillingEngine.calculate(bill, customer, settings, schedule);
        const invoiceHTML = window.BillingEngine.generateInvoiceHTML(bill, customer, data, { 
            customerName,
            cashierName,
            premiumTimestamp: true 
        });

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

        // Show modal
        const modal = document.getElementById('billModal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    } catch (error) {
        console.error('Error showing bill modal:', error);
        showNotification('Failed to load bill details', 'error');
    }
}

// Print helper for admin invoice
window.printBill = function (billId) {
    document.body.classList.add('printing-invoice');
    window.print();
    document.body.classList.remove('printing-invoice');
};

window.showBillModal = showBillModal;

/**
 * Edit Customer Modal
 */
function editCustomer(customerId, row, cells) {
    const customer = {
        id: customerId,
        firstName: row.dataset.firstName || '',
        lastName: row.dataset.lastName || '',
        middleInitial: row.dataset.middleInitial || '',
        address: row.dataset.address || '',
        meterNumber: row.dataset.meterNumber || '',
        contact: row.dataset.contact || '',
        age: row.dataset.age || '',
        status: (row.dataset.status || 'active').toLowerCase(),
        discount: row.dataset.discount === 'true',
        type: row.dataset.type || 'residential',
        meterSize: row.dataset.meterSize || '1/2"'
    };

    const modalHTML = `
        <div class="modal-overlay premium-modal-overlay" id="editCustomerModal">
            <div class="ec-modal-card">

                <!-- Gradient Top Bar -->
                <div class="ec-header-bar">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle">
                            <i class="fas fa-user-edit"></i>
                        </div>
                        <div>
                            <h2 class="ec-title">Edit Customer</h2>
                            <p class="ec-subtitle">ID: #${String(customerId).padStart(3, '0')}</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('editCustomerModal')" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Step Progress -->
                <div class="ec-stepper">
                    <div class="ec-step active" id="editCustStep1Ind">
                        <div class="ec-step-bubble">1</div>
                        <span class="ec-step-text">Personal</span>
                    </div>
                    <div class="ec-step-line"><div class="ec-step-line-fill" id="editCustFill"></div></div>
                    <div class="ec-step" id="editCustStep2Ind">
                        <div class="ec-step-bubble">2</div>
                        <span class="ec-step-text">Service</span>
                    </div>
                </div>

                <!-- Form Body -->
                <div class="ec-body">
                    <form class="premium-form" id="editCustomerForm" novalidate>

                        <!-- STEP 1: Personal Info -->
                        <div class="modal-step active" id="editCustStep1">
                            <div class="ec-form-grid ec-col-3">
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">Last Name <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="lastName" value="${customer.lastName}" placeholder="Last name" required />
                                </div>
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">First Name <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="firstName" value="${customer.firstName}" placeholder="First name" required />
                                </div>
                                <div class="ec-field ec-span-1">
                                    <label class="ec-label">M.I.</label>
                                    <input class="ec-input ec-input-center" type="text" name="middleInitial" value="${customer.middleInitial}" placeholder="—" maxlength="1" />
                                </div>
                            </div>

                            <div class="ec-form-grid ec-col-3">
                                <div class="ec-field ec-span-2">
                                    <label class="ec-label">Contact Number <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="tel" name="contact" value="${customer.contact ? (customer.contact.startsWith('0') ? '+63' + customer.contact.slice(1) : (customer.contact.startsWith('63') ? '+' + customer.contact : (customer.contact.startsWith('+63') ? customer.contact : '+63' + customer.contact))) : '+63'}" placeholder="+639XXXXXXXXX" maxlength="13" oninput="let digits = this.value.replace(/[^0-9]/g, ''); if(digits.startsWith('63')) digits = digits.slice(2); else if(digits.startsWith('0')) digits = digits.slice(1); this.value = '+63' + digits.slice(0, 10);" required />
                                </div>
                                <div class="ec-field ec-span-1">
                                    <label class="ec-label">Age <span class="ec-req">*</span></label>
                                    <input class="ec-input ec-input-center" type="number" name="age" value="${customer.age}" placeholder="—" min="1" max="150" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 3)" required />
                                </div>
                            </div>

                            <div class="ec-field">
                                <label class="ec-label">Account Status</label>
                                <div class="ec-status-group" id="editCustStatusToggle">
                                    <button type="button" class="ec-status-btn ${customer.status !== 'inactive' ? 'active-status' : ''}" data-status="active">
                                        <i class="fas fa-check-circle"></i> Active
                                    </button>
                                    <button type="button" class="ec-status-btn ${customer.status === 'inactive' ? 'inactive-status' : ''}" data-status="inactive">
                                        <i class="fas fa-times-circle"></i> Inactive
                                    </button>
                                    <input type="hidden" name="status" value="${customer.status || 'active'}" id="editCustStatusInput" />
                                </div>
                            </div>

                            <div class="ec-footer">
                                <button type="button" class="ec-btn-ghost" onclick="closeModal('editCustomerModal')">Cancel</button>
                                <button type="button" class="ec-btn-primary" id="editCustNext">
                                    Next Step <i class="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        </div>

                        <!-- STEP 2: Service Info -->
                        <div class="modal-step" id="editCustStep2">
                            <div class="ec-form-grid ec-col-2">
                                <div class="ec-field">
                                    <label class="ec-label">Barangay <span class="ec-req">*</span></label>
                                    <select class="ec-select" name="address" required>
                                        ${(window.PULUPANDAN_BARANGAYS || []).map(b => `<option value="${b}" ${customer.address === b ? 'selected' : ''}>${b}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="ec-field">
                                    <label class="ec-label">Customer Type <span class="ec-req">*</span></label>
                                    <select class="ec-select" name="customerType" required>
                                        <option value="residential" ${customer.type === 'residential' ? 'selected' : ''}>Residential</option>
                                        <option value="commercial-a" ${customer.type === 'commercial-a' ? 'selected' : ''}>Semi-Commercial A</option>
                                        <option value="commercial-b" ${customer.type === 'commercial-b' ? 'selected' : ''}>Semi-Commercial B</option>
                                        <option value="commercial-c" ${customer.type === 'commercial-c' ? 'selected' : ''}>Semi-Commercial C</option>
                                        <option value="full-commercial" ${customer.type === 'full-commercial' ? 'selected' : ''}>Industrial</option>
                                        <option value="bulk" ${customer.type === 'bulk' ? 'selected' : ''}>Bulk / Wholesale</option>
                                    </select>
                                </div>

                                <div class="ec-field">
                                    <label class="ec-label">Meter Number <span class="ec-req">*</span></label>
                                    <input class="ec-input" type="text" name="meterNumber" value="${customer.meterNumber}" placeholder="MTR-XXXX-XXX" required />
                                </div>
                            </div>

                            <div class="ec-footer">
                                <button type="button" class="ec-btn-ghost" id="editCustBack">
                                    <i class="fas fa-arrow-left"></i> Back
                                </button>
                                <button type="submit" class="ec-btn-success" id="editCustSubmit">
                                    <i class="fas fa-check-circle"></i> Save Changes
                                </button>
                            </div>
                        </div>

                    </form>
                </div><!-- /.ec-body -->
            </div><!-- /.ec-modal-card -->
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    
    // Show modal
    const modal = document.getElementById('editCustomerModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    // Status Toggle Logic
    const statusInputs = document.getElementById('editCustStatusInput');
    const statusButtons = document.querySelectorAll('#editCustStatusToggle .ec-status-btn');

    statusButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            statusInputs.value = status;
            statusButtons.forEach(b => {
                b.classList.remove('active-status', 'inactive-status');
            });
            btn.classList.add(status === 'active' ? 'active-status' : 'inactive-status');
        });
    });

    // Stepper Logic
    let currentStep = 1;
    const totalSteps = 2;
    const btnNext = document.getElementById('editCustNext');
    const btnBack = document.getElementById('editCustBack');
    const btnSubmit = document.getElementById('editCustSubmit');
    const fill = document.getElementById('editCustFill');

    function updateStepper() {
        document.querySelectorAll('#editCustomerModal .modal-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`editCustStep${currentStep}`).classList.add('active');

        document.querySelectorAll('#editCustomerModal .ec-step').forEach((item, idx) => {
            if (idx + 1 < currentStep) {
                item.classList.add('completed');
                item.classList.remove('active');
            } else if (idx + 1 === currentStep) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });

        if (fill) fill.style.width = currentStep === 1 ? '0%' : '100%';
    }

    // Attach listener via event delegation to handle buttons inside active steps
    document.getElementById('editCustomerForm').addEventListener('click', (e) => {
        const nextBtn = e.target.closest('#editCustNext');
        const backBtn = e.target.closest('#editCustBack');

        if (nextBtn) {
            e.preventDefault();
            
            const step1 = document.getElementById('editCustStep1');
            const inputs = step1.querySelectorAll('input[required], select[required]');
            let valid = true;
            inputs.forEach(i => {
                if (!i.checkValidity()) {
                    i.style.borderColor = 'var(--danger)';
                    valid = false;
                } else {
                    i.style.borderColor = '';
                }
            });

            if (!valid) {
                showNotification('Please check personal details.', 'error');
                return;
            }

            if (currentStep < totalSteps) {
                currentStep++;
                updateStepper();
            }
        }
        
        if (backBtn) {
            e.preventDefault();
            if (currentStep > 1) {
                currentStep--;
                updateStepper();
            }
        }
    });

    document.getElementById('editCustomerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!e.target.checkValidity()) {
            showNotification('Please check all fields.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

        const formData = new FormData(e.target);
        const updatedCustomer = Object.fromEntries(formData);
        updatedCustomer.discount = formData.get('discount') === 'true';

        try {
            await window.dbOperations.updateCustomer(customerId, updatedCustomer);
            showNotification('Customer updated successfully!', 'success');
            closeModal('editCustomerModal');
        } catch (error) {
            console.error('Failed to update customer:', error);
            showNotification(error.message || 'Failed to update customer.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}
window.editCustomer = editCustomer;

/**
 * Edit Staff Modal
 */
function editStaff(staffId, row, cells) {
    const staff = {
        id: staffId,
        firstName: row.dataset.firstName || '',
        lastName: row.dataset.lastName || '',
        middleInitial: row.dataset.middleInitial || '',
        role: (row.dataset.role || 'reader').toLowerCase(),
        contact: row.dataset.contact || '',
        age: row.dataset.age || '',
        status: (row.dataset.status || 'active').toLowerCase()
    };

    const modalHTML = `
        <div class="modal-overlay premium-modal-overlay" id="editStaffModal">
            <div class="ec-modal-card" style="width: 480px;">
                
                <!-- Header -->
                <div class="ec-header-bar">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle">
                            <i class="fas fa-user-shield"></i>
                        </div>
                        <div>
                            <h2 class="ec-title">Edit Staff</h2>
                            <p class="ec-subtitle">#S${String(staffId).padStart(3, '0')} • ${staff.role.toUpperCase()}</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeModal('editStaffModal')" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Form Body -->
                <div class="ec-body">
                    <form class="premium-form" id="editStaffForm" novalidate>
                        
                        <div class="ec-form-grid ec-col-3">
                            <div class="ec-field ec-span-2">
                                <label class="ec-label">Last Name <span class="ec-req">*</span></label>
                                <input class="ec-input" type="text" name="lastName" value="${staff.lastName}" required />
                            </div>
                            <div class="ec-field ec-span-2">
                                <label class="ec-label">First Name <span class="ec-req">*</span></label>
                                <input class="ec-input" type="text" name="firstName" value="${staff.firstName}" required />
                            </div>
                            <div class="ec-field ec-span-1">
                                <label class="ec-label">M.I.</label>
                                <input class="ec-input ec-input-center" type="text" name="middleInitial" value="${staff.middleInitial}" maxlength="1" placeholder="—" />
                            </div>
                        </div>

                        <div class="ec-form-grid ec-col-2">
                            <div class="ec-field">
                                <label class="ec-label">Role <span class="ec-req">*</span></label>
                                <select class="ec-select" name="role" required>
                                    <option value="cashier" ${staff.role === 'cashier' ? 'selected' : ''}>Cashier</option>
                                    <option value="reader" ${staff.role === 'reader' ? 'selected' : ''}>Meter Reader</option>
                                </select>
                            </div>
                            <div class="ec-field">
                                <label class="ec-label">Contact Number <span class="ec-req">*</span></label>
                                <input class="ec-input" type="tel" name="contact" value="${staff.contact}" maxlength="11" oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11)" required />
                            </div>
                        </div>

                        <div class="ec-form-grid ec-col-3" style="align-items: flex-end;">
                            <div class="ec-field ec-span-1">
                                <label class="ec-label">Age <span class="ec-req">*</span></label>
                                <input class="ec-input ec-input-center" type="number" name="age" value="${staff.age}" min="1" max="150" required />
                            </div>
                            <div class="ec-field ec-span-2">
                                <label class="ec-label">Account Status</label>
                                <div class="ec-status-group">
                                    <button type="button" class="ec-status-btn ${staff.status === 'active' ? 'active-status' : ''}" data-status="active">
                                        <i class="fas fa-check-circle"></i> Active
                                    </button>
                                    <button type="button" class="ec-status-btn ${staff.status === 'inactive' ? 'inactive-status' : ''}" data-status="inactive">
                                        <i class="fas fa-times-circle"></i> Inactive
                                    </button>
                                </div>
                                <input type="hidden" name="status" value="${staff.status}" id="editStaffStatusInput" />
                            </div>
                        </div>

                        <div class="ec-footer">
                            <button type="button" class="ec-btn-ghost" onclick="closeModal('editStaffModal')">Cancel</button>
                            <button type="submit" class="ec-btn-primary" id="editStaffSubmit">
                                <i class="fas fa-check-double"></i> Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHTML;

    // Show modal
    const modal = document.getElementById('editStaffModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }

    // Status Toggle Logic
    const statusBtns = document.querySelectorAll('#editStaffModal .ec-status-btn');
    const statusInput = document.getElementById('editStaffStatusInput');
    
    statusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            statusInput.value = status;
            
            // Clear current states
            statusBtns.forEach(b => b.classList.remove('active-status', 'inactive-status'));
            
            // Apply new state
            if (status === 'active') btn.classList.add('active-status');
            else btn.classList.add('inactive-status');
        });
    });

    document.getElementById('editStaffForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!e.target.checkValidity()) {
            showNotification('Please check all fields.', 'error');
            return;
        }
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const formData = new FormData(e.target);
        const updatedStaff = Object.fromEntries(formData);

        try {
            await window.dbOperations.updateStaff(staffId, updatedStaff);
            showNotification('Staff updated successfully!', 'success');
            closeModal('editStaffModal');
        } catch (error) {
            console.error('Failed to update staff:', error);
            showNotification(error.message || 'Failed to update staff.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}
window.editStaff = editStaff;

/**
 * Premium Confirm Modal
 * Replaces the native browser confirm() dialog
 */
function showConfirmModal(options = {}) {
    const {
        title = 'Are you sure?',
        message = 'This action cannot be undone.',
        confirmText = 'Yes, Proceed',
        cancelText = 'Cancel',
        type = 'danger',
        onConfirm = () => { }
    } = options;

    const typeConfig = {
        danger: { icon: 'fa-trash-alt', color: '#ef4444' },
        warning: { icon: 'fa-exclamation-triangle', color: '#f59e0b' },
        info: { icon: 'fa-info-circle', color: '#3b82f6' },
        success: { icon: 'fa-check-circle', color: '#10b981' }
    };

    const config = typeConfig[type] || typeConfig.danger;

    const modalHTML = `
        <div class="modal-overlay premium-modal-overlay" id="confirmModalOverlay">
            <div class="ec-modal-card" style="width: 440px;">
                
                <!-- Header with Type Indicator -->
                <div class="ec-header-bar" style="background: linear-gradient(135deg, ${config.color}, ${config.color}CC); border: none;">
                    <div class="ec-header-left">
                        <div class="ec-avatar-circle" style="background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3);">
                            <i class="fas ${config.icon}"></i>
                        </div>
                        <div>
                            <h2 class="ec-title">${title}</h2>
                            <p class="ec-subtitle" style="color: rgba(255,255,255,0.8);">Confirmation Required</p>
                        </div>
                    </div>
                    <button class="ec-close-btn" onclick="closeConfirmModal()" aria-label="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="ec-body" style="padding: 2.5rem 2rem;">
                    <p style="color: var(--ec-text-main); font-size: 1.1rem; line-height: 1.6; margin: 0; font-weight: 500; text-align: center;">
                        ${message}
                    </p>

                    <div class="ec-footer" style="padding-top: 2rem; border-top: none; justify-content: center; gap: 1.25rem;">
                        <button type="button" class="ec-btn-ghost" style="flex: 1; justify-content: center;" onclick="closeConfirmModal()">${cancelText}</button>
                        <button type="button" id="confirmModalAction" class="ec-btn-${type}" style="flex: 1.2; justify-content: center;">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.id = 'confirmModalWrapper';
    wrapper.innerHTML = modalHTML;
    document.body.appendChild(wrapper);

    // Initial state and activation
    const overlay = document.getElementById('confirmModalOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);

    // Handle Confirm Click
    const confirmBtn = document.getElementById('confirmModalAction');
    confirmBtn.addEventListener('click', () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        onConfirm();
        // The modal is usually closed by onConfirm or by the caller, 
        // but we'll also call closeConfirmModal here to ensure cleanup if onConfirm doesn't do it.
        // Actually, many onConfirm implementations are async, so we should wait if possible,
        // but showConfirmModal signature doesn't currently support async wait easily without refactoring.
        // For now, disabling the button is the primary goal.
        closeConfirmModal();
    });
}

function closeConfirmModal() {
    const wrapper = document.getElementById('confirmModalWrapper');
    if (wrapper) {
        const modal = wrapper.querySelector('.confirm-modal');
        const overlay = wrapper.querySelector('.confirm-modal-overlay');

        if (modal) modal.style.transform = 'scale(0.9) translateY(20px)';
        if (modal) modal.style.opacity = '0';
        if (overlay) overlay.style.opacity = '0';

        setTimeout(() => wrapper.remove(), 300);
    }
}

window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;

/**
 * Shared Pagination UI Renderer
 * @param {string} containerId - Container element ID
 * @param {number} totalItems - Total number of records
 * @param {number} currentPage - Current page number (1-indexed)
 * @param {number} pageSize - Number of items per page
 * @param {string} onPageChange - Callback function name for page click
 */
window.renderPagination = function (containerId, totalItems, currentPage, pageSize, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Ensure it has the correct class for styling
    container.classList.add('pagination-container');

    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalItems);

    let html = `
        <div class="pagination-info">
            Showing <strong>${startIdx}-${endIdx}</strong> of <strong>${totalItems}</strong> entries
        </div>
        <div class="pagination-controls">
            <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
    `;

    const delta = 2;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
            html += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="${onPageChange}(${i})">${i}</button>
            `;
        } else if (i === (currentPage - delta - 1) || i === (currentPage + delta + 1)) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    html += `
            <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;

    container.innerHTML = html;
};
