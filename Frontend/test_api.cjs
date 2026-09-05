const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'owner@demo-agency.com',
      password: 'Owner@1234!'
    });
    const token = res.data.data.accessToken;
    const policiesRes = await axios.get('http://localhost:3000/api/v1/policies?limit=2000', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('Policies API Response keys:', Object.keys(policiesRes.data));
    console.log('Is policiesRes.data.data an array?', Array.isArray(policiesRes.data.data));
    console.log('policiesRes.data.data length:', policiesRes.data.data?.length);
    if(policiesRes.data.data?.length === 0) {
       console.log('Raw response:', JSON.stringify(policiesRes.data));
    }
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
})();
