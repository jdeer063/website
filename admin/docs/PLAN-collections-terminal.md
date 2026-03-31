# PLAN: Dedicated Cashier Dashboard Workspace

This plan follows the modular approach, creating a specialized `cashier/` directory for operational tasks.

## Phase 0: Specialized Workflow

### 1. Meter Reading & Billing Side

- **Input/Upload**: specialized tool for adding latest meter readings.
- **Auto-Calculations**: Applies system rates, penalties, and discounts.
- **Service Invoice**: Prints the Statement of Account.

### 2. Main Cashier & Payments

- **Verify Online Payments**: Queue for verifying digital transfers.
- **Cash Payments**: Fast entry for walk-in payments.
- **Official Receipt**: Prints the proof of payment.
- **Ledger**: Real-time balance and history lookup.

---

## Phase 1: Infrastructure & Separation

- [ ] Create `cashier/` folder.
- [ ] [NEW] `cashier/dashboard.html`: Clean layout with only Dashboard, Customers, and Billing.
- [ ] [NEW] `cashier/cashier.js`: Specialized operations logic.
- [ ] [NEW] `cashier/cashier.css`: Clean, focused styles.
- [ ] [NEW] `cashier/auth-guard.js`: Role-specific protection (only 'cashier' allowed).
- [ ] [MODIFY] `script.js`: Update login logic to route based on `currentRole`.

## Phase 2: Meter Reading Interface

- [ ] Add Reading tool (Manual/Bulk).
- [ ] Consumption calculation logic (Tiers).
- [ ] Print Service Invoice generator.

## Phase 3: Payment Center Tools

- [ ] Online Payment verification queue.
- [ ] Penalty verification/override.
- [ ] Print Official Receipt generator.

## Phase 4: Verification

- [ ] Login Redirection: Admin -> `/admin`, Cashier -> `/cashier`.
- [ ] Security: Verify that Admin cannot access `/cashier` and vice versa.
- [ ] Full Cycle: Reading -> Bill -> Payment -> Receipt.
