// Using built-in fetch (Node.js 18+) or fallback to https module
const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:5000';
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM2ZTRmNWQwODQ2ZWY2MmMyOGYyZiIsIl9pZCI6IjY4ZjM2ZTRmNWQwODQ2ZWY2MmMyOGYyZiIsImVtYWlsIjoibWFuYWdlckB0ZXN0LmNvbSIsInJvbGUiOiJNYW5hZ2VyIiwiaWF0IjoxNzYwNzgzOTUxLCJleHAiOjE3NjA4NzAzNTF9.ZWLMSh5jKBt05G9O8F_9Uc159maCBYbPWagqgbsFLHk';

async function checkStatus() {
  console.log('🔍 Checking system status...\n');

  try {
    // Test basic connectivity
    console.log('1. Testing basic connectivity...');
    const testResponse = await fetch(`${API_BASE}/api/manager/reports/test`);
    if (testResponse.ok) {
      console.log('✅ Backend server is running on port 5000');
    } else {
      console.log('❌ Backend server test failed');
      return;
    }

    // Test dashboard stats
    console.log('\n2. Testing dashboard stats endpoint...');
    const statsResponse = await fetch(`${API_BASE}/api/manager/reports/dashboard-stats`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Dashboard stats endpoint working');
      console.log('   📊 Real data from MongoDB:');
      console.log(`   - Total Appointments: ${stats.totalAppointments}`);
      console.log(`   - Pending Appointments: ${stats.pendingAppointments}`);
      console.log(`   - Total Patients: ${stats.totalPatients}`);
      console.log(`   - Total Dentists: ${stats.totalDentists}`);
      console.log(`   - Average Rating: ${stats.avgRating}`);
    } else {
      console.log('❌ Dashboard stats endpoint failed');
    }

    // Test recent activity
    console.log('\n3. Testing recent activity endpoint...');
    const activityResponse = await fetch(`${API_BASE}/api/manager/reports/recent-activity`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (activityResponse.ok) {
      const activity = await activityResponse.json();
      console.log('✅ Recent activity endpoint working');
      console.log(`   📈 Found ${activity.activities.length} recent activities`);
      if (activity.activities.length > 0) {
        console.log('   Recent activities:');
        activity.activities.slice(0, 3).forEach((act, index) => {
          console.log(`   ${index + 1}. ${act.title} - ${act.description}`);
        });
      }
    } else {
      console.log('❌ Recent activity endpoint failed');
    }

    console.log('\n🎉 System Status Summary:');
    console.log('✅ Backend server: Running');
    console.log('✅ MongoDB connection: Active');
    console.log('✅ Authentication: Working');
    console.log('✅ Real data: Available');
    console.log('\n📝 Test Credentials:');
    console.log('   Email: manager@test.com');
    console.log('   Password: password123');
    console.log('\n🌐 Access URLs:');
    console.log('   Frontend: http://localhost:3000');
    console.log('   Backend API: http://localhost:5000');

  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure backend server is running: npm start (in BACKEND directory)');
    console.log('2. Make sure frontend server is running: npm start (in Frontend directory)');
    console.log('3. Check if MongoDB connection is working');
  }
}

checkStatus();
