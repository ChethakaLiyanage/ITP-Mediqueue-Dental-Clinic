# Prescription & Treatment Plan Filtering Logic

## Overview
Updated the prescription and treatment plan pages to show only **active/ongoing** records by default. Past/completed records are now only visible in the **Medical History** page.

## Backend Changes

### 1. Prescriptions (`BACKEND/Controllers/PatientPrescriptionControllers.js`)
- **Endpoint**: `GET /api/prescriptions/my-prescriptions`
- **Default Behavior**: Only returns **active prescriptions** (`isActive: true`)
- **For Medical History**: Pass `?includeInactive=1` to get all prescriptions (including inactive)

```javascript
// By default, only show active prescriptions
if (req.query.includeInactive !== "1") {
  filter.isActive = true;
}
```

### 2. Treatment Plans (`BACKEND/Controllers/PatientTreatmentplanControllers.js`)
- **Endpoint**: `GET /api/treatments/my-treatments`
- **Default Behavior**: Only returns treatments with status: `active` (excludes archived)
- **For Medical History**: Pass `?includeArchived=1` to get all treatments (including archived)
- **Note**: Treatment status can be either `active` or `archived` (as defined in TreatmentplanModel)

```javascript
// By default, only show active treatments (not archived)
if (!includeArchived && !req.query.status) {
  filter.status = 'active';
}
```

## Frontend Changes

### 1. Prescriptions Page (`frontend/src/Components/Profile/ProfilePrescriptions.js`)
- **Title Changed**: "My Prescriptions" → "Active Prescriptions"
- **Added Help Text**: "Past prescriptions can be found in your medical history."
- **Empty State Updated**: "No Active Prescriptions" with link to medical history

### 2. Treatment Plans Page (`frontend/src/Components/Profile/ProfileTreatments.js`)
- **Title Changed**: "My Treatment Plans" → "Active Treatment Plans"
- **Added Help Text**: "Completed treatments can be found in your medical history."
- **Empty State Updated**: "No Active Treatment Plans" with link to medical history

### 3. Medical History Page
- **No Changes Needed**: Already fetches all records (active and inactive) by default
- Shows complete medical history including:
  - All prescriptions (active and inactive)
  - All treatment plans (all statuses)
  - All appointments (all statuses)

## User Experience Flow

1. **Prescriptions Page** → Shows only current/active prescriptions
2. **Treatment Plans Page** → Shows only active/ongoing treatments
3. **Medical History Page** → Shows complete history of everything

## Benefits

✅ **Cleaner UI**: Users see only relevant active items in their profile sections
✅ **Better Organization**: Past records don't clutter the active prescriptions/treatments view
✅ **Complete History Available**: All records are still accessible via Medical History
✅ **Intuitive Navigation**: Clear links guide users to where they can find past records

