async function testSuperAdmin() {
  const BASE_URL = 'http://127.0.0.1:3000/api/v1';
  console.log('Testing SuperAdmin Login...');
  try {
    const res = await fetch(`${BASE_URL}/superadmin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'insumitra@gmail.com',
        password: 'insumitra@123'
      })
    });
    console.log('Login Response Status:', res.status);
    const data = await res.json() as any;
    console.log('Login Response Body:', JSON.stringify(data, null, 2));

    if (data.data?.accessToken) {
      console.log('Testing GET /superadmin/auth/me ...');
      const meRes = await fetch(`${BASE_URL}/superadmin/auth/me`, {
        headers: {
          'Authorization': `Bearer ${data.data.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('GetMe Status:', meRes.status);
      const meData = await meRes.json();
      console.log('GetMe Body:', JSON.stringify(meData, null, 2));
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

testSuperAdmin();
