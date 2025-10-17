// Test script for PDF generation
const fs = require('fs');
const path = require('path');

// Import our notification service
const Notify = require('../Services/NotificationService');

async function testPdfGeneration() {
  console.log('🧪 Testing PDF Generation...\n');

  try {
    // Test data for registered patient
    const registeredPatientData = {
      patientType: 'registered',
      patientCode: 'P-0001',
      patientName: 'John Doe',
      dentistCode: 'D-001',
      appointmentCode: 'AP-0001',
      date: '2025-01-15',
      time: '09:00',
      reason: 'Regular checkup',
      phone: '+94771234567',
      email: 'john.doe@email.com',
      nic: '199012345678',
      passport: 'N1234567'
    };

    // Test data for unregistered patient
    const unregisteredPatientData = {
      patientType: 'unregistered',
      patientCode: 'GUEST-001',
      patientName: 'Jane Smith',
      dentistCode: 'D-002',
      appointmentCode: 'AP-0002',
      date: '2025-01-16',
      time: '14:30',
      reason: 'Emergency visit',
      phone: '+94776543210',
      email: 'jane.smith@email.com'
      // No NIC or Passport for unregistered
    };

    console.log('📄 Generating PDF for registered patient...');
    const registeredPdf = await Notify.buildAppointmentPdf(registeredPatientData);
    
    console.log('📄 Generating PDF for unregistered patient...');
    const unregisteredPdf = await Notify.buildAppointmentPdf(unregisteredPatientData);

    // Save PDFs to test directory
    const testDir = path.join(__dirname, '../test-pdfs');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const registeredPdfPath = path.join(testDir, 'registered-patient-test.pdf');
    const unregisteredPdfPath = path.join(testDir, 'unregistered-patient-test.pdf');

    fs.writeFileSync(registeredPdfPath, registeredPdf);
    fs.writeFileSync(unregisteredPdfPath, unregisteredPdf);

    console.log('\n✅ PDF Generation Test Results:');
    console.log(`📁 Registered Patient PDF: ${registeredPdfPath}`);
    console.log(`📁 Unregistered Patient PDF: ${unregisteredPdfPath}`);
    console.log(`📊 Registered PDF Size: ${registeredPdf.length} bytes`);
    console.log(`📊 Unregistered PDF Size: ${unregisteredPdf.length} bytes`);

    console.log('\n🎉 PDF generation test completed successfully!');
    console.log('📝 Check the generated PDFs in the test-pdfs directory');

  } catch (error) {
    console.error('❌ PDF generation test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testPdfGeneration();
}

module.exports = { testPdfGeneration };
