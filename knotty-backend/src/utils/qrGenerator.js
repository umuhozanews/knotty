const QRCode = require('qrcode');

async function generateQRCode(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    width: 300,
  });
}

module.exports = { generateQRCode };
