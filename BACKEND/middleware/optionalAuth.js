// backend/Middleware/optionalAuth.js
const jwt = require("jsonwebtoken");
const User = require("../Model/User");
const ReceptionistModel = require("../Model/ReceptionistModel");
const DentistModel = require("../Model/DentistModel");
const ManagerModel = require("../Model/ManagerModel");

module.exports = async function optionalAuth(req, res, next) {
  const h =
    req.headers.authorization ||
    req.headers.Authorization ||
    req.headers["x-auth-token"] ||
    req.headers.token ||
    "";
  let token = String(h || "").trim();
  if (token.toLowerCase().startsWith("bearer ")) token = token.slice(7).trim();
  if (token.startsWith('"') && token.endsWith('"')) token = token.slice(1, -1);
  
  // If no token, just continue without authentication
  if (!token) {
    console.log('No token provided, proceeding as unauthenticated user');
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET || "dev-secret";
    const p = jwt.verify(token, secret);

    // Validate user in DB
    const user = await User.findById(p.id || p._id);
    if (!user || user.isActive === false) {
      console.log('Invalid or inactive user, proceeding as unauthenticated');
      return next();
    }

    // Attach base user info
    req.user = {
      id: user._id,
      _id: user._id,
      role: user.role,
      email: user.email,
      name: user.name,
    };
    
    console.log('Base user info attached:', req.user);

    // If receptionist, attach receptionistCode
    if (user.role === "Receptionist") {
      let rec = await ReceptionistModel.findOne({ userId: user._id }).select(
        "receptionistCode"
      );
      if (rec) {
        req.user.receptionistCode = rec.receptionistCode;
        console.log('Receptionist code attached:', rec.receptionistCode);
      } else {
        console.log('No receptionist record found for user:', user._id, 'Creating one...');
        try {
          rec = await ReceptionistModel.create({ userId: user._id });
          req.user.receptionistCode = rec.receptionistCode;
          console.log('New receptionist record created with code:', rec.receptionistCode);
        } catch (err) {
          console.error('Failed to create receptionist record:', err);
        }
      }
    }

    // If dentist, attach dentistCode
    if (user.role === "Dentist") {
      const dentist = await DentistModel.findOne({ userId: user._id }).select(
        "dentistCode"
      );
      if (dentist) {
        req.user.dentistCode = dentist.dentistCode;
      }
    }

    // If patient, attach patientCode
    if (user.role === "Patient") {
      const PatientModel = require("../Model/PatientModel");
      try {
        const patient = await PatientModel.findOne({ userId: user._id }).select(
          "patientCode"
        );
        if (patient) {
          req.user.patientCode = patient.patientCode;
          console.log('Patient code attached:', patient.patientCode);
        } else {
          console.log('No patient record found for user:', user._id);
        }
      } catch (error) {
        console.error('Error fetching patient record:', error);
      }
    }

    // If manager, attach managerCode
    if (user.role === "Manager") {
      const manager = await ManagerModel.findOne({ userId: user._id }).select(
        "managerCode"
      );
      if (manager) {
        req.user.managerCode = manager.managerCode;
        console.log('Manager code attached:', manager.managerCode);
      }
    }

    console.log('Final req.user object:', req.user);
    next();
  } catch (e) {
    console.error("optionalAuth error:", e.message);
    // Don't fail the request, just proceed as unauthenticated
    console.log('Token verification failed, proceeding as unauthenticated user');
    next();
  }
};