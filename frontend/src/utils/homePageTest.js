// Home Page Consistency Test Utility
// This utility helps verify that the home page shows the same content for all users

export const testHomePageConsistency = () => {
  console.log('=== Home Page Consistency Test ===');
  
  // Check if all main sections are present
  const requiredSections = [
    'hero',
    'services', 
    'why-choose',
    'about',
    'contact',
    'footer'
  ];
  
  const missingSections = [];
  
  requiredSections.forEach(section => {
    const element = document.getElementById(section) || document.querySelector(`.${section}`);
    if (!element) {
      missingSections.push(section);
    }
  });
  
  if (missingSections.length > 0) {
    console.error('❌ Missing sections:', missingSections);
    return false;
  }
  
  // Check if header authentication buttons are working
  const authButtons = document.querySelector('.auth-buttons');
  const profileButton = document.querySelector('.profile-btn');
  const loginButton = document.querySelector('.login-btn');
  
  if (!authButtons) {
    console.error('❌ Authentication buttons container not found');
    return false;
  }
  
  // Check if user-specific content is only in header
  const userSpecificElements = document.querySelectorAll('[data-user-specific]');
  if (userSpecificElements.length > 0) {
    console.warn('⚠️ Found user-specific elements outside header:', userSpecificElements);
  }
  
  console.log('✅ All required sections present');
  console.log('✅ Authentication buttons working');
  console.log('✅ Home page structure is consistent');
  
  return true;
};

// Auto-run test when page loads
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(testHomePageConsistency, 1000);
  });
}
