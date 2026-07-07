export const METADATA_FIELDS = [
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

const DEFAULT_LIMITATIONS =
  'Hash after upload confirms integrity post-capture. It cannot prove that evidence was unaltered before upload.';

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
}

function fileTypeLabel(file) {
  const labels = {
    'image/jpeg': 'JPEG image',
    'image/png': 'PNG image',
    'image/webp': 'WebP image',
    'image/gif': 'GIF image',
    'application/pdf': 'PDF document',
    'text/plain': 'Plain text file',
    'video/mp4': 'MP4 video',
  };

  if (labels[file.type]) {
    return labels[file.type];
  }

  const ext = file.name.split('.').pop();
  return ext ? `${ext.toUpperCase()} file` : 'Unknown file type';
}

function inferSourceFromFilename(filename) {
  const lower = String(filename || '').toLowerCase();

  if (lower.includes('whatsapp')) return 'WhatsApp chat/media export';
  if (lower.includes('telegram')) return 'Telegram export';
  if (lower.includes('screenshot') || lower.includes('screen_shot')) return 'Device screenshot';
  if (lower.includes('sms') || lower.includes('message')) return 'SMS or messaging export';
  if (lower.includes('email') || lower.includes('mail')) return 'Email export';
  if (lower.includes('bank') || lower.includes('statement')) return 'Bank statement or passbook';
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

  return fromComplaint;
}

export function extractClientMetadata(file, complaint) {
  return {
    fileType: fileTypeLabel(file),
    source: inferSourceFromFilename(file.name),
    sourceDevice: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      ? 'Mobile browser upload'
      : 'Desktop browser upload',
    collectedAt: formatTimestamp(file.lastModified || Date.now()),
    transactionId: String(complaint?.formData?.transactionId || '').trim(),
    platformName: inferPlatformFromFilename(file.name, complaint),
    complaintCategory: String(complaint?.fraudType || '').trim(),
    captureMethod: inferSourceFromFilename(file.name).includes('screenshot')
      ? 'Screenshot capture (filename pattern)'
      : 'Manual file upload',
    captureLimitations: DEFAULT_LIMITATIONS,
  };
}

export function mergeMetadata(auto, manual) {
  const merged = { ...auto };

  for (const field of METADATA_FIELDS) {
    const manualValue = String(manual?.[field] || '').trim();
    if (manualValue) {
      merged[field] = manualValue;
    }
  }

  return merged;
}
