const crypto = require('crypto');

function getSecretBytes() {
  const configured = String(process.env.SECURITY_SECRET || '').trim();
  if (configured) {
    return crypto.createHash('sha256').update(configured).digest();
  }

  return crypto.createHash('sha256').update('surakshafile-dev-secret').digest();
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createOtp() {
  const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
  return otp;
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function encryptText(plainText) {
  const value = String(plainText || '');
  if (!value) return '';

  const key = getSecretBytes();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function decryptText(value) {
  const input = String(value || '');
  if (!input.startsWith('enc:v1:')) {
    return input;
  }

  const [, , ivHex, tagHex, dataHex] = input.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    return input;
  }

  const key = getSecretBytes();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const output = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return output.toString('utf8');
}

module.exports = {
  hashValue,
  createOtp,
  createSessionToken,
  encryptText,
  decryptText,
};
