const axios = require('axios');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

const BASE_URL = process.env.MTN_MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
const API_USER = process.env.MTN_MOMO_API_USER;
const API_KEY = process.env.MTN_MOMO_API_KEY;
const ENV = process.env.MTN_MOMO_ENVIRONMENT || 'sandbox';

function getHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Target-Environment': ENV,
    'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    'Content-Type': 'application/json',
  };
}

async function getAccessToken() {
  const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const res = await axios.post(
    `${BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    }
  );
  return res.data.access_token;
}

async function requestTopUp({ amount, phone, referenceId, description }) {
  const accessToken = await getAccessToken();
  const externalId = referenceId || uuidv4();

  await axios.post(
    `${BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: String(amount),
      currency: 'RWF',
      externalId,
      payer: { partyIdType: 'MSISDN', partyId: phone },
      payerMessage: description || 'KNOTTY Wallet Top Up',
      payeeNote: 'School wallet funding',
    },
    {
      headers: {
        ...getHeaders(accessToken),
        'X-Reference-Id': externalId,
      },
    }
  );

  return externalId;
}

async function getTransactionStatus(referenceId) {
  const accessToken = await getAccessToken();
  const res = await axios.get(
    `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
    { headers: getHeaders(accessToken) }
  );
  return res.data;
}

module.exports = { requestTopUp, getTransactionStatus };
