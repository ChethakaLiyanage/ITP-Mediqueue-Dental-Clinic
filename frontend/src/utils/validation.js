// Validation utilities for consistent validation across the app

// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    isValid: emailRegex.test(email),
    message: emailRegex.test(email) ? '' : 'Enter a valid email address'
  };
};

// Phone number validation (Sri Lankan format)
export const validatePhone = (phone) => {
  if (!phone || phone.trim() === '') {
    return { isValid: true, message: '' }; // Optional field
  }
  
  // Remove all non-digits
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Sri Lankan phone number patterns
  const patterns = [
    /^0[0-9]{9}$/, // 0XXXXXXXXX (10 digits starting with 0)
    /^\+94[0-9]{9}$/, // +94XXXXXXXXX (international format)
    /^94[0-9]{9}$/, // 94XXXXXXXXX (without +)
  ];
  
  const isValid = patterns.some(pattern => pattern.test(cleanPhone));
  
  return {
    isValid,
    message: isValid ? '' : 'Enter a valid Sri Lankan phone number (0XXXXXXXXX or +94XXXXXXXXX)'
  };
};

// NIC validation (Sri Lankan)
export const validateNIC = (nic) => {
  const nicRegex = /^(\d{9}[VvXx]|\d{12})$/;
  return {
    isValid: nicRegex.test(nic),
    message: nicRegex.test(nic) ? '' : 'Enter a valid NIC number (9 digits + V/X or 12 digits)'
  };
};

// Password validation
export const validatePassword = (password) => {
  const minLength = 6;
  const hasMinLength = password.length >= minLength;
  
  return {
    isValid: hasMinLength,
    message: hasMinLength ? '' : `Password must be at least ${minLength} characters long`
  };
};

// Name validation
export const validateName = (name) => {
  const trimmed = name.trim();
  const isValid = trimmed.length >= 2 && /^[a-zA-Z\s]+$/.test(trimmed);
  
  return {
    isValid,
    message: isValid ? '' : 'Name must be at least 2 characters and contain only letters and spaces'
  };
};

// Address validation
export const validateAddress = (address) => {
  const trimmed = address.trim();
  const isValid = trimmed.length >= 5;
  
  return {
    isValid,
    message: isValid ? '' : 'Address must be at least 5 characters long'
  };
};

// Date of birth validation
export const validateDOB = (dob) => {
  if (!dob) {
    return { isValid: false, message: 'Date of birth is required' };
  }
  
  const dobDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - dobDate.getFullYear();
  
  if (isNaN(dobDate.getTime())) {
    return { isValid: false, message: 'Enter a valid date' };
  }
  
  if (dobDate > today) {
    return { isValid: false, message: 'Date of birth cannot be in the future' };
  }
  
  if (age < 0 || age > 120) {
    return { isValid: false, message: 'Please enter a valid age' };
  }
  
  return { isValid: true, message: '' };
};

// OTP validation
export const validateOTP = (otp) => {
  const otpRegex = /^\d{6}$/;
  return {
    isValid: otpRegex.test(otp),
    message: otpRegex.test(otp) ? '' : 'OTP must be exactly 6 digits'
  };
};

// General form validation
export const validateForm = (formData, rules) => {
  const errors = {};
  let isValid = true;
  
  Object.keys(rules).forEach(field => {
    const rule = rules[field];
    const value = formData[field];
    
    if (rule.required && (!value || value.trim() === '')) {
      errors[field] = rule.message || `${field} is required`;
      isValid = false;
    } else if (value && rule.validator) {
      const validation = rule.validator(value);
      if (!validation.isValid) {
        errors[field] = validation.message;
        isValid = false;
      }
    }
  });
  
  return { isValid, errors };
};

// Format phone number for display
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Format as 0XX XXX XXXX
  if (cleanPhone.length === 10 && cleanPhone.startsWith('0')) {
    return `${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3, 6)} ${cleanPhone.slice(6)}`;
  }
  
  // Format as +94 XX XXX XXXX
  if (cleanPhone.length === 12 && cleanPhone.startsWith('94')) {
    return `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2, 4)} ${cleanPhone.slice(4, 7)} ${cleanPhone.slice(7)}`;
  }
  
  return phone; // Return original if doesn't match expected format
};
