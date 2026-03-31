# PLAN: Scheduling Overhaul

Overhaul the current "Area Assignments" system into a dynamic, color-coded "Box" management interface for Readers and Barangays.

## Phase 0: Socratic Gate (Confirmed)

> [!NOTE]
> **1. The 12 AM Reset**:
>
> - **Confirmed**: Reset happens client-side when the admin first logs in after midnight. Logic will check `last_sync` timestamp.

> [!NOTE]
> **2. Barangay Source**:
>
> - **Confirmed**: Use the official Pulupandan list (20 Barangays).
> - **List**: Zone 1, Zone 1-A, Zone 2, Zone 3, Zone 4, Zone 4-A, Zone 5, Zone 6, Zone 7, Canjusa, Crossing Pulupandan, Culo, Mabini, Pag-ayon, Palaka Norte, Palaka Sur, Patic, Tapong, Ubay, Utod.

> [!NOTE]
> **3. Reader Selection**:
>
> - **Confirmed**: Pull from `staff` table where role is `reader`.

> [!NOTE]
> **4. Data Persistence**:
>
> - Boxes and Barangays persist. Only the `assigned_reader_id` is cleared at the 12 AM sync (triggered on first admin login of the day).

---

## Proposed Changes (Conceptual)

### 1. Database Schema (`scheduling`/`assignments`)

- Update `assignments` table to support:
  - Box Name (string)
  - Box Color (hex code/class)
  - Associated Barangays (JSON/Array)
  - Assigned Reader ID (foreign key)

### 2. Dashboard UI (`#schedulingPage`)

- **Initial State**: A single glassmorphism "Add" button (`+`).
- **Creation Modal**:
  - Input: Name
  - Input: Color Picker (Preset premium palette)
  - Multi-select: Barangays
  - Select: Reader
- **Box Component**:
  - Displays Name + Color.
  - Click to open "Quick Edit" Modal (Add/Remove Barangays, Swap Reader).
  - Status Indicator: Shows if a reader is currently active for the day.

### 3. Business Logic

- **Midnight Reset**: Logic to trigger the clearing of the `assigned_reader_id` column while preserving geography.
- **Dynamic Grid**: The `+` button automatically shifts to the right of the last created box.

---

## Verification Plan

### Manual Verification

1. Create a "North Area" box with Blue color and assign 3 barangays.
2. Verify the box appears in the grid.
3. Edit the box to remove one barangay and change the reader.
4. Simulate 12 AM reset and confirm only the reader is cleared.
