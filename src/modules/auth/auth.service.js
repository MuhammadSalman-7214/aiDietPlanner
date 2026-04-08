const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { AppError } = require('../../middlewares/error.middleware');
const authRepo = require('./auth.repository');
const { generateToken } = require('../../utils/generateToken');
const { sendOtpEmail } = require('../../utils/mailer');
const { createAuditLog } = require('../audit/audit.repository');

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);

const normalizeEmail = (email) => email.trim().toLowerCase();

const generateOtp = () => String(crypto.randomInt(100000, 1000000));
const hashOtp = (email, otp) => {
  const secret = process.env.JWT_SECRET || 'otp-secret';
  return crypto.createHash('sha256').update(`${email}:${otp}:${secret}`).digest('hex');
};

const buildOtpPayload = (email) => {
  const otp = generateOtp();
  const emailOtpHash = hashOtp(email, otp);
  const emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const emailOtpLastSentAt = new Date();
  return { otp, emailOtpHash, emailOtpExpiresAt, emailOtpLastSentAt };
};

const register = async ({ name, email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await authRepo.findByEmail(normalizedEmail);
  if (existing && existing.isEmailVerified) throw new AppError('Email already in use', 409);

  const passwordHash = await bcrypt.hash(password, 10);
  const otpPayload = buildOtpPayload(normalizedEmail);

  if (existing && !existing.isEmailVerified) {
    await authRepo.updateUserById(existing.id, {
      name,
      email: normalizedEmail,
      passwordHash,
      isEmailVerified: false,
      isPremium: existing.isPremium,
      emailOtpHash: otpPayload.emailOtpHash,
      emailOtpExpiresAt: otpPayload.emailOtpExpiresAt,
      emailOtpLastSentAt: otpPayload.emailOtpLastSentAt,
    });
  } else {
    const pending = await authRepo.findPendingByEmail(normalizedEmail);
    if (pending) {
      await authRepo.updatePendingUserById(pending.id, {
        name,
        email: normalizedEmail,
        passwordHash,
        emailOtpHash: otpPayload.emailOtpHash,
        emailOtpExpiresAt: otpPayload.emailOtpExpiresAt,
        emailOtpLastSentAt: otpPayload.emailOtpLastSentAt,
      });
    } else {
      await authRepo.createPendingUser({
        name,
        email: normalizedEmail,
        passwordHash,
        emailOtpHash: otpPayload.emailOtpHash,
        emailOtpExpiresAt: otpPayload.emailOtpExpiresAt,
        emailOtpLastSentAt: otpPayload.emailOtpLastSentAt,
      });
    }
  }

  const emailSent = await sendOtpEmail({
    to: normalizedEmail,
    name,
    otp: otpPayload.otp,
    ttlMinutes: OTP_TTL_MINUTES,
  });
  if (!emailSent) {
    throw new AppError('Email service not configured', 500);
  }

  createAuditLog({ userId: existing?.id || null, action: 'auth.register', metadata: { email: normalizedEmail } })
    .catch(() => {});

  return {
    user: {
      name,
      email: normalizedEmail,
      isEmailVerified: false,
      isPremium: existing?.isPremium ?? false,
    },
    requiresOtp: true,
  };
};

const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await authRepo.findByEmail(normalizedEmail);
  if (!user) throw new AppError('Invalid credentials', 401);
  if (!user.isEmailVerified) throw new AppError('Email not verified', 403);
  if (user.isActive === false) throw new AppError('Account is inactive', 403);

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw new AppError('Invalid credentials', 401);

  const token = generateToken({ id: user.id, email: user.email, isPremium: user.isPremium });
  createAuditLog({ userId: user.id, action: 'auth.login', metadata: { email: user.email } }).catch(() => {});
  return { user: { id: user.id, name: user.name, email: user.email, isPremium: user.isPremium }, token };
};

const verifyOtp = async ({ email, otp }) => {
  const normalizedEmail = normalizeEmail(email);
  const pending = await authRepo.findPendingByEmail(normalizedEmail);
  if (!pending) {
    const existing = await authRepo.findByEmail(normalizedEmail);
    if (existing) {
      if (existing.isEmailVerified) throw new AppError('Email already verified', 400);
      if (!existing.emailOtpHash || !existing.emailOtpExpiresAt) throw new AppError('OTP expired', 400);
      if (existing.emailOtpExpiresAt.getTime() < Date.now()) {
        throw new AppError('OTP expired', 400);
      }
      const incomingHash = hashOtp(normalizedEmail, otp);
      if (incomingHash !== existing.emailOtpHash) throw new AppError('Invalid OTP', 400);

      const updated = await authRepo.updateUserById(existing.id, {
        isEmailVerified: true,
        emailOtpHash: null,
        emailOtpExpiresAt: null,
        emailOtpLastSentAt: null,
      });

      const token = generateToken({ id: updated.id, email: updated.email, isPremium: updated.isPremium });
      createAuditLog({ userId: updated.id, action: 'auth.verify_otp', metadata: { email: updated.email } })
        .catch(() => {});
      return { user: { id: updated.id, name: updated.name, email: updated.email, isPremium: updated.isPremium }, token };
    }
    throw new AppError('Invalid OTP', 400);
  }
  if (!pending.emailOtpHash || !pending.emailOtpExpiresAt) throw new AppError('OTP expired', 400);

  if (pending.emailOtpExpiresAt.getTime() < Date.now()) {
    throw new AppError('OTP expired', 400);
  }

  const incomingHash = hashOtp(normalizedEmail, otp);
  if (incomingHash !== pending.emailOtpHash) throw new AppError('Invalid OTP', 400);

  const created = await authRepo.createUser({
    name: pending.name,
    email: pending.email,
    passwordHash: pending.passwordHash,
    isEmailVerified: true,
    isPremium: false,
    isActive: true,
    emailOtpHash: null,
    emailOtpExpiresAt: null,
    emailOtpLastSentAt: null,
  });

  await authRepo.deletePendingById(pending.id);

  const token = generateToken({ id: created.id, email: created.email, isPremium: created.isPremium });
  createAuditLog({ userId: created.id, action: 'auth.verify_otp', metadata: { email: created.email } })
    .catch(() => {});
  return { user: { id: created.id, name: created.name, email: created.email, isPremium: created.isPremium }, token };
};

const resendOtp = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  const pending = await authRepo.findPendingByEmail(normalizedEmail);
  if (!pending) {
    const existing = await authRepo.findByEmail(normalizedEmail);
    if (existing) {
      if (existing.isEmailVerified) throw new AppError('Email already verified', 400);
      if (existing.emailOtpLastSentAt) {
        const elapsedSeconds = Math.floor(
          (Date.now() - existing.emailOtpLastSentAt.getTime()) / 1000
        );
        if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
          throw new AppError(
            `Please wait ${OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds} seconds before requesting a new code`,
            429
          );
        }
      }

      const otpPayload = buildOtpPayload(normalizedEmail);
      const updatedLegacy = await authRepo.updateUserById(existing.id, {
        emailOtpHash: otpPayload.emailOtpHash,
        emailOtpExpiresAt: otpPayload.emailOtpExpiresAt,
        emailOtpLastSentAt: otpPayload.emailOtpLastSentAt,
      });

      const emailSentLegacy = await sendOtpEmail({
        to: updatedLegacy.email,
        name: updatedLegacy.name,
        otp: otpPayload.otp,
        ttlMinutes: OTP_TTL_MINUTES,
      });
      if (!emailSentLegacy) {
        throw new AppError('Email service not configured', 500);
      }

      createAuditLog({ userId: existing.id, action: 'auth.resend_otp', metadata: { email: existing.email } })
        .catch(() => {});
      return { message: 'OTP sent to email' };
    }
    throw new AppError('Account not found', 404);
  }

  if (pending.emailOtpLastSentAt) {
    const elapsedSeconds = Math.floor(
      (Date.now() - pending.emailOtpLastSentAt.getTime()) / 1000
    );
    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      throw new AppError(
        `Please wait ${OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds} seconds before requesting a new code`,
        429
      );
    }
  }

  const otpPayload = buildOtpPayload(normalizedEmail);
  const updated = await authRepo.updatePendingUserById(pending.id, {
    emailOtpHash: otpPayload.emailOtpHash,
    emailOtpExpiresAt: otpPayload.emailOtpExpiresAt,
    emailOtpLastSentAt: otpPayload.emailOtpLastSentAt,
  });

  const emailSent = await sendOtpEmail({
    to: updated.email,
    name: updated.name,
    otp: otpPayload.otp,
    ttlMinutes: OTP_TTL_MINUTES,
  });
  if (!emailSent) {
    throw new AppError('Email service not configured', 500);
  }

  createAuditLog({ userId: null, action: 'auth.resend_otp', metadata: { email: updated.email } })
    .catch(() => {});
  return { message: 'OTP sent to email' };
};

module.exports = { register, login, verifyOtp, resendOtp };
