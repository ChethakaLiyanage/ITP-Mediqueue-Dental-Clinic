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
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Appointment Confirmation', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Appointment Code: ${meta.appointmentCode || '-'}`);
    doc.text(`Patient Code: ${meta.patientCode || '-'}`);
    doc.text(`Patient Name: ${meta.patientName || '-'}`);
    doc.text(`Dentist: ${meta.dentistName || meta.dentistCode || '-'}`);
    doc.text(`Date: ${meta.date || '-'}`);
    doc.text(`Time: ${meta.time || '-'}`);
    doc.text(`Created By: ${meta.createdByCode || '-'}`);
    doc.text(`Accepted By: ${meta.acceptedByCode || '-'}`);
    if (meta.notes) {
      doc.moveDown();
      doc.text(`Notes: ${meta.notes}`);
    }
    doc.moveDown();
    doc.text('Please arrive 10 minutes early. Contact us if you need to reschedule.');
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

async function sendAppointmentConfirmed({ to, patientType, patientCode, dentistCode, appointmentCode, datetimeISO, reason }) {
  const text =
    `Appointment Confirmed ✅\n` +
    `Appt: ${appointmentCode}\n` +
    `Patient: ${patientCode} (${patientType})\n` +
    `Dentist: ${dentistCode}\n` +
    `When: ${new Date(datetimeISO).toLocaleString()}\n` +
    (reason ? `Reason: ${reason}\n` : '') +
    `A PDF slip is attached.`;

  let pdfBuffer = null;
  if (PDFDocument) {
    try {
      const d = new Date(datetimeISO);
      pdfBuffer = await buildAppointmentPdf({
        patientType,
        patientCode,
        dentistCode,
        appointmentCode,
        date: d.toISOString().slice(0, 10),
        time: d.toISOString().slice(11, 16),
        reason,
      });
    } catch (e) {
      console.error('[Notify][buildAppointmentPdf:error]', e);
    }
  }

  if (pdfBuffer) {
    await sendWhatsAppWithPdf(to, text, pdfBuffer, `${appointmentCode || 'appointment'}.pdf`);
  } else {
    await sendWhatsApp(to, text);
  }

  if (patientCode) {
    try {
      const d = new Date(datetimeISO);
      await sendAppointmentPdf(patientCode, {
        appointmentCode,
        patientCode,
        dentistCode,
        date: d.toISOString().slice(0, 10),
        time: d.toISOString().slice(11, 16),
      });
    } catch (e) {
      console.error('[Notify][sendAppointmentPdf:followup:error]', e);
    }
  }
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
};
