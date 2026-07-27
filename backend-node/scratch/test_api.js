const https = require('https');

const data = JSON.stringify({
  username: 'admin',
  password: 'adminpass'
});

const options = {
  hostname: 'leoni-abs-abr2.vercel.app',
  port: 443,
  path: '/api/auth/login/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, res => {
  let body = '';
  console.log(`Status Code: ${res.statusCode}`);
  res.on('data', chunk => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Response body:', body);
  });
});

req.on('error', error => {
  console.error('Request Error:', error);
});

req.write(data);
req.end();
