const fs = require('fs');
const path = require('path');
const exifr = require('exifr');

const DEFAULT_LIMITATIONS =
  'Hash after upload confirms integrity post-capture. It cannot prove that evidence was unaltered before upload.';

const METADATA_FIELDS = [
  'fileType',
  'source',
  'sourceDevice',
  'collectedAt',
  'transactionId',
  'platformName',
  'complaintCategory',
  'captureMethod',
  'captureLimitations',
];

function formatTimestamp(value) {
  let parsedValue = value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    parsedValue = Number(value);
  }
  const date = parsedValue instanceof Date ? parsedValue : new Date(parsedValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
}

function fileTypeLabel(mimeType, filename) {
  const labels = {
    'image/jpeg': 'JPEG image',
    'image/png': 'PNG image',
    'image/webp': 'WebP image',
    'image/gif': 'GIF image',
    'image/heic': 'HEIC image',
    'image/heif': 'HEIF image',
    'application/pdf': 'PDF document',
    'text/plain': 'Plain text file',
    'video/mp4': 'MP4 video',
    'video/quicktime': 'QuickTime video',
    'audio/mpeg': 'MP3 audio',
    'audio/wav': 'WAV audio',
  };

  if (labels[mimeType]) {
    return labels[mimeType];
  }

  const ext = path.extname(filename).replace('.', '').toUpperCase();
  if (ext) {
    return `${ext} file`;
  }

  return mimeType || 'Unknown file type';
}

function inferSourceFromFilename(filename) {
  const lower = String(filename || '').toLowerCase();

  if (lower.includes('whatsapp') || lower.includes('wa ')) {
    return 'WhatsApp chat/media export';
  }
  if (lower.includes('telegram')) {
    return 'Telegram export';
  }
  if (lower.includes('screenshot') || lower.includes('screen_shot') || lower.includes('screen-shot')) {
    return 'Device screenshot';
  }
  if (lower.includes('sms') || lower.includes('message')) {
    return 'SMS or messaging export';
  }
  if (lower.includes('email') || lower.includes('mail')) {
    return 'Email export';
  }
  if (lower.includes('bank') || lower.includes('statement') || lower.includes('passbook')) {
    return 'Bank statement or passbook';
  }
  if (lower.includes('upi') || lower.includes('transaction') || lower.includes('receipt')) {
    return 'Payment or transaction record';
  }

  return 'Digital file upload';
}

function inferPlatformFromFilename(filename, complaint) {
  const lower = String(filename || '').toLowerCase();
  const fromComplaint =
    String(complaint?.formData?.platformName || complaint?.formData?.platform || '').trim();

  if (lower.includes('whatsapp')) return 'WhatsApp';
  if (lower.includes('telegram')) return 'Telegram';
  if (lower.includes('instagram')) return 'Instagram';
  if (lower.includes('facebook')) return 'Facebook';
  if (lower.includes('gmail') || lower.includes('email')) return 'Email';
  if (lower.includes('phonepe')) return 'PhonePe';
  if (lower.includes('gpay') || lower.includes('google pay')) return 'Google Pay';
  if (lower.includes('paytm')) return 'Paytm';

  return fromComplaint;
}

function inferCaptureMethod({ filename, exif, mimeType }) {
  if (exif?.Make || exif?.Model) {
    return 'Camera capture (EXIF detected)';
  }

  const lower = String(filename || '').toLowerCase();
  if (lower.includes('screenshot') || lower.includes('screen_shot') || lower.includes('screen-shot')) {
    return 'Screenshot capture (filename pattern)';
  }

  if (mimeType === 'application/pdf') {
    return 'PDF document export';
  }

  if (mimeType?.startsWith('video/')) {
    return 'Video recording upload';
  }

  return 'Manual file upload';
}

function parseUserAgent(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) {
    return '';
  }

  if (/iPhone|iPad|iOS/i.test(ua)) {
    return 'iOS device (User-Agent)';
  }
  if (/Android/i.test(ua)) {
    return 'Android device (User-Agent)';
  }
  if (/Windows/i.test(ua)) {
    return 'Windows device (User-Agent)';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return 'macOS device (User-Agent)';
  }
  if (/Linux/i.test(ua)) {
    return 'Linux device (User-Agent)';
  }

  return 'Web browser upload (User-Agent)';
}

async function readExif(filePath, mimeType) {
  if (!mimeType?.startsWith('image/')) {
    return {};
  }

  try {
    const exif = await exifr.parse(filePath, {
      pick: ['Make', 'Model', 'DateTimeOriginal', 'CreateDate', 'ModifyDate', 'Software'],
    });
    return exif || {};
  } catch {
    return {};
  }
}

async function readExifFromBuffer(buffer, mimeType) {
  if (!mimeType?.startsWith('image/') || !buffer?.length) {
    return {};
  }

  try {
    const exif = await exifr.parse(buffer, {
      pick: ['Make', 'Model', 'DateTimeOriginal', 'CreateDate', 'ModifyDate', 'Software'],
    });
    return exif || {};
  } catch {
    return {};
  }
}

function buildDeviceLabel(exif, userAgent) {
  const fromExif = [exif?.Make, exif?.Model].filter(Boolean).join(' ').trim();
  if (fromExif) {
    return fromExif;
  }

  if (exif?.Software) {
    return String(exif.Software);
  }

  return parseUserAgent(userAgent) || 'Unknown device';
}

function buildCollectedAt({ exif, mtime, lastModified }) {
  const candidate = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate || mtime || lastModified;
  return formatTimestamp(candidate);
}

function buildTransactionId(complaint) {
  const formData = complaint?.formData || {};
  return String(formData.transactionId || formData.referenceId || '').trim();
}

async function extractEvidenceMetadata({
  filePath,
  buffer,
  originalFilename,
  mimeType,
  complaint,
  userAgent,
  lastModified,
}) {
  let stats = null;
  let exif = {};

  if (filePath && fs.existsSync(filePath)) {
    stats = fs.statSync(filePath);
    exif = await readExif(filePath, mimeType);
  } else if (buffer) {
    exif = await readExifFromBuffer(buffer, mimeType);
  }

  const auto = {
    fileType: fileTypeLabel(mimeType, originalFilename),
    source: inferSourceFromFilename(originalFilename),
    sourceDevice: buildDeviceLabel(exif, userAgent),
    collectedAt: buildCollectedAt({
      exif,
      mtime: stats?.mtime,
      lastModified,
    }),
    transactionId: buildTransactionId(complaint),
    platformName: inferPlatformFromFilename(originalFilename, complaint),
    complaintCategory: String(complaint?.fraudType || '').trim(),
    captureMethod: inferCaptureMethod({ filename: originalFilename, exif, mimeType }),
    captureLimitations: DEFAULT_LIMITATIONS,
  };

  return auto;
}

function mergeMetadata(auto, manual) {
  const merged = { ...auto };

  for (const field of METADATA_FIELDS) {
    const manualValue = String(manual?.[field] || '').trim();
    if (manualValue) {
      merged[field] = manualValue;
    }
  }

  if (!merged.captureLimitations) {
    merged.captureLimitations = DEFAULT_LIMITATIONS;
  }

  return merged;
}

function listAutoExtractedFields(auto, merged) {
  return METADATA_FIELDS.filter((field) => {
    const autoValue = String(auto?.[field] || '').trim();
    const mergedValue = String(merged?.[field] || '').trim();
    return autoValue && autoValue === mergedValue;
  });
}

module.exports = {
  DEFAULT_LIMITATIONS,
  METADATA_FIELDS,
  extractEvidenceMetadata,
  mergeMetadata,
  listAutoExtractedFields,
};
