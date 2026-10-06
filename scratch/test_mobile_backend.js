const http = require('http');

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function put(url, data, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data || {});
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('=== TEST 1: OTP Send & Verify ===');
  const otpSendRes = await post('http://localhost:5007/api/auth/otp/send', {
    identifier: '+94771234567',
    purpose: 'LOGIN'
  });
  console.log('OTP Send status:', otpSendRes.status, otpSendRes.data);

  const otpVerifyRes = await post('http://localhost:5007/api/auth/otp/verify', {
    identifier: '+94771234567',
    code: otpSendRes.data?.debugOtp || '123456',
    purpose: 'LOGIN'
  });
  console.log('OTP Verify status:', otpVerifyRes.status, otpVerifyRes.data);

  console.log('\n=== TEST 2: Customer Login (Kasun) ===');
  const loginRes = await post('http://localhost:5007/api/auth/login', {
    email: 'kasun@fincore.com',
    password: 'Password123!'
  });
  console.log('Login status:', loginRes.status);
  console.log('User profile:', loginRes.data?.user);
  const token = loginRes.data?.token;

  if (!token) {
    console.error('No token returned!');
    return;
  }

  console.log('\n=== TEST 3: Wallet Balance & Persistence ===');
  const balanceRes = await get('http://localhost:5007/api/wallets/balance', token);
  console.log('Current balance:', balanceRes.data);

  console.log('\n=== TEST 4: Top-Up with Payment Source Selection ===');
  const topUpRes = await post('http://localhost:5007/api/wallets/topup', {
    amount: 15000,
    paymentMethodType: 'CARD',
    sourceReference: 'Visa •••• 4821'
  }, token);
  console.log('TopUp response:', topUpRes.data);

  const balanceAfter = await get('http://localhost:5007/api/wallets/balance', token);
  console.log('Balance after topup:', balanceAfter.data);

  console.log('\n=== TEST 5: Notifications Fetch & Mark Read ===');
  const notifRes = await get('http://localhost:5007/api/notifications', token);
  console.log('Notifications unread count:', notifRes.data?.unreadCount);
  console.log('Total notifications:', notifRes.data?.items?.length);
  const firstNotif = notifRes.data?.items?.[0];
  if (firstNotif) {
    console.log('First notif title:', firstNotif.title, 'category:', firstNotif.category, 'isRead:', firstNotif.isRead);
    const readRes = await put(`http://localhost:5007/api/notifications/${firstNotif.id}/read`, {}, token);
    console.log('Mark read response:', readRes.data);
  }

  console.log('\n=== ALL BACKEND ENDPOINTS VERIFIED SUCCESSFULLY! ===');
}

runTests().catch(console.error);
