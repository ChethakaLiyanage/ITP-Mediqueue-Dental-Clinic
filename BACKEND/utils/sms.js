function defaultNormalizePhone(value) {
  if (!value) return "";
  const digits = String(value).replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+94${digits.slice(1)}`;
  return digits;
}

async function defaultSendSms({ to, body }) {
  if (!to) throw new Error("SMS recipient (to) is required");
  if (!body) throw new Error("SMS body is required");
  
  // Try to send via Twilio if configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    try {
      const twilio = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      const message = await twilio.messages.create({
        body: body,
        from: process.env.TWILIO_FROM_NUMBER,
        to: to
      });
      
      console.log(`[SMS] Sent via Twilio to ${to}: ${message.sid}`);
      return { to, body, sid: message.sid, provider: 'twilio' };
    } catch (error) {
      console.error(`[SMS] Twilio error for ${to}:`, error.message);
      // Fall back to console logging
    }
  }
  
  // Fallback: log to console
  console.info(`[SMS] -> ${to}: ${body}`);
  return { to, body, provider: 'console' };
}

function ensureSmsHelpers() {
  return {
    sendSms: defaultSendSms,
    normalizePhone: defaultNormalizePhone,
  };
}

module.exports = {
  ensureSmsHelpers,
  sendSms: defaultSendSms,
  normalizePhone: defaultNormalizePhone,
};
