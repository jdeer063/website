/**
 * Shared Utilities for PWD Management System
 */

(function () {
    /**
     * Securely escapes HTML special characters to prevent XSS
     */
    function escapeHTML(str) {
        if (!str) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(str).replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    /**
     * Format a date string to Local ISO Date (YYYY-MM-DD)
     */
    function getLocalISODate(date = new Date()) {
        const d = new Date(date);
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // en-CA format is YYYY-MM-DD
    }

    /**
     * Format Account ID for display
     */
    function getAccountID(id) {
        if (!id) return 'ACC-000';
        return `ACC-${String(id).padStart(3, '0')}`;
    }

    /**
     * Get Barangay from address
     */
    function getBarangay(address) {
        if (!address) return 'N/A';
        const lowerAddr = address.toLowerCase();
        const list = window.PULUPANDAN_BARANGAYS || [];
        const found = list.find(b => lowerAddr.includes(b.toLowerCase()));
        return found || address;
    }

    /**
     * Format Date/Time for display
     */
    function formatLocalDateTime(dateString, includeTime = true, useAt = false) {
        if (!dateString) return 'N/A';

        // Supabase returns timestamps without timezone (e.g. "2026-03-05T09:21:49.123")
        // JS new Date() treats those as LOCAL time, not UTC — causing wrong time display.
        // We force UTC interpretation by appending 'Z' if no tz info is present.
        let normalized = dateString;
        if (typeof dateString === 'string' &&
            (dateString.includes('T') || dateString.includes(' ')) &&
            !dateString.endsWith('Z') && !dateString.includes('+')) {
            normalized = dateString.replace(' ', 'T') + 'Z';
        }

        const date = new Date(normalized);
        if (isNaN(date.getTime())) return String(dateString);

        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Manila'
        };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = true;
        }
        
        const formatted = date.toLocaleString('en-US', options);
        return useAt ? formatted.replace(', ', ' at ') : formatted;
    }

    /**
     * Notification Helper
     */
    function showNotification(message, type = 'info') {
        let container = document.getElementById('notificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            // Simple default styling if first use
            container.style.cssText = 'position: fixed; top: 24px; right: 24px; z-index: 10000; pointer-events: none; display: flex; flex-direction: column; gap: 12px;';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = type === 'success' ? 
            '<i class="fas fa-check-circle"></i>' : 
            (type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-info-circle"></i>');

        notification.innerHTML = `
            <div class="notification-content" style="display: flex; align-items: center; gap: 12px; pointer-events: auto;">
                ${icon}
                <span>${message}</span>
            </div>
        `;

        container.appendChild(notification);
        
        // Trigger show animation
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 3500);
    }

    /**
     * Modal Closer
     */
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
                modal.style.removeProperty('opacity');
            }, 300);
        }
    }

    /**
     * Toggles password visibility for a specific input field
     */
    function togglePasswordVisibility(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        // Update FontAwesome icon if present
        const icon = btn.querySelector('i');
        if (icon) {
            if (isPassword) {
                icon.className = icon.className.replace('fa-eye-slash', 'fa-eye');
                // Support both 'fas' and 'far'
                if (icon.className.includes('fa-eye')) {
                   // Ensure it's the right eye icon
                }
            } else {
                icon.className = icon.className.replace('fa-eye', 'fa-eye-slash');
            }
        }
        
        // Update SVG if present (for landing page compatibility)
        const svg = btn.querySelector('svg');
        if (svg) {
            if (isPassword) {
                // eye
                svg.innerHTML = `<path d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z" stroke="currentColor" stroke-width="1.5" /><circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5" />`;
            } else {
                // eye-slash
                svg.innerHTML = `<path d="M1 9C1 9 4 3 9 3C14 3 17 9 17 9C17 9 14 15 9 15C4 15 1 9 1 9Z" stroke="currentColor" stroke-width="1.5" /><path d="M14.85 3.15L3.15 14.85" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`;
            }
        }

        // Restore focus
        input.focus();
    }

    /**
     * Initializes show/hide password toggles for all password fields
     */
    function initPasswordToggles(containerSelector = 'body') {
        const container = typeof containerSelector === 'string' ?
            document.querySelector(containerSelector) : containerSelector;

        if (!container) return;

        const passwordInputs = container.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            // Avoid duplicate initialization
            if (input.dataset.passwordToggleInit) return;
            input.dataset.passwordToggleInit = "true";

            // If already has a toggle in its parent wrapper, just attach event
            let wrapper = input.parentElement;
            if (!wrapper.classList.contains('password-input-wrapper') && 
                !wrapper.classList.contains('password-wrapper') &&
                !wrapper.classList.contains('password-input-wrapper-elegant')) {
                wrapper = document.createElement('div');
                wrapper.className = 'password-input-wrapper';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
            }

            // Check if toggle button already exists
            let toggle = wrapper.querySelector('.toggle-password, .password-toggle, .pass-toggle, .password-toggle-btn');
            if (!toggle) {
                toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'pass-toggle';
                toggle.setAttribute('aria-label', 'Toggle password visibility');
                toggle.innerHTML = '<i class="fas fa-eye"></i>';
                wrapper.appendChild(toggle);
            }

            // Only add listener if not already handled by inline onclick
            if (!toggle.onclick && !toggle.hasAttribute('onclick')) {
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const inputId = input.id || `pass-${Math.random().toString(36).substr(2, 9)}`;
                    if (!input.id) input.id = inputId;
                    togglePasswordVisibility(inputId, toggle);
                });
            }
        });
    }

    /**
     * Debounce Function
     */
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    /**
     * Normalize billing periods strings consistently (e.g. "Mar 2026" -> "March 2026")
     */
    function normalizePeriod(period, includeDay = false) {
        if (!period) return null;
        const str = period.trim();

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Handle "MM/DD/YYYY" full date format (e.g., "02/18/2026")
        const dateMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
            const monthIdx = parseInt(dateMatch[1]) - 1;
            const day = parseInt(dateMatch[2]);
            if (monthIdx >= 0 && monthIdx < 12) {
                return includeDay ? `${monthNames[monthIdx]} ${day}, ${dateMatch[3]}` : `${monthNames[monthIdx]} ${dateMatch[3]}`;
            }
        }

        // Try "YYYY-MM-DD" ISO date format (e.g., "2026-02-18")
        const isoDateMatch = str.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
        if (isoDateMatch) {
            const monthIdx = parseInt(isoDateMatch[2]) - 1;
            const day = isoDateMatch[3] ? parseInt(isoDateMatch[3]) : null;
            if (monthIdx >= 0 && monthIdx < 12) {
                return (includeDay && day) ? `${monthNames[monthIdx]} ${day}, ${isoDateMatch[1]}` : `${monthNames[monthIdx]} ${isoDateMatch[1]}`;
            }
        }

        // Try "M/YYYY" or "MM/YYYY" (e.g., "2/2026")
        const slashMatch = str.match(/^(\d{1,2})[\/\-\s](\d{4})$/);
        if (slashMatch) {
            const monthIdx = parseInt(slashMatch[1]) - 1;
            if (monthIdx >= 0 && monthIdx < 12) return `${monthNames[monthIdx]} ${slashMatch[2]}`;
        }

        // Handle string months like "March 30, 2026" or "Mar 2026"
        const words = str.split(/[\s,]+/); // Split by space or comma
        if (words.length >= 2) {
            const mStr = words[0].toLowerCase();
            const yStr = words[words.length - 1]; // last word is year
            const yearMatch = yStr.match(/^20\d{2}$/);
            
            if (yearMatch) {
                for (let i = 0; i < 12; i++) {
                    if (mStr === monthNames[i].toLowerCase() || mStr === shortNames[i].toLowerCase() || mStr.startsWith(shortNames[i].toLowerCase())) {
                        // Check if there's a day in the second word
                        const dayMatch = words.length > 2 ? words[1].match(/^(\d{1,2})$/) : null;
                        if (includeDay && dayMatch) {
                            return `${monthNames[i]} ${dayMatch[1]}, ${yStr}`;
                        }
                        return `${monthNames[i]} ${yStr}`;
                    }
                }
            }
        }

        // Fallback: capitalize first letter
        if (str.length > 0) {
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        }
        return str;
    }

    /**
     * Shows a loading overlay on a target element
     * Supports both string ID and DOM element
     */
    function showLoading(target) {
        const el = typeof target === 'string' ? document.getElementById(target) : target;
        if (!el) return;

        // ONLY allow the main global loading overlay as per user request
        if (el.id !== 'loadingOverlay') {
            console.log('[pwdUtils] showLoading suppressed for localized element:', el.id || el.className);
            return;
        }

        // Ensure target is relative for overlay positioning
        el.classList.add('loading-relative');
        el.classList.add('table-loading');

        let overlay = el.querySelector('.loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="water-loader">
                    <div class="drop"></div>
                    <div class="drop"></div>
                    <div class="drop"></div>
                </div>
            `;
            el.appendChild(overlay);
        }

        // Trigger reflow for animation
        overlay.offsetHeight;
        overlay.classList.add('active');
        overlay.classList.remove('fade-out');
    }

    /**
     * Hides a loading overlay from a target element
     */
    function hideLoading(target) {
        const el = typeof target === 'string' ? document.getElementById(target) : target;
        if (!el) return;

        const overlay = el.querySelector('.loading-overlay');
        if (overlay) {
            overlay.classList.add('fade-out');
            overlay.classList.remove('active');
            
            // Cleanup after transition
            setTimeout(() => {
                if (overlay && overlay.parentNode === el) {
                    overlay.remove();
                }
                // Only remove relative if no other loaders (unlikely but safe)
                if (!el.querySelector('.loading-overlay')) {
                    el.classList.remove('loading-relative');
                    el.classList.remove('table-loading');
                }
            }, 350); 
        }
    }

    // Export to window
    window.pwdUtils = {
        getLocalISODate,
        formatLocalDateTime,
        showLoading,
        hideLoading,
        showNotification,
        closeModal,
        getAccountID,
        getBarangay,
        debounce,
        escapeHTML,
        initPasswordToggles,
        normalizePeriod
    };

    // Global overrides for backward compatibility
    window.togglePasswordVisibility = togglePasswordVisibility;
    window.formatLocalDateTime = formatLocalDateTime;
    window.showNotification = showNotification;
    window.closeModal = closeModal;
    window.getLocalISODate = getLocalISODate;
    window.getAccountID = getAccountID;
    window.getBarangay = getBarangay;
    window.debounce = debounce;
    window.escapeHTML = escapeHTML;
    window.initPasswordToggles = initPasswordToggles;
    window.normalizePeriod = normalizePeriod;
})();
