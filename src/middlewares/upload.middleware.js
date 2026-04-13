const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { AppError } = require('./error.middleware');

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
const profileImagesDir = path.join(uploadsRoot, 'profile-images');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(profileImagesDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileImagesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new AppError('Only image files are allowed', 400));
  }
  return cb(null, true);
};

const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('profileImage');

const handleProfileImageUpload = (req, res, next) => {
  uploadProfileImage(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Profile image must be 5MB or smaller', 400));
    }
    return next(new AppError('Failed to upload profile image', 400));
  });
};

const attachProfileImageUrl = (req, res, next) => {
  if (req.file) {
    req.body.profileImageUrl = `/uploads/profile-images/${req.file.filename}`;
  }
  return next();
};

module.exports = { handleProfileImageUpload, attachProfileImageUrl };
