const QRCode = require('qrcode');

async function generateQRCode(data) {
  return QRCode.toDataURL(JSON.stringify(data), {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    width: 300,
  });
}

module.exports = { generateQRCode };
