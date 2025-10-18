# Test Credentials for Manager Dashboard

## Login Information
- **Email**: manager@test.com
- **Password**: password123
- **Role**: Manager

## API Test Token
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM2ZTRmNWQwODQ2ZWY2MmMyOGYyZiIsIl9pZCI6IjY4ZjM2ZTRmNWQwODQ2ZWY2MmMyOGYyZiIsImVtYWlsIjoibWFuYWdlckB0ZXN0LmNvbSIsInJvbGUiOiJNYW5hZ2VyIiwiaWF0IjoxNzYwNzgzOTUxLCJleHAiOjE3NjA4NzAzNTF9.ZWLMSh5jKBt05G9O8F_9Uc159maCBYbPWagqgbsFLHk
```

## Real Data Available
The manager dashboard now displays real data from MongoDB:

### Dashboard Stats
- **Total Appointments**: 19
- **Pending Appointments**: 7
- **Completed Appointments**: 0
- **Total Patients**: 5
- **Total Dentists**: 6
- **Active Dentists**: 0
- **Low Stock Items**: 0
- **Average Rating**: 3.5
- **Total Revenue**: 0

### Recent Activity
- Real appointment data from the last 24 hours
- Inventory requests
- Patient feedback
- All with proper timestamps and status indicators

## How to Test
1. Start the backend server: `npm start` (in BACKEND directory)
2. Start the frontend server: `npm start` (in Frontend directory)
3. Navigate to the login page
4. Use the credentials above to log in
5. Access the Manager Dashboard to see real data

## Sample Data Created
- 3 sample patients (John Doe, Sarah Wilson, Dr. Johnson)
- 2 sample dentists (Dr. Smith, Dr. Brown)
- 3 sample appointments (confirmed, pending, completed)
- 2 sample feedback entries
- 3 sample inventory items
- 1 sample inventory request

All data is stored in the MongoDB database and will persist between server restarts.
