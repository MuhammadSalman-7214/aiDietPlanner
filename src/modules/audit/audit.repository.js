const { getDb } = require('../../config/db');

const createAuditLog = async ({ userId, action, metadata }) => {
  const db = getDb();
  await db.query(
    `INSERT INTO audit_logs (user_id, action, metadata, created_at)
     VALUES (?, ?, ?, NOW())`,
    [userId || null, action, metadata ? JSON.stringify(metadata) : null]
  );
};

module.exports = { createAuditLog };
