const { getDb } = require('../../config/db');

const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    isEmailVerified: Boolean(row.is_email_verified),
    isPremium: Boolean(row.is_premium),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    emailOtpHash: row.email_otp_hash,
    emailOtpExpiresAt: row.email_otp_expires_at ? new Date(row.email_otp_expires_at) : null,
    emailOtpLastSentAt: row.email_otp_last_sent_at ? new Date(row.email_otp_last_sent_at) : null,
    passwordResetOtpHash: row.password_reset_otp_hash,
    passwordResetExpiresAt: row.password_reset_expires_at
      ? new Date(row.password_reset_expires_at)
      : null,
    passwordResetLastSentAt: row.password_reset_last_sent_at
      ? new Date(row.password_reset_last_sent_at)
      : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const mapPendingRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    emailOtpHash: row.email_otp_hash,
    emailOtpExpiresAt: row.email_otp_expires_at ? new Date(row.email_otp_expires_at) : null,
    emailOtpLastSentAt: row.email_otp_last_sent_at ? new Date(row.email_otp_last_sent_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

const findByEmail = async (email) => {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return mapRow(rows[0]);
};

const findById = async (id) => {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return mapRow(rows[0]);
};

const findPendingByEmail = async (email) => {
  const db = getDb();
  const [rows] = await db.query('SELECT * FROM pending_users WHERE email = ? LIMIT 1', [email]);
  return mapPendingRow(rows[0]);
};

const createUser = async (data) => {
  const db = getDb();
  const {
    name,
    email,
    passwordHash,
    isEmailVerified,
    isPremium,
    isActive = true,
    emailOtpHash,
    emailOtpExpiresAt,
    emailOtpLastSentAt,
  } = data;

  const [result] = await db.query(
    `INSERT INTO users
      (name, email, password_hash, is_email_verified, is_premium, is_active, email_otp_hash, email_otp_expires_at, email_otp_last_sent_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      name,
      email,
      passwordHash,
      isEmailVerified ? 1 : 0,
      isPremium ? 1 : 0,
      isActive ? 1 : 0,
      emailOtpHash,
      emailOtpExpiresAt,
      emailOtpLastSentAt,
    ]
  );

  const [rows] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [result.insertId]);
  return mapRow(rows[0]);
};

const createPendingUser = async (data) => {
  const db = getDb();
  const { name, email, passwordHash, emailOtpHash, emailOtpExpiresAt, emailOtpLastSentAt } = data;

  const [result] = await db.query(
    `INSERT INTO pending_users
      (name, email, password_hash, email_otp_hash, email_otp_expires_at, email_otp_last_sent_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [name, email, passwordHash, emailOtpHash, emailOtpExpiresAt, emailOtpLastSentAt]
  );

  const [rows] = await db.query('SELECT * FROM pending_users WHERE id = ? LIMIT 1', [
    result.insertId,
  ]);
  return mapPendingRow(rows[0]);
};

const updateUserById = async (id, data) => {
  const db = getDb();
  const fields = [];
  const values = [];

  const mapping = {
    name: 'name',
    email: 'email',
    passwordHash: 'password_hash',
    isEmailVerified: 'is_email_verified',
    isPremium: 'is_premium',
    isActive: 'is_active',
    emailOtpHash: 'email_otp_hash',
    emailOtpExpiresAt: 'email_otp_expires_at',
    emailOtpLastSentAt: 'email_otp_last_sent_at',
    passwordResetOtpHash: 'password_reset_otp_hash',
    passwordResetExpiresAt: 'password_reset_expires_at',
    passwordResetLastSentAt: 'password_reset_last_sent_at',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      fields.push(`${column} = ?`);
      const value =
        key === 'isEmailVerified' || key === 'isPremium' || key === 'isActive'
          ? (data[key] ? 1 : 0)
          : data[key];
      values.push(value);
    }
  });

  fields.push('updated_at = NOW()');

  await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  const [rows] = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return mapRow(rows[0]);
};

const updatePendingUserById = async (id, data) => {
  const db = getDb();
  const fields = [];
  const values = [];

  const mapping = {
    name: 'name',
    email: 'email',
    passwordHash: 'password_hash',
    emailOtpHash: 'email_otp_hash',
    emailOtpExpiresAt: 'email_otp_expires_at',
    emailOtpLastSentAt: 'email_otp_last_sent_at',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      fields.push(`${column} = ?`);
      values.push(data[key]);
    }
  });

  fields.push('updated_at = NOW()');

  await db.query(`UPDATE pending_users SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  const [rows] = await db.query('SELECT * FROM pending_users WHERE id = ? LIMIT 1', [id]);
  return mapPendingRow(rows[0]);
};

const deletePendingById = async (id) => {
  const db = getDb();
  await db.query('DELETE FROM pending_users WHERE id = ?', [id]);
};

module.exports = {
  findById,
  findByEmail,
  findPendingByEmail,
  createUser,
  createPendingUser,
  updateUserById,
  updatePendingUserById,
  deletePendingById,
};
