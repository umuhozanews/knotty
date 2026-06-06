const AfricasTalking = require('africastalking');

let client;

function getClient() {
  if (!client) {
    client = AfricasTalking({
      apiKey: process.env.AFRICAS_TALKING_API_KEY,
      username: process.env.AFRICAS_TALKING_USERNAME,
    });
  }
  return client;
}

async function sendSMS(to, message) {
  const sms = getClient().SMS;
  const recipients = Array.isArray(to) ? to : [to];

  try {
    const result = await sms.send({
      to: recipients,
      message,
      from: process.env.AFRICAS_TALKING_SENDER_ID || 'KNOTTY',
    });
    return result;
  } catch (err) {
    console.error('SMS send error:', err.message);
    throw err;
  }
}

async function sendAttendanceAlert(parentPhone, studentName, status, time) {
  const msg =
    status === 'ABSENT'
      ? `KNOTTY Alert: ${studentName} was marked ABSENT today (${new Date().toLocaleDateString()}). Contact school for details.`
      : `KNOTTY Alert: ${studentName} arrived LATE at ${time}. Contact school if needed.`;

  return sendSMS(parentPhone, msg);
}

module.exports = { sendSMS, sendAttendanceAlert };
