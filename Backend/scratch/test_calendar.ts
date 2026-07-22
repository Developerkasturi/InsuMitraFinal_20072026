import axios from 'axios';

async function testCalendar() {
  const BASE_URL = 'https://insumitrafinal-20072026.onrender.com/api/v1';
  console.log('Testing Owner Login...');
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'owner@demo.agency.com',
      password: 'owner@123'
    });
    console.log('Login Response Status:', res.status);
    const data = res.data;
    console.log('Login Response Body:', JSON.stringify(data, null, 2));

    const token = data.data?.accessToken;
    if (token) {
      console.log('Testing GET /calendar ...');
      const start = new Date(2026, 5, 1).toISOString();
      const end = new Date(2026, 6, 1).toISOString();
      const calRes = await axios.get(`${BASE_URL}/calendar`, {
        params: {
          startDate: start,
          endDate: end
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('GetEvents Status:', calRes.status);
      console.log('GetEvents Body:', JSON.stringify(calRes.data, null, 2));
    }
  } catch (err: any) {
    if (err.response) {
      console.error('Error Status:', err.response.status);
      console.error('Error Body:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
  }
}

testCalendar();
