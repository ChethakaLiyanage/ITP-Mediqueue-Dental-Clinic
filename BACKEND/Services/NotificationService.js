const NotificationLog = require('../Model/NotificationLogModel');
const Patient = require('../Model/PatientModel');
const UnregisteredPatient = require('../Model/UnregisteredPatientModel');
const Dentist = require('../Model/DentistModel');
const nodemailer = require('nodemailer');
const MediaStore = require('../utils/MediaStore'); // <-- added

let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
} catch (err) {
  console.warn('[Notify][pdfkit-missing]', err?.message || err);
}

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

/* ---- added helpers ---- */
function toE164(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  s = s.replace(/[^\d+]/g, '');          // strip spaces/dashes/etc
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) return s;

  const cc = process.env.DEFAULT_COUNTRY_E164_PREFIX; // e.g. "+94"
  if (cc && s.startsWith('0')) return cc + s.slice(1);
  if (cc && !s.startsWith(cc.replace('+',''))) return cc + s;

  return '+' + s;
}
function absoluteUrl(pathname) {
  const base = process.env.TWILIO_PUBLIC_BASE_URL || 'http://localhost:5000';
  return `${base.replace(/\/+$/, '')}${pathname}`;
}
/* ----------------------- */

async function getPatientContact(patientCode) {
  if (!patientCode) return null;

  const p = await Patient.findOne({ patientCode })
    .populate({ path: 'userId', select: 'name email contact_no' })
    .lean();
  if (p) {
    return {
      name: p.userId?.name || 'Patient',
      email: p.userId?.email || null,
      phone: p.userId?.contact_no || null,
    };
  }

  const up = await UnregisteredPatient.findOne({ unregisteredPatientCode: patientCode }).lean();
  if (up) {
    return {
      name: up.name || 'Patient',
      email: up.email || null,
      phone: up.phone || null,
    };
  }

  return null;
}
async function getDentistName(dentistCode) {
  const d = await Dentist.findOne({ dentistCode })
    .populate({ path: 'userId', select: 'name' })
    .lean();
  return d?.userId?.name || dentistCode;
}

async function buildMessage(templateKey, meta = {}) {
  const {
    appointmentCode,
    dentistCode,
    date,
    time,
    patientType,
    patientName,
    createdByCode,
    acceptedByCode,
    canceledByCode,
    receptionistCode,
    name,
    email,
    password,
    loginEmail,
    tempPassword,
    reason,
    appointments = [],
  } = meta || {};

  const dentistName = dentistCode ? await getDentistName(dentistCode) : '';
  const dentistLabel = dentistName
    ? dentistCode
      ? `${dentistName} (${dentistCode})`
      : dentistName
    : dentistCode || '';
  const appointmentLabel = appointmentCode ? ` (${appointmentCode})` : '';
  const greetingName = patientName || name || null;

  switch (templateKey) {
    case 'APPT_CONFIRMED': {
      const subjectParts = ['Appointment Confirmed'];
      if (appointmentCode) subjectParts.push(`#${appointmentCode}`);
      if (date) subjectParts.push(date);
      if (time) subjectParts.push(time);
      const lines = [
        `Hi${greetingName ? ` ${greetingName}` : ''},`,
        '',
        `Your appointment${appointmentLabel} is CONFIRMED.`,
        dentistLabel ? `Dentist: ${dentistLabel}` : '',
        date ? `Date: ${date}` : '',
        time ? `Time: ${time}` : '',
        patientType ? `Patient type: ${patientType}` : '',
        createdByCode ? `Booked by receptionist: ${createdByCode}` : receptionistCode ? `Booked by receptionist: ${receptionistCode}` : '',
        acceptedByCode ? `Confirmed by receptionist: ${acceptedByCode}` : '',
        '',
        'Thank you.',
      ].filter(Boolean);
      const subject = subjectParts.filter(Boolean).join(' - ');
      return { subject: subject || 'Appointment Confirmed', body: lines.join('\n') };
    }
    case 'APPT_CANCELED': {
      const subjectParts = ['Appointment Cancelled'];
      if (appointmentCode) subjectParts.push(`#${appointmentCode}`);
      const lines = [
        `Hi${greetingName ? ` ${greetingName}` : ''},`,
        '',
        `Your appointment${appointmentLabel} has been CANCELLED.`,
        dentistLabel ? `Dentist: ${dentistLabel}` : '',
        date ? `Date: ${date}` : '',
        time ? `Time: ${time}` : '',
        reason ? `Reason: ${reason}` : '',
        canceledByCode ? `Cancelled by receptionist: ${canceledByCode}` : '',
        '',
        'If this was unexpected, please contact reception.',
      ].filter(Boolean);
      const subject = subjectParts.filter(Boolean).join(' - ');
      return { subject: subject || 'Appointment Cancelled', body: lines.join('\n') };
    }
    case 'APPT_REMINDER_24H': {
      const subject = 'Reminder: Appointment in 24 hours';
      const lines = [
        `Hi${greetingName ? ` ${greetingName}` : ''},`,
        '',
        'This is a friendly reminder for your appointment in around 24 hours.',
        dentistLabel ? `Dentist: ${dentistLabel}` : '',
        date ? `Date: ${date}` : '',
        time ? `Time: ${time}` : '',
        appointmentCode ? `Reference: ${appointmentCode}` : '',
        '',
        'See you soon!',
      ].filter(Boolean);
      return { subject, body: lines.join('\n') };
    }
    case 'PATIENT_ACCOUNT_CREATED': {
      const subject = 'Your DentalCare Pro account is ready';
      const lines = [
        `Hi ${greetingName || 'there'},`,
        '',
        'We created your DentalCare Pro account so you can manage appointments online.',
        (email || loginEmail) ? `Login email: ${email || loginEmail}` : '',
        (password || tempPassword) ? `Temporary password: ${password || tempPassword}` : '',
        receptionistCode ? `Account created by receptionist: ${receptionistCode}` : '',
        '',
        'You can change this password after signing in.',
        '',
        'Thank you.',
      ].filter(Boolean);
      return { subject, body: lines.join('\n') };
    }
    case 'DENTIST_DAILY_RUN': {
      const subject = `Today's Schedule Rundown`;
      const apptLines = (appointments || []).map((a, idx) => {
        const slot = a.time || a.appointmentTime || a.date || '';
        const patient = a.patientName || a.patientCode || a.patient || '-';
        const ref = a.appointmentCode ? ` (${a.appointmentCode})` : '';
        return `${idx + 1}. ${slot} - ${patient}${ref}`;
      });
      const lines = [
        'Good morning,',
        '',
        `Here is your schedule for ${date || 'today'}:`,
        '',
        ...(apptLines.length ? apptLines : ['No appointments booked.']),
        '',
        'Have a great day!',
      ];
      return { subject, body: lines.join('\n') };
    }
    default: {
      return { subject: templateKey, body: JSON.stringify(meta, null, 2) };
    }
  }
}

function getMailTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: !!(process.env.SMTP_SECURE === 'true'),
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}

async function sendEmail(to, subject, text, attachments = []) {
  const transporter = getMailTransport();
  if (!transporter) {
    console.log('[Notify][email:dryrun]', to, subject, text, attachments.length ? `${attachments.length} attachment(s)` : '');
    return { id: 'dryrun-email' };
  }
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@clinic.local',
    to,
    subject,
    text,
    attachments,
  });
  return { id: info.messageId };
}

/* replaced to normalize to E.164 */
async function sendWhatsApp(toE164Raw, text) {
  if (!twilioClient || !process.env.TWILIO_WHATSAPP_FROM) {
    console.log('[Notify][wa:dryrun]', toE164Raw, text);
    return { sid: 'dryrun-wa' };
  }
  const to = toE164(toE164Raw);
  const msg = await twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to:   `whatsapp:${to}`,
    body: text,
  });
  return { sid: msg.sid };
}

async function logAndSend({ recipientType, recipientCode, templateKey, channel = 'auto', scheduledFor = null, meta = {}, emailAttachments = [] }) {
  const log = await NotificationLog.create({
    recipientType,
    recipientCode,
    templateKey,
    channel: channel === 'auto' ? 'auto' : channel,
    scheduledFor,
    status: scheduledFor ? 'queued' : 'sent',
    sentAt: scheduledFor ? null : new Date(),
    meta,
  });

  if (scheduledFor) return log;

  try {
    const { subject, body } = await buildMessage(templateKey, meta);

    let chosen = 'console';
    let contact = null;
    if (recipientType === 'Patient') {
      contact = await getPatientContact(recipientCode);
      if (!contact) throw new Error('Patient not found for notification');
    }

    if (channel === 'whatsapp' && contact?.phone) {
      await sendWhatsApp(contact.phone, body);
      chosen = 'whatsapp';
    } else if (channel === 'email' && contact?.email) {
      await sendEmail(contact.email, subject, body, emailAttachments);
      chosen = 'email';
    } else {
      if (contact?.phone && twilioClient && process.env.TWILIO_WHATSAPP_FROM) {
        await sendWhatsApp(contact.phone, body);
        chosen = 'whatsapp';
      } else if (contact?.email) {
        await sendEmail(contact.email, subject, body, emailAttachments);
        chosen = 'email';
      } else {
        console.log('[Notify][console]', recipientType, recipientCode, subject, body);
        chosen = 'console';
      }
    }

    await NotificationLog.updateOne({ _id: log._id }, { $set: { status: 'sent', sentAt: new Date(), channel: chosen } });
  } catch (err) {
    console.error('[Notify][error]', err);
    await NotificationLog.updateOne({ _id: log._id }, { $set: { status: 'failed', error: String(err) } });
  }

  return log;
}

async function sendApptConfirmed(patientCode, meta) {
  return logAndSend({ recipientType: 'Patient', recipientCode: patientCode, templateKey: 'APPT_CONFIRMED', meta });
}
async function sendApptCanceled(patientCode, meta) {
  return logAndSend({ recipientType: 'Patient', recipientCode: patientCode, templateKey: 'APPT_CANCELED', meta });
}
async function scheduleApptReminder24h(patientCode, when, meta) {
  return logAndSend({ recipientType: 'Patient', recipientCode: patientCode, templateKey: 'APPT_REMINDER_24H', scheduledFor: when, meta });
}
async function sendDentistDailyRun(dentistCode, meta) {
  return logAndSend({ recipientType: 'Dentist', recipientCode: dentistCode, templateKey: 'DENTIST_DAILY_RUN', meta });
}

async function processDueQueue() {
  const now = new Date();
  const due = await NotificationLog.find({ status: 'queued', scheduledFor: { $lte: now } }).limit(200).lean();
  for (const d of due) {
    await NotificationLog.updateOne({ _id: d._id }, { $set: { status: 'sent', sentAt: new Date() } });
    try {
      if (d.recipientType === 'Patient') {
        const { subject, body } = await buildMessage(d.templateKey, d.meta || {});
        const contact = await getPatientContact(d.recipientCode);
        let chosen = 'console';
        if (contact?.phone && twilioClient && process.env.TWILIO_WHATSAPP_FROM) {
          await sendWhatsApp(contact.phone, body); chosen = 'whatsapp';
        } else if (contact?.email) {
          await sendEmail(contact.email, subject, body); chosen = 'email';
        } else {
          console.log('[Notify][console queued]', d.recipientCode, subject, body);
          chosen = 'console';
        }
        await NotificationLog.updateOne({ _id: d._id }, { $set: { channel: chosen } });
      }
    } catch (e) {
      console.error('[Notify queued][error]', e);
      await NotificationLog.updateOne({ _id: d._id }, { $set: { status: 'failed', error: String(e) } });
    }
  }
}

function buildAccountPdf(meta = {}) {
  return new Promise((resolve, reject) => {
    if (!PDFDocument) {
      return reject(new Error('pdfkit not available'));
    }
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Account Access Details', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Patient Name: ${meta.name || meta.patientName || "Patient"}`);
    doc.text(`Patient Code: ${meta.patientCode || "-"}`);
    doc.text(`Login Email: ${meta.email || meta.loginEmail || "-"}`);
    doc.text(`Temporary Password: ${meta.password || meta.tempPassword || "-"}`);
    if (meta.receptionistCode) {
      doc.text(`Created By Receptionist: ${meta.receptionistCode}`);
    }
    doc.moveDown();
    doc.text('Please change this password after signing in.');
    doc.end();
  });
}

function buildAppointmentPdf(meta) {
  return new Promise((resolve, reject) => {
    if (!PDFDocument) {
      return reject(new Error('pdfkit not available'));
    }
    
    const doc = new PDFDocument({ 
      margin: 0,
      size: 'A4',
      info: {
        Title: 'MediCore - Appointment Confirmation',
        Author: 'MediCore Dental Clinic',
        Subject: 'Appointment Confirmation',
        Keywords: 'dental, appointment, confirmation, medicore'
      }
    });
    
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Page dimensions
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // Header with blue background
    doc.rect(0, 0, pageWidth, 120)
       .fill('#1e40af'); // Blue color matching MediCore

    // Logo area (left side of header)
    doc.circle(margin + 25, 30, 20)
       .fill('#ffffff');
    
    // Simple stethoscope/heart icon representation
    doc.circle(margin + 25, 30, 8)
       .fill('#0ea5e9'); // Teal color
    
    // MediCore text
    doc.fillColor('#ffffff')
       .fontSize(14)
       .text('MediCore', margin + 60, 25);

    // Title (center of header)
    doc.fillColor('#ffffff')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('Appointment Confirmation', pageWidth / 2, 45, { align: 'center' });

    // Contact info (right side of header)
    const currentDate = new Date().toLocaleDateString();
    doc.fillColor('#ffffff')
       .fontSize(10)
       .text(`Date: ${currentDate}`, pageWidth - margin - 100, 25)
       .text('E-mail: medicore@gmail.com', pageWidth - margin - 100, 40)
       .text('Contact: +94-64356865', pageWidth - margin - 100, 55)
       .text('Address: No: 144, Wadduwa. Panadura', pageWidth - margin - 100, 70);

    // Main content area
    let yPosition = 150;

    // Appointment details table
    const tableData = [
      { field: 'Doctor', value: meta.dentistName || meta.dentistCode || '-' },
      { field: 'Date', value: meta.date || '-' },
      { field: 'Time', value: meta.time || '-' },
      { field: 'Patient Name', value: meta.patientName || '-' },
      { field: 'Phone', value: meta.phone || '-' },
      { field: 'Email', value: meta.email || '-' }
    ];

    // Add NIC and Passport for registered patients only
    if (meta.patientType === 'registered' && meta.nic) {
      tableData.push({ field: 'NIC', value: meta.nic });
    }
    if (meta.patientType === 'registered' && meta.passport) {
      tableData.push({ field: 'Passport', value: meta.passport });
    }

    // Table header
    doc.rect(margin, yPosition, contentWidth, 30)
       .fill('#1e40af');
    
    doc.fillColor('#ffffff')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('Field', margin + 10, yPosition + 10)
       .text('Details', margin + contentWidth / 2 + 10, yPosition + 10);

    yPosition += 30;

    // Table rows
    tableData.forEach((row, index) => {
      const rowHeight = 25;
      const bgColor = index % 2 === 0 ? '#f8fafc' : '#ffffff';
      
      doc.rect(margin, yPosition, contentWidth, rowHeight)
         .fill(bgColor);
      
      doc.fillColor('#1e40af')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(row.field, margin + 10, yPosition + 8);
      
      doc.fillColor('#000000')
         .fontSize(10)
         .font('Helvetica')
         .text(row.value, margin + contentWidth / 2 + 10, yPosition + 8);
      
      yPosition += rowHeight;
    });

    // Footer message
    yPosition += 20;
    doc.fillColor('#374151')
       .fontSize(10)
       .text('Please arrive 10 minutes early for your appointment.', margin, yPosition)
       .text('Contact us if you need to reschedule or have any questions.', margin, yPosition + 15)
       .text('Thank you for choosing MediCore Dental Clinic.', margin, yPosition + 30);

    doc.end();
  });
}

async function sendPatientAccountCreated(patientCode, meta = {}) {
  const payload = { ...meta, patientCode };
  const attachments = [];

  if (PDFDocument && (payload.password || payload.tempPassword)) {
    try {
      const buffer = await buildAccountPdf(payload);
      attachments.push({
        filename: `${payload.patientCode || 'account'}-account.pdf`,
        content: buffer,
      });
    } catch (err) {
      console.error('[Notify][account-pdf:error]', err);
    }
  }

  let emailLog = null;
  try {
    emailLog = await logAndSend({
      recipientType: 'Patient',
      recipientCode: patientCode,
      templateKey: 'PATIENT_ACCOUNT_CREATED',
      channel: 'email',
      meta: payload,
      emailAttachments: attachments,
    });
  } catch (err) {
    console.error('[Notify][account-email:error]', err);
  }

  let whatsappLog = null;
  try {
    whatsappLog = await logAndSend({
      recipientType: 'Patient',
      recipientCode: patientCode,
      templateKey: 'PATIENT_ACCOUNT_CREATED',
      channel: 'whatsapp',
      meta: payload,
    });
  } catch (err) {
    console.error('[Notify][account-whatsapp:error]', err);
  }

  return { emailLog, whatsappLog };
}

async function sendAppointmentPdf(patientCode, meta = {}) {
  if (!PDFDocument) {
    console.warn('[Notify][pdf:skipped] pdfkit not installed; run "npm install pdfkit" to enable PDFs.');
    return { status: 'skipped', reason: 'pdfkit-missing' };
  }
  try {
    const contact = await getPatientContact(patientCode);
    if (!contact?.email) {
      console.log('[Notify][pdf:no-email]', patientCode, meta);
      return { status: 'skipped', reason: 'no-email' };
    }
    const dentistName = meta.dentistName || (meta.dentistCode ? await getDentistName(meta.dentistCode) : '');
    const buffer = await buildAppointmentPdf({
      ...meta,
      patientCode,
      patientName: contact.name,
      dentistName,
    });
    const subject = `Appointment Details: ${[meta.date, meta.time].filter(Boolean).join(' ') || meta.appointmentCode || ''}`.trim() || 'Appointment Details';
    const text = `Hi ${contact.name || 'Patient'},\n\nAttached is your appointment confirmation ${meta.appointmentCode ? `(${meta.appointmentCode})` : ''}.\n\nThank you.\n`;
    await sendEmail(contact.email, subject, text, [{
      filename: `${meta.appointmentCode || 'appointment'}.pdf`,
      content: buffer,
    }]);
    return { status: 'sent', email: contact.email };
  } catch (err) {
    console.error('[Notify][pdf:error]', err);
    return { status: 'failed', error: String(err) };
  }
}

/* ------- ADDED HELPERS (replaced) ------- */
async function sendWhatsAppWithPdf(toE164Raw, text, pdfBuffer, filename = 'appointment.pdf') {
  const to = toE164(toE164Raw);

  if (!twilioClient || !process.env.TWILIO_WHATSAPP_FROM) {
    console.log('[Notify][wa+pdf:dryrun]', to, text, filename, pdfBuffer ? pdfBuffer.length : 0);
    return { sid: 'dryrun-wa-pdf' };
  }
  if (!pdfBuffer || !pdfBuffer.length) {
    return sendWhatsApp(to, text); // fallback to text only
  }

  // Host the buffer temporarily so Twilio can fetch it
  const id = MediaStore.put(pdfBuffer, filename, 'application/pdf', 1000 * 60 * 30); // 30 minutes
  const mediaUrl = absoluteUrl(`/media/${id}/${encodeURIComponent(filename)}`);

  const msg = await twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to:   `whatsapp:${to}`,
    body: text,
    mediaUrl: [mediaUrl],
  });
  return { sid: msg.sid };
}

async function sendAccountCreatedWhatsApp({ to, patientName, email, tempPassword, patientCode }) {
  const text =
    `Hello ${patientName || "Patient"}!\n\n` +
    `Your dental account has been created.\n` +
    `Patient Code: ${patientCode}\n` +
    `Login Email: ${email}\n` +
    `Temporary Password: ${tempPassword}\n\n` +
    `You can now manage appointments online.`;
  return sendWhatsApp(to, text);
}

async function sendAppointmentConfirmed({ to, patientType, patientCode, dentistCode, appointmentCode, datetimeISO, reason, patientName, phone, email, nic, passport }) {
  const appointmentDate = new Date(datetimeISO);
  const formattedDate = appointmentDate.toLocaleDateString();
  const formattedTime = appointmentDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  const text =
    `🎉 *Appointment Confirmed!*\n\n` +
    `📋 *Appointment Details:*\n` +
    `• Code: ${appointmentCode}\n` +
    `• Doctor: ${dentistCode}\n` +
    `• Date: ${formattedDate}\n` +
    `• Time: ${formattedTime}\n` +
    (reason ? `• Reason: ${reason}\n` : '') +
    `\n📄 Your appointment confirmation PDF is attached.\n\n` +
    `⏰ Please arrive 10 minutes early.\n` +
    `📞 Contact us if you need to reschedule.\n\n` +
    `Thank you for choosing MediCore Dental Clinic! 🦷`;

  let pdfBuffer = null;
  let pdfResult = { status: 'failed', error: 'PDF generation failed' };

  if (PDFDocument) {
    try {
      const d = new Date(datetimeISO);
      pdfBuffer = await buildAppointmentPdf({
        patientType,
        patientCode,
        patientName,
        dentistCode,
        appointmentCode,
        date: d.toISOString().slice(0, 10),
        time: d.toISOString().slice(11, 16),
        reason,
        phone,
        email,
        nic,
        passport,
      });
      pdfResult = { status: 'success', buffer: pdfBuffer };
    } catch (e) {
      console.error('[Notify][buildAppointmentPdf:error]', e);
      pdfResult = { status: 'failed', error: String(e) };
    }
  }

  let whatsappResult = { status: 'failed', error: 'WhatsApp send failed' };

  try {
    if (pdfBuffer && pdfResult.status === 'success') {
      const result = await sendWhatsAppWithPdf(to, text, pdfBuffer, `${appointmentCode || 'appointment'}.pdf`);
      whatsappResult = { status: 'success', sid: result.sid };
    } else {
      const result = await sendWhatsApp(to, text);
      whatsappResult = { status: 'success', sid: result.sid };
    }
  } catch (e) {
    console.error('[Notify][sendWhatsApp:error]', e);
    whatsappResult = { status: 'failed', error: String(e) };
  }

  return {
    whatsapp: whatsappResult,
    pdf: pdfResult,
    message: text
  };
}

/* ----------------- EXPORTS ----------------- */

module.exports = {
  sendApptConfirmed,
  sendApptCanceled,
  scheduleApptReminder24h,
  sendDentistDailyRun,
  processDueQueue,
  sendPatientAccountCreated,
  sendAppointmentPdf,

  // added helpers
  sendAccountCreatedWhatsApp,
  sendAppointmentConfirmed,
  buildAppointmentPdf,
  getPatientContact,
};
