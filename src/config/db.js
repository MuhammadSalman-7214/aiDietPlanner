const mysql = require("mysql2/promise");

let pool;

const ensureColumn = async (db, table, column, ddl) => {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [
    column,
  ]);
  if (rows.length === 0) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  }
};

const ensureIndex = async (db, table, indexName, ddl) => {
  try {
    const [rows] = await db.query(
      `SELECT 1
       FROM information_schema.STATISTICS
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND index_name = ?
       LIMIT 1`,
      [table, indexName],
    );
    if (rows.length === 0) {
      await db.query(`ALTER TABLE \`${table}\` ${ddl}`);
    }
  } catch (error) {
    console.warn(
      `:warning: Skipping index ${indexName} on ${table} (insufficient privileges or incompatible DB)`,
    );
  }
};

const ensureForeignKey = async (db, table, fkName, ddl) => {
  try {
    const [rows] = await db.query(
      `SELECT 1
       FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE constraint_schema = DATABASE()
         AND table_name = ?
         AND constraint_name = ?
       LIMIT 1`,
      [table, fkName],
    );
    if (rows.length === 0) {
      try {
        await db.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT ${ddl}`);
      } catch (error) {
        console.warn(
          `:warning: Skipping FK ${fkName} on ${table} (existing data may violate constraint)`,
        );
      }
    }
  } catch (error) {
    console.warn(
      `:warning: Skipping FK ${fkName} on ${table} (insufficient privileges or incompatible DB)`,
    );
  }
};

/**
 * Create all tables safely + add missing columns
 * (Uses SHOW COLUMNS, compatible with MySQL 5.7 / MariaDB)
 */
const ensureSchema = async (db) => {
  // USERS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_email_verified TINYINT(1) NOT NULL DEFAULT 0,
      is_premium TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      profile_image_url VARCHAR(2048) NULL,
      email_otp_hash VARCHAR(255) NULL,
      email_otp_expires_at DATETIME NULL,
      email_otp_last_sent_at DATETIME NULL,
      password_reset_otp_hash VARCHAR(255) NULL,
      password_reset_expires_at DATETIME NULL,
      password_reset_last_sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `); // PENDING USERS

  await db.query(`
    CREATE TABLE IF NOT EXISTS pending_users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      email_otp_hash VARCHAR(255) NULL,
      email_otp_expires_at DATETIME NULL,
      email_otp_last_sent_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `); // USER STATS

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_stats (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL UNIQUE,
      height_cm DECIMAL(5,2) NULL,
      weight_kg DECIMAL(5,2) NULL,
      meal_preferences TEXT NULL,
      meal_allergies TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `); // WEIGHT LOGS

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_weight_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      weight_kg DECIMAL(5,2) NOT NULL,
      logged_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_weight_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_weight_logs_user_date (user_id, logged_at)
    )
  `); // PROFILES

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL UNIQUE,
      age INT NULL,
      gender ENUM('male','female') NULL,
      activity_level ENUM('sedentary','light','moderate','active','very_active') NULL,
      goal ENUM('loss','gain','maintain') NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `); // FOODS

  await db.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      calories INT NOT NULL,
      protein INT NOT NULL,
      carbs INT NOT NULL,
      fats INT NOT NULL,
      category ENUM('breakfast','lunch','dinner','snack') NOT NULL,
      diet_type VARCHAR(50) NOT NULL DEFAULT 'any',
      ingredients TEXT NULL,
      instructions TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `); // NUTRITION LOGS

  await db.query(`
    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      name VARCHAR(255) NOT NULL,
      calories INT NOT NULL,
      protein INT NOT NULL DEFAULT 0,
      carbs INT NOT NULL DEFAULT 0,
      fats INT NOT NULL DEFAULT 0,
      logged_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_nutrition_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_nutrition_logs_user_date (user_id, logged_at)
    )
  `); // PROGRESS

  await db.query(`
    CREATE TABLE IF NOT EXISTS nutrition_progress (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      date DATE NOT NULL,
      target_calories INT NOT NULL,
      consumed_calories INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_progress_user_date (user_id, date),
      CONSTRAINT fk_nutrition_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `); // REMINDERS

  await db.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'general',
      message VARCHAR(255) NOT NULL,
      scheduled_at DATETIME NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_reminders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_reminders_user_date (user_id, scheduled_at)
    )
  `); // CONSULTATIONS

  await db.query(`
    CREATE TABLE IF NOT EXISTS consultations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      topic VARCHAR(255) NOT NULL,
      notes TEXT NULL,
      status ENUM('pending','scheduled','completed','cancelled') NOT NULL DEFAULT 'pending',
      scheduled_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_consultations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_consultations_user (user_id, status)
    )
  `); // DIET PLANS

  await db.query(`
    CREATE TABLE IF NOT EXISTS diet_plans (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      plan_json TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_diet_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_diet_plans_user (user_id, created_at)
    )
  `); // AUDIT LOGS

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NULL,
      action VARCHAR(100) NOT NULL,
      metadata TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id)
    )
  `);

  // Backfill missing columns for existing deployments (safe on MySQL 5.7)
  await ensureColumn(
    db,
    "users",
    "is_premium",
    "`is_premium` TINYINT(1) NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    db,
    "users",
    "is_active",
    "`is_active` TINYINT(1) NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    db,
    "users",
    "profile_image_url",
    "`profile_image_url` VARCHAR(2048) NULL",
  );
  await ensureColumn(
    db,
    "users",
    "is_email_verified",
    "`is_email_verified` TINYINT(1) NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    db,
    "users",
    "email_otp_hash",
    "`email_otp_hash` VARCHAR(255) NULL",
  );
  await ensureColumn(
    db,
    "users",
    "email_otp_expires_at",
    "`email_otp_expires_at` DATETIME NULL",
  );
  await ensureColumn(
    db,
    "users",
    "email_otp_last_sent_at",
    "`email_otp_last_sent_at` DATETIME NULL",
  );
  await ensureColumn(
    db,
    "users",
    "password_reset_otp_hash",
    "`password_reset_otp_hash` VARCHAR(255) NULL",
  );
  await ensureColumn(
    db,
    "users",
    "password_reset_expires_at",
    "`password_reset_expires_at` DATETIME NULL",
  );
  await ensureColumn(
    db,
    "users",
    "password_reset_last_sent_at",
    "`password_reset_last_sent_at` DATETIME NULL",
  );
  await ensureColumn(
    db,
    "pending_users",
    "email_otp_hash",
    "`email_otp_hash` VARCHAR(255) NULL",
  );
  await ensureColumn(
    db,
    "pending_users",
    "email_otp_expires_at",
    "`email_otp_expires_at` DATETIME NULL",
  );
  await ensureColumn(
    db,
    "pending_users",
    "email_otp_last_sent_at",
    "`email_otp_last_sent_at` DATETIME NULL",
  );

  // Ensure indexes (safe for existing DBs)
  await ensureIndex(
    db,
    "user_weight_logs",
    "idx_weight_logs_user_date",
    "ADD INDEX idx_weight_logs_user_date (user_id, logged_at)",
  );
  await ensureIndex(
    db,
    "nutrition_logs",
    "idx_nutrition_logs_user_date",
    "ADD INDEX idx_nutrition_logs_user_date (user_id, logged_at)",
  );
  await ensureIndex(
    db,
    "reminders",
    "idx_reminders_user_date",
    "ADD INDEX idx_reminders_user_date (user_id, scheduled_at)",
  );
  await ensureIndex(
    db,
    "consultations",
    "idx_consultations_user",
    "ADD INDEX idx_consultations_user (user_id, status)",
  );
  await ensureIndex(
    db,
    "diet_plans",
    "idx_diet_plans_user",
    "ADD INDEX idx_diet_plans_user (user_id, created_at)",
  );
  await ensureIndex(
    db,
    "audit_logs",
    "idx_audit_user",
    "ADD INDEX idx_audit_user (user_id)",
  );
  await ensureIndex(
    db,
    "nutrition_progress",
    "uq_progress_user_date",
    "ADD UNIQUE KEY uq_progress_user_date (user_id, date)",
  );

  // Ensure foreign keys (non-fatal if existing data violates)
  await ensureForeignKey(
    db,
    "user_stats",
    "fk_user_stats_user",
    "fk_user_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureForeignKey(
    db,
    "user_weight_logs",
    "fk_user_weight_logs_user",
    "fk_user_weight_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureForeignKey(
    db,
    "user_profiles",
    "fk_user_profiles_user",
    "fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureForeignKey(
    db,
    "nutrition_logs",
    "fk_nutrition_logs_user",
    "fk_nutrition_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureForeignKey(
    db,
    "nutrition_progress",
    "fk_nutrition_progress_user",
    "fk_nutrition_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureForeignKey(
    db,
    "reminders",
    "fk_reminders_user",
    "fk_reminders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureForeignKey(
    db,
    "consultations",
    "fk_consultations_user",
    "fk_consultations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
  await ensureForeignKey(
    db,
    "diet_plans",
    "fk_diet_plans_user",
    "fk_diet_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
  );
};

/**
 * Connect to MySQL + initialize schema
 */
const connectDB = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "aiDietPlanner",
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    });

    const conn = await pool.getConnection();
    conn.release();

    await ensureSchema(pool);

    console.log(":white_check_mark: MySQL connected & schema ready");
    return pool;
  } catch (error) {
    console.error(":x: DB connection failed:", error);
    throw error;
  }
};

/**
 * Get DB pool
 */
const getDb = () => {
  if (!pool) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return pool;
};

module.exports = {
  connectDB,
  getDb,
};
