const crypto = require('crypto');
const https = require('https');

const webhookSecret = "FluteSecureWebhook2026!";
const url = "https://www.digvijaychauhan.com/api/payment/webhook";

const payload = {
  entity: "event",
  account_id: "acc_live_fake",
  event: "payment.captured",
  contains: ["payment"],
  payload: {
    payment: {
      entity: {
        id: "pay_fake123",
        amount: 100,
        currency: "INR",
        status: "captured",
        notes: {
          user_id: "fake-user-id-to-test-failure",
          course_id: "fake-course-id"
        }
      }
    }
  },
  created_at: Math.floor(Date.now() / 1000)
};

const rawBody = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': signature,
    'Content-Length': Buffer.byteLength(rawBody)
  }
};

console.log("Sending simulated webhook to: " + url);

const req = https.request(url, options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log("STATUS CODE:", res.statusCode);
    console.log("RESPONSE BODY:", responseData);
  });
});

req.on('error', (e) => {
  console.error("ERROR:", e.message);
});

req.write(rawBody);
req.end();
