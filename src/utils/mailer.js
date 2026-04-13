const nodemailer = require('nodemailer');
const logger = require('./logger');

const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn('SMTP not configured; unable to send email.');
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({ from, to, subject, text, html });
  return true;
};

const sendOtpEmail = async ({ to, name, otp, ttlMinutes }) => {
  const subject = 'Your verification code';
  const text = `Hi ${name || 'there'},\n\nYour verification code is ${otp}. It expires in ${ttlMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <p>Hi ${name || 'there'},</p>
      <p>Your verification code is <strong>${otp}</strong>.</p>
      <p>This code expires in ${ttlMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};

const sendPasswordResetEmail = async ({ to, name, otp, ttlMinutes }) => {
  const subject = 'Reset your password';
  const text = `Hi ${name || 'there'},\n\nUse this code to reset your password: ${otp}. It expires in ${ttlMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <p>Hi ${name || 'there'},</p>
      <p>Use this code to reset your password: <strong>${otp}</strong>.</p>
      <p>This code expires in ${ttlMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};

module.exports = { sendEmail, sendOtpEmail, sendPasswordResetEmail };
