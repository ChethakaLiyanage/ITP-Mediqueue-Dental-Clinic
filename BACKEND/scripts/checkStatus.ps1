# System Status Check Script
Write-Host "🔍 Checking system status..." -ForegroundColor Cyan
Write-Host ""

$API_BASE = "http://localhost:5000"
$TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM2ZTRmNWQwODQ2ZWY2MmMyOGYyZiIsIl9pZCI6IjY4ZjM2ZTRmNWQwODQ2ZWY2MmMyOGYyZiIsImVtYWlsIjoibWFuYWdlckB0ZXN0LmNvbSIsInJvbGUiOiJNYW5hZ2VyIiwiaWF0IjoxNzYwNzgzOTUxLCJleHAiOjE3NjA4NzAzNTF9.ZWLMSh5jKBt05G9O8F_9Uc159maCBYbPWagqgbsFLHk"

try {
    # Test basic connectivity
    Write-Host "1. Testing basic connectivity..." -ForegroundColor Yellow
    $testResponse = Invoke-WebRequest -Uri "$API_BASE/api/manager/reports/test" -Method GET -ErrorAction Stop
    if ($testResponse.StatusCode -eq 200) {
        Write-Host "✅ Backend server is running on port 5000" -ForegroundColor Green
    }

    # Test dashboard stats
    Write-Host "`n2. Testing dashboard stats endpoint..." -ForegroundColor Yellow
    $statsResponse = Invoke-WebRequest -Uri "$API_BASE/api/manager/reports/dashboard-stats" -Method GET -Headers @{"Authorization"="Bearer $TEST_TOKEN"} -ErrorAction Stop
    
    if ($statsResponse.StatusCode -eq 200) {
        $stats = $statsResponse.Content | ConvertFrom-Json
        Write-Host "✅ Dashboard stats endpoint working" -ForegroundColor Green
        Write-Host "   📊 Real data from MongoDB:" -ForegroundColor Cyan
        Write-Host "   - Total Appointments: $($stats.totalAppointments)" -ForegroundColor White
        Write-Host "   - Pending Appointments: $($stats.pendingAppointments)" -ForegroundColor White
        Write-Host "   - Total Patients: $($stats.totalPatients)" -ForegroundColor White
        Write-Host "   - Total Dentists: $($stats.totalDentists)" -ForegroundColor White
        Write-Host "   - Average Rating: $($stats.avgRating)" -ForegroundColor White
    }

    # Test recent activity
    Write-Host "`n3. Testing recent activity endpoint..." -ForegroundColor Yellow
    $activityResponse = Invoke-WebRequest -Uri "$API_BASE/api/manager/reports/recent-activity" -Method GET -Headers @{"Authorization"="Bearer $TEST_TOKEN"} -ErrorAction Stop
    
    if ($activityResponse.StatusCode -eq 200) {
        $activity = $activityResponse.Content | ConvertFrom-Json
        Write-Host "✅ Recent activity endpoint working" -ForegroundColor Green
        Write-Host "   📈 Found $($activity.activities.Count) recent activities" -ForegroundColor Cyan
        if ($activity.activities.Count -gt 0) {
            Write-Host "   Recent activities:" -ForegroundColor Cyan
            for ($i = 0; $i -lt [Math]::Min(3, $activity.activities.Count); $i++) {
                $act = $activity.activities[$i]
                Write-Host "   $($i + 1). $($act.title) - $($act.description)" -ForegroundColor White
            }
        }
    }

    Write-Host "`n🎉 System Status Summary:" -ForegroundColor Green
    Write-Host "✅ Backend server: Running" -ForegroundColor Green
    Write-Host "✅ MongoDB connection: Active" -ForegroundColor Green
    Write-Host "✅ Authentication: Working" -ForegroundColor Green
    Write-Host "✅ Real data: Available" -ForegroundColor Green
    
    Write-Host "`n📝 Test Credentials:" -ForegroundColor Cyan
    Write-Host "   Email: manager@test.com" -ForegroundColor White
    Write-Host "   Password: password123" -ForegroundColor White
    
    Write-Host "`n🌐 Access URLs:" -ForegroundColor Cyan
    Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "   Backend API: http://localhost:5000" -ForegroundColor White

} catch {
    Write-Host "❌ Error checking status: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n🔧 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure backend server is running: npm start (in BACKEND directory)" -ForegroundColor White
    Write-Host "2. Make sure frontend server is running: npm start (in Frontend directory)" -ForegroundColor White
    Write-Host "3. Check if MongoDB connection is working" -ForegroundColor White
}
