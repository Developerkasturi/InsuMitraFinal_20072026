const http = require('http');

function request(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function testCalendar() {
  console.log('Testing Owner Login via http...');
  try {
    const loginBody = JSON.stringify({
      email: 'owner@demo-agency.com',
      password: 'Owner@1234!'
    });

    const loginRes = await request('https://insumitrafinal-20072026.onrender.com/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginBody)
      }
    }, loginBody);

    console.log('Login Status:', loginRes.status);
    console.log('Login Body:', loginRes.data);

    const loginData = JSON.parse(loginRes.data);
    const token = loginData.data?.accessToken;
    if (token) {
      console.log('Testing GET /calendar with NO params ...');
      const calRes = await request(`https://insumitrafinal-20072026.onrender.com/api/v1/calendar`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('GetEvents Status:', calRes.status);
      console.log('GetEvents Body:', calRes.data);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testCalendar();
