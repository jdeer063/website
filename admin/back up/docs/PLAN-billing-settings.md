# PLAN: System Settings & Billing Brain

Implementing a centralized "System Settings" module to manage water rates, discounts, and disconnection policies with PIN security.

## User Review Required

> [!IMPORTANT]
> **Tiered Rate Logic**
> I'm proposing a 3-tier system by default (e.g., 0-10m³, 11-20m³, 21+m³). Admin will be able to adjust the "Threshold" and "Rate" for each tier.

> [!WARNING]
> **PIN Security**
> For simplicity, we'll start with a single **Master Admin PIN** stored in the database. In the future, this can be linked to individual staff profiles.

## Proposed Changes

### Database Schema

#### [NEW] [system_settings table](file:///c:/Users/Dell/OneDrive/Desktop/Projects/portfolio/water%20baby/website/admin/database-schema.sql)

- `id`: PRIMARY KEY
- `base_rate`: Decimal (Minimum charge)
- `tier1_threshold`: Integer (e.g., 10)
- `tier1_rate`: Decimal
- `tier2_threshold`: Integer (e.g., 20)
- `tier2_rate`: Decimal
- `tier3_rate`: Decimal (Any consumption above Tier 2)
- `discount_percentage`: Decimal (e.g., 20.00 for PWD/SC)
- `cutoff_days`: Integer (Days overdue before disconnection)
- `admin_pin`: String (Hashed or simple for MVP)

### UI Components

#### [MODIFY] [dashboard.html](file:///c:/Users/Dell/OneDrive/Desktop/Projects/portfolio/water%20baby/website/admin/dashboard.html)

- Add "System Settings" to sidebar navigation (id: `settingsPage`).
- Create Settings UI with grouped cards:
  - **Billing Rates**: Tiered inputs.
  - **Discounts**: Percentage input.
  - **Policies**: Cut-off days input.

### Business Logic

#### [MODIFY] [admin.js](file:///c:/Users/Dell/OneDrive/Desktop/Projects/portfolio/water%20baby/website/admin/admin.js)

- Implement `showSettings()` page switching.
- Add "Save Settings" handler with a PIN prompt modal.
- Implement PIN verification before calling write operations.

#### [MODIFY] [database.js](file:///c:/Users/Dell/OneDrive/Desktop/Projects/portfolio/water%20baby/website/admin/database.js)

- `loadSettings()`: Fetch from Supabase.
- `updateSettings(data)`: Update in Supabase.
- **Billing Integration**: Refactor billing calculation to use these dynamic settings instead of hardcoded values.

## Verification Plan

### Automated Tests

- Run `ux_audit.py` to check accessibility of the settings form.

### Manual Verification

1. **Settings Adjustment**:
   - Change a rate and save (should prompt for PIN).
   - Enter wrong PIN (should block save).
   - Enter correct PIN (should confirm update).
2. **Billing Impact**:
   - Generate a new bill after changing rates.
   - Verify calculation follows the new tiers.
3. **Policy Logic**:
   - Change "Cutoff Days" and verify that overdue status logic updates accordingly.
