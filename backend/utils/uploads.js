/**
 * File uploads – Django FileField/ImageField behaviour on local disk (MEDIA_ROOT).
 * Files are kept in memory by multer, validated, then written with
 * Django's naming rules (get_valid_filename + random suffix on collision).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import config from '../config.js';
import { ValidationError } from './forms.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10, fields: 200 },
});

/** Accept any multipart body (fields + files) – files end up in req.files[] */
export const parseMultipart = upload.any();

export function getFile(req, field) {
  return (req.files || []).find((f) => f.fieldname === field && f.originalname) || null;
}

export function mediaUrl(relPath) {
  if (!relPath) return null;
  if (/^https?:\/\//i.test(relPath)) return relPath;
  return config.MEDIA_URL + relPath.split('/').map(encodeURIComponent).join('/');
}

function getValidFilename(name) {
  let s = String(name).trim().replace(/ /g, '_');
  s = s.replace(/[^-\w.]/g, '');
  if (!s || s === '.' || s === '..') s = 'file';
  return s;
}

/**
 * Save an uploaded file under MEDIA_ROOT/<uploadTo>/ and return the relative path
 * that is stored in the database (e.g. "receipts/screenshot.png").
 */
export async function saveUpload(file, uploadTo) {
  const dir = path.join(config.MEDIA_ROOT, uploadTo);
  await fs.promises.mkdir(dir, { recursive: true });
  const base = path.basename(file.originalname);
  let filename = getValidFilename(base);
  const ext = path.extname(filename);
  let stem = filename.slice(0, filename.length - ext.length);
  // keep the DB path within max_length=100
  const maxStem = Math.max(1, 100 - uploadTo.length - 1 - ext.length - 8);
  if (stem.length > maxStem) stem = stem.slice(0, maxStem);
  filename = `${stem}${ext}`;
  while (fs.existsSync(path.join(dir, filename))) {
    const suffix = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 7);
    filename = `${stem}_${suffix}${ext}`;
  }
  await fs.promises.writeFile(path.join(dir, filename), file.buffer);
  return `${uploadTo.replace(/\/$/, '')}/${filename}`;
}

export function absoluteMediaPath(relPath) {
  if (!relPath) return null;
  return path.join(config.MEDIA_ROOT, relPath);
}

/** Generic FileField checks */
export function validateFileField(file) {
  if (!file) return;
  if (!file.size) throw new ValidationError('The submitted file is empty.');
}

/** pehchan.models.validate_receipt_file */
export function validateReceiptFile(file) {
  validateFileField(file);
  const maxSizeMb = 5;
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new ValidationError(`File size must not exceed ${maxSizeMb} MB.`);
  }
  const valid = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!valid.includes(ext)) {
    throw new ValidationError(`Unsupported file extension: ${ext}. Allowed: JPG, PNG, WEBP, PDF.`);
  }
}

/** ImageField validation (Pillow check replaced by magic-byte sniffing) */
export function validateImageFile(file) {
  validateFileField(file);
  const b = file.buffer;
  const isImage =
    (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || // png
    (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // jpg
    (b.length > 6 && b.slice(0, 3).toString() === 'GIF') || // gif
    (b.length > 12 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') || // webp
    (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) || // bmp
    (b.length > 12 && b.slice(4, 12).toString().startsWith('ftypavi')) || // avif
    (b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)) && (b[2] === 0x2a || b[3] === 0x2a)) || // tiff
    (b.length > 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0); // ico
  if (!isImage) {
    throw new ValidationError('Upload a valid image. The file you uploaded was either not an image or a corrupted image.');
  }
}

export async function deleteMediaFile(relPath) {
  if (!relPath || /^https?:\/\//i.test(relPath)) return;
  try {
    await fs.promises.unlink(absoluteMediaPath(relPath));
  } catch {
    /* ignore */
  }
}
