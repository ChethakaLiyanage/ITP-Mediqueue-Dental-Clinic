# "Book for Someone Else" Feature Implementation

## Overview

This feature allows logged-in patients to book appointments for other people (family members, friends, etc.). The system tracks both the booker (who made the booking) and the person the appointment is for.

## Implementation Details

### 1. Backend Changes

#### AppointmentModel Schema Updates (`BACKEND/Model/AppointmentModel.js`)

Added new fields to support booking for someone else:

```javascript
// "Book for someone else" support
isBookingForSomeoneElse: { type: Boolean, default: false },
bookerPatientCode: { type: String, trim: true, index: true }, // The patient who made the booking
appointmentForPatientCode: { type: String, trim: true, index: true }, // The patient the appointment is for (if registered)
otherPersonDetails: {
  name: { type: String, trim: true },
  contact: { type: String, trim: true },
  age: { type: Number },
  gender: { type: String, enum: ['male', 'female', 'other', ''] },
  relation: { type: String, trim: true }, // Relation to booker (e.g., 'son', 'daughter', 'spouse')
  notes: { type: String, trim: true }
}
```

**Key Fields:**
- `isBookingForSomeoneElse`: Boolean flag to indicate this is a "book for someone else" appointment
- `bookerPatientCode`: Patient code of the logged-in user who created the booking
- `appointmentForPatientCode`: If the other person is a registered patient, their patient code is stored here
- `otherPersonDetails`: All details about the person the appointment is for

#### Validation Logic

Updated the pre-validate hook to handle the new booking type:

```javascript
if (this.isBookingForSomeoneElse) {
  // Ensure booker code is provided
  if (!this.bookerPatientCode) {
    return next(new Error("bookerPatientCode is required when booking for someone else"));
  }
  // Ensure other person's details are provided
  if (!this.otherPersonDetails || !this.otherPersonDetails.name || !this.otherPersonDetails.contact) {
    return next(new Error("Other person's name and contact are required when booking for someone else"));
  }
}
```

#### Controller Updates (`BACKEND/Controllers/AppointmentControllers.js`)

Updated the `bookAppointment` function to handle booking for someone else:

```javascript
// Handle "booking for someone else"
if (bookingForSomeoneElse && otherPersonDetails) {
  // Validate other person's details
  if (!otherPersonDetails.name?.trim()) {
    return res.status(400).json({ message: "Other person's name is required" });
  }
  if (!otherPersonDetails.contact?.trim()) {
    return res.status(400).json({ message: "Other person's contact is required" });
  }

  appointmentData.isBookingForSomeoneElse = true;
  appointmentData.bookerPatientCode = bookerPatientCode;
  appointmentData.otherPersonDetails = {
    name: otherPersonDetails.name.trim(),
    contact: otherPersonDetails.contact.trim(),
    age: otherPersonDetails.age ? parseInt(otherPersonDetails.age) : undefined,
    gender: otherPersonDetails.gender || '',
    relation: otherPersonDetails.relation?.trim() || '',
    notes: otherPersonDetails.notes?.trim() || ''
  };

  // Try to find if the other person is already a registered patient
  const existingPatient = await Patient.findOne({ 
    $or: [
      { phone: otherPersonDetails.contact.trim() },
      { email: otherPersonDetails.contact.trim() }
    ]
  }).lean();

  if (existingPatient) {
    appointmentData.appointmentForPatientCode = existingPatient.patientCode;
  }
} else {
  // Regular booking for self
  appointmentData.patient_code = bookerPatientCode;
}
```

### 2. Frontend Changes

#### State Management (`frontend/src/Components/Appointments/BookAppointment.js`)

Added new state variables:

```javascript
// "Book for someone else" state
const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false);
const [otherPersonDetails, setOtherPersonDetails] = useState({
  name: "",
  contact: "",
  age: "",
  gender: "",
  relation: "",
  notes: ""
});
const [otherPersonErrors, setOtherPersonErrors] = useState({});
```

#### UI Components

**Checkbox to Enable Feature:**
```jsx
{bookingType === "registered" && (
  <div style={{ marginBottom: '1.5rem' }}>
    <label style={{ /* styling */ }}>
      <input
        type="checkbox"
        checked={bookingForSomeoneElse}
        onChange={(e) => {
          setBookingForSomeoneElse(e.target.checked);
          if (!e.target.checked) {
            setOtherPersonDetails({ name: "", contact: "", age: "", gender: "", relation: "", notes: "" });
            setOtherPersonErrors({});
          }
        }}
      />
      <span>📅 Book this appointment for someone else</span>
    </label>
  </div>
)}
```

**Conditional Form for Other Person's Details:**
- Full Name * (required)
- Contact (Phone/Email) * (required)
- Age (optional)
- Gender (optional)
- Relation to You (optional)
- Additional Notes (optional)

#### Validation

Added validation before sending OTP:

```javascript
// Validate "other person details" if booking for someone else
if (bookingForSomeoneElse) {
  const errors = {};
  if (!otherPersonDetails.name?.trim()) errors.name = "Name is required";
  if (!otherPersonDetails.contact?.trim()) errors.contact = "Contact is required";
  
  if (Object.keys(errors).length > 0) {
    setOtherPersonErrors(errors);
    setOtpError("Please fill in all required fields for the other person.");
    return;
  }
}
```

#### API Integration

Updated OTP send and verify functions to include the new data:

```javascript
const body = {
  // ... existing fields
  bookingForSomeoneElse,
  otherPersonDetails: bookingForSomeoneElse ? otherPersonDetails : undefined
};
```

## Data Flow

### Regular Appointment (For Self)
```
User logs in → Selects slot → Fills reason → Gets OTP → Confirms
↓
Appointment created with: patient_code = bookerPatientCode
```

### "Book for Someone Else" Appointment
```
User logs in → Selects slot → Fills reason → Checks "Book for someone else"
→ Fills other person's details → Gets OTP → Confirms
↓
Appointment created with:
  - isBookingForSomeoneElse = true
  - bookerPatientCode = logged-in user's patient code
  - otherPersonDetails = { name, contact, age, gender, relation, notes }
  - appointmentForPatientCode = (if other person is registered patient)
```

## Dentist View Requirements

When a dentist views this appointment in their queue or creates treatment notes/prescriptions, they should see:

### Display Format
```
Patient: [Other Person's Name] ([Other Person's Contact])
Age: [Age if provided]
Gender: [Gender if provided]
Relation: [Relation to booker]

Booked by: [Booker's Name] ([Booker's Patient Code])
Additional Notes: [Notes if provided]
```

### For Treatment Plans & Prescriptions

When creating treatment plans or prescriptions, the system should:
1. **Show the other person's details prominently** (they are the actual patient)
2. **Also display the booker's info** for reference/auditing
3. **Use appointment ID** for linking

Example display:
```
═══════════════════════════════════════
TREATMENT PLAN / PRESCRIPTION FOR
═══════════════════════════════════════
Patient Name: John Doe (Son)
Contact: 1234567890
Age: 25 | Gender: Male

Booked By: Jane Doe (P-001)
Appointment: AP-0123
═══════════════════════════════════════
```

## Next Steps (Remaining Implementation)

### 5. Update Dentist Queue View
**File:** `frontend/src/Components/Dashboard/DashboardMetrics.js`

Add logic to display:
- If `isBookingForSomeoneElse`: Show `otherPersonDetails.name` as patient name
- Add a small badge/indicator showing "Booked by: [bookerPatientCode]"
- Show relation if available

### 6. Update Treatment Plan Creation
**File:** `frontend/src/Components/TreatmentPlans/DentistTreatmentPlansList.js`

When creating treatment plans:
- Check if appointment has `isBookingForSomeoneElse = true`
- If yes, display other person's details prominently
- Show booker info for reference
- Use appointment code for linking

### 7. Update Prescription Creation
**File:** `frontend/src/Components/Prescriptions/DentistPrescriptionsPage.js`

Similar to treatment plans:
- Display other person's details as the primary patient
- Show booker info for auditing
- Link via appointment code

## Testing Checklist

- [ ] Patient can check "Book for someone else" checkbox
- [ ] Form fields appear when checkbox is checked
- [ ] Validation works for required fields (name, contact)
- [ ] OTP can be sent with other person's details
- [ ] Appointment is created with correct data structure
- [ ] Backend stores all fields correctly in database
- [ ] Dentist can see appointment in queue
- [ ] Dentist sees both booker and other person's details
- [ ] Treatment plan creation shows correct patient info
- [ ] Prescription creation shows correct patient info
- [ ] Booker info is retained for auditing

## Database Query Examples

### Find all appointments booked by a specific patient (as booker)
```javascript
db.appointmentmodels.find({ bookerPatientCode: "P-001" })
```

### Find all appointments where someone booked for others
```javascript
db.appointmentmodels.find({ isBookingForSomeoneElse: true })
```

### Find appointments for a specific person (by contact)
```javascript
db.appointmentmodels.find({ "otherPersonDetails.contact": "1234567890" })
```

## Security & Privacy Considerations

1. **Data Privacy:** Other person's details are stored with the appointment, not as a full patient record (unless they're already registered)
2. **Auditing:** Booker's patient code is always stored for accountability
3. **Access Control:** Only the dentist and authorized staff should see these details
4. **Consent:** The booker is responsible for obtaining consent from the other person

## Future Enhancements

1. **Auto-registration:** Offer to create a patient account for the other person after their first visit
2. **Notification:** Send appointment reminders to both booker and other person's contact
3. **History:** Show booking history for both booker and the people they booked for
4. **Multiple appointments:** Allow booking multiple slots at once for family members
5. **Recurring bookings:** Support recurring appointments for the same person

