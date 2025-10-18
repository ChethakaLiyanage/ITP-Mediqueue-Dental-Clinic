const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import models
const User = require('../Model/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  dbName: "Mediqueue_dental_clinic",
})
.then(() => {
  console.log("Connected to MongoDB for creating test user");
  deleteAndCreateTestUser();
})
.catch((err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

async function deleteAndCreateTestUser() {
  try {
    console.log('Deleting existing test user...');
    
    // Delete existing test user
    await User.deleteOne({ email: 'manager@test.com' });
    console.log('Existing test user deleted');

    // Create new test manager
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const testManager = new User({
      name: 'Test Manager',
      email: 'manager@test.com',
      password: hashedPassword,
      role: 'Manager',
      contact_no: '0771234567',
      isActive: true
    });

    await testManager.save();
    console.log('New test manager user created successfully');

    // Generate a test token with correct format
    const token = jwt.sign(
      { 
        id: testManager._id, 
        _id: testManager._id,
        email: testManager.email, 
        role: 'Manager' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Test JWT Token:', token);
    console.log('You can use this token to test the API endpoints');
    console.log('Login credentials:');
    console.log('Email: manager@test.com');
    console.log('Password: password123');
    
    process.exit(0);

  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}
