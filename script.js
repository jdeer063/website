// Unified Login Logic
console.log('Script.js loaded');
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired');
    initializePasswordToggle();
    initializeForm();
    initializeRecoveryFlow();
    
    // Check for existing session and auto-redirect
    await checkExistingSession();
    
    checkRecoveryRedirect();
});

async function checkExistingSession() {
    if (!window.supabase) return;
    
    try {
        // 1. Check for fresh root session (usually immediately after login or if isolation is off)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            console.log('Active root session found, checking role for auto-redirect...');
            
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();
                
            if (profile) {
                // Perform handover and redirect
                const sessionStr = localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');
                if (profile.role === 'admin') {
                    if (sessionStr) localStorage.setItem('sb-admin-token', sessionStr);
                    localStorage.removeItem('sb-auth-token');
                    window.location.href = 'admin/dashboard.html';
                } else if (profile.role === 'cashier') {
                    if (sessionStr) localStorage.setItem('sb-cashier-token', sessionStr);
                    localStorage.removeItem('sb-auth-token');
                    window.location.href = 'cashier/collections.html';
                }
            }
        }
    } catch (err) {
        console.error('Session check failed:', err);
    }
}

// Missing function to handle password recovery redirects (if any)
function checkRecoveryRedirect() {
    // Check if the URL contains a recovery hash from Supabase
    // If we're using manual Code flow (EmailJS), this might not be needed
    // but we define it to avoid "Uncaught ReferenceError"
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('type=recovery'))) {
        console.log('Recovery link or token detected');
        // If it's a direct reset link, we might want to show step 3
        const modal = document.getElementById('forgotPasswordModal');
        if (modal) {
            modal.classList.add('active');
            showRecoveryStep(3); // Go straight to new password step
        }
    }
}

// Password visibility is now handled by togglePasswordVisibility in shared/utils.js

function initializePasswordToggle() {
    const passwordToggle = document.getElementById('passwordToggle');
    if (passwordToggle) {
        passwordToggle.onclick = () => window.togglePasswordVisibility('password', passwordToggle);
    }
}

// === FORM HANDLING ===
function initializeForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const emailInput = document.getElementById('email');
    const rememberCheckbox = document.getElementById('rememberMe');
    
    // Check for remembered email and "Remember Me" preference
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    const rememberedPassword = localStorage.getItem('rememberedPassword'); // NEW: Persist password
    const rememberMePref = localStorage.getItem('rememberMe') === 'true';
    
    if (rememberedEmail && emailInput) {
        emailInput.value = rememberedEmail;
        if (rememberedPassword && document.getElementById('password')) {
            document.getElementById('password').value = rememberedPassword;
        }
        if (rememberCheckbox) rememberCheckbox.checked = rememberMePref;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
    });

    // Forgot Password Flow Fixes
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    if (forgotBtn) {
        forgotBtn.onclick = () => {
            const modal = document.getElementById('forgotPasswordModal');
            if (modal) {
                modal.classList.add('active');
                showRecoveryStep(1);
            }
        };
    }

    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.onsubmit = (e) => {
            e.preventDefault();
            handleForgotPassword();
        };
    }

    const verifyCodeForm = document.getElementById('verifyCodeForm');
    if (verifyCodeForm) {
        verifyCodeForm.onsubmit = (e) => {
            e.preventDefault();
            handleVerifyCode();
        };
    }

    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.onsubmit = (e) => {
            e.preventDefault();
            handleResetPasswordManual();
        };
    }
}

// === RECOVERY FLOW (CUSTOM EMAILJS) ===
window.recoveryState = {
    email: '',
    code: ''
};

window.closeForgotPassword = function() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) {
        modal.classList.remove('active');
        // Reset steps after a delay
        setTimeout(() => showRecoveryStep(1), 300);
    }
};

window.showRecoveryStep = function(step) {
    document.getElementById('recoveryStep1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('recoveryStep2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('recoveryStep3').style.display = step === 3 ? 'block' : 'none';
};

function initializeRecoveryFlow() {
    console.log('Recovery flow initialized (EmailJS System)');
}

async function handleForgotPassword() {
    const emailInput = document.getElementById('recoveryEmail');
    const email = emailInput.value?.trim();
    const btn = document.getElementById('sendCodeBtn');
    const originalText = btn.innerHTML;

    if (!email) {
        showNotification('Please enter your email', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Code...';

        // Note: Checking if user exists is removed here because RLS prevents anonymous queries on profiles.
        // The password_resets table will still record the attempt.

        // 1. Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        window.recoveryState.email = email;
        window.recoveryState.code = code;

        console.log('Generating code for:', email);

        // 2. Save code to Supabase (password_resets table)
        const { error: saveError } = await supabase
            .from('password_resets')
            .upsert({ 
                email: email.toLowerCase(), 
                code,
                created_at: new Date().toISOString() // Force timestamp update
            }, { onConflict: 'email' });

        if (saveError) throw new Error('Database Error: ' + saveError.message);

        // 4. Send Email via EmailJS
        console.log('Attempting EmailJS send to:', email);
        
        const templateParams = {
            to_email: email, 
            code: code,
            to_name: email.split('@')[0], // Optional: gives a name to the recipient
            reply_to: 'no-reply@pulupandan.gov.ph'
        };

        // Explicitly passing Public Key as 4th parameter to ensure auth
        const emailResponse = await emailjs.send(
            'service_cvjnexg', 
            'template_tik8uhr', 
            templateParams,
            '0XD8wCzHIuhhtzt-b'
        );
        
        console.log('EmailJS Success:', emailResponse);

        showNotification('Verification code sent to your email', 'success');
        const displayEmail = document.getElementById('displayEmail');
        if (displayEmail) displayEmail.innerText = email;
        showRecoveryStep(2);
    } catch (error) {
        console.error('EmailJS Error Object:', error);
        // If the error is from EmailJS it might be an object
        const errorMsg = typeof error === 'object' ? (error.text || error.message) : error;
        showNotification('Email Error: ' + (errorMsg || 'Check EmailJS settings'), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function handleVerifyCode() {
    const codeInput = document.getElementById('verificationCode');
    const enteredCode = codeInput.value.trim();
    const btn = document.getElementById('verifyBtn');

    if (enteredCode.length !== 6) {
        showNotification('Please enter the 6-digit code', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

        // Use the secure RPC we created in SQL (Always trusts the server's clock)
        const { data: isValid, error: rpcError } = await supabase.rpc('verify_reset_code', {
            p_email: window.recoveryState.email,
            p_code: enteredCode
        });

        if (rpcError) throw new Error('Verification Error: ' + rpcError.message);

        if (!isValid) {
            throw new Error('Invalid or expired verification code. Please try again.');
        }

        showNotification('Code verified! Set your new password.', 'success');
        showRecoveryStep(3);
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Verify Code</span>';
    }
}

async function handleResetPasswordManual() {
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmNewPass').value;
    const btn = document.getElementById('savePassBtn');

    if (newPass !== confirmPass) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (newPass.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';

        // Call the Edge Function to actually update the password
        // This is necessary because we don't have a session
        const { data, error } = await supabase.functions.invoke('manual-password-reset', {
            body: { 
                email: window.recoveryState.email, 
                code: window.recoveryState.code,
                newPassword: newPass
            }
        });

        if (error || !data.success) {
            throw new Error(data?.error || error?.message || 'Update failed');
        }

        showNotification('Password updated successfully! Please sign in.', 'success');
        closeForgotPassword();
    } catch (error) {
        console.error('Update Error:', error);
        showNotification(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Update Password</span>';
    }
}

// === NOTIFICATION SYSTEM ===
// Using shared showNotification from shared/utils.js

// === LOGIN LOGIC (SUPABASE AUTH) ===
async function handleLogin() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const button = document.querySelector('.submit-btn'); // Assuming class 'submit-btn'
    const originalText = button.innerHTML;

    let email = emailInput.value.trim();
    const rawEmail = email; // Save original input before processing
    const password = passwordInput.value;

    // Automatically append @gmail.com if input is missing @
    if (email && !email.includes('@')) {
        email += '@gmail.com';
    }

    const rememberMe = document.getElementById('rememberMe')?.checked;

    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

        // 1. Authenticate with Supabase
        const { data: { user, session }, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        if (!user) throw new Error("Login failed. No user returned.");

        // 2. Fetch User Profile & Role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, first_name, last_name')
            .eq('id', user.id)
            .single();

        // 2a. ADMIN FALLBACK (For first-time setup only)
        // If profile doesn't exist but login worked, and it's the specific admin email, create it.
        // SECURITY NOTE: In production, remove this or secure it.
        /* 
        if (profileError && profileError.code === 'PGRST116') {
             // Handle missing profile logic here if needed, or error out.
             console.warn("Profile not found. If this is the master admin, please insert profile manually or run setup.");
        }
        */

        if (profileError || !profile) {
            console.error('Profile fetch error:', profileError);
            throw new Error('User profile not found. Contact administrator.');
        }

        // 3. Store Role for Session (Optional, mostly relied on token)
        sessionStorage.setItem('userRole', profile.role);

        // 3.1 Handle "Remember Me" Persistence
        if (rememberMe) {
            localStorage.setItem('rememberedEmail', rawEmail); 
            localStorage.setItem('rememberedPassword', password); // NEW: Persist password
            localStorage.setItem('rememberMe', 'true');
        } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberedPassword');
            localStorage.setItem('rememberMe', 'false');
        }

        // 4. Redirect based on Role with SESSION HANDOVER
        const currentToken = localStorage.getItem('sb-auth-token') || sessionStorage.getItem('sb-auth-token');
        
        switch (profile.role) {
            case 'admin':
                if (currentToken) localStorage.setItem('sb-admin-token', currentToken);
                showNotification(`Welcome back, ${profile.first_name || 'Admin'}!`, 'success');
                setTimeout(() => {
                    localStorage.removeItem('sb-auth-token');
                    window.location.href = 'admin/dashboard.html';
                }, 800);
                break;
            case 'cashier':
                if (currentToken) localStorage.setItem('sb-cashier-token', currentToken);
                showNotification(`Welcome back, ${profile.first_name || 'Cashier'}!`, 'success');
                setTimeout(() => {
                    localStorage.removeItem('sb-auth-token');
                    window.location.href = 'cashier/collections.html';
                }, 800);
                break;
            case 'reader':
                showNotification('Access Denied. Please use the Meter Reader Mobile App.', 'error');
                await supabase.auth.signOut({ scope: 'local' });
                button.disabled = false;
                button.innerHTML = originalText;
                return;
            default:
                showNotification('Unknown role. Access denied.', 'error');
                await supabase.auth.signOut({ scope: 'local' });
                button.disabled = false;
                button.innerHTML = originalText;
        }

    } catch (error) {
        console.error('Login Error:', error);
        showNotification(error.message || 'Invalid email or password', 'error');
        button.disabled = false;
        button.innerHTML = originalText;
    }
}
