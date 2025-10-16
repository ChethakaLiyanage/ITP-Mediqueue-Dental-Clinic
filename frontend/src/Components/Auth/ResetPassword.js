import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return alert('Passwords do not match');
    const res = await axios.post('http://localhost:5000/reset-password', { token, password });
    if (res.data?.status === 'ok') {
      alert('Password reset successful. Please login.');
      navigate('/login');
    } else {
      alert(res.data?.message || 'Reset failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b1220' }}>
      <div style={{ width: 420, background: '#121c2b', padding: 24, borderRadius: 8, color: '#fff' }}>
        <h2>Reset Password</h2>
        <form onSubmit={submit}>
          <label htmlFor="token">Token</label>
          <input style={{ width: '100%', margin: '8px 0 12px', padding: 10 }} id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
          <label htmlFor="password">New Password</label>
          <input style={{ width: '100%', margin: '8px 0 12px', padding: 10 }} id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <label htmlFor="confirm">Confirm Password</label>
          <input style={{ width: '100%', margin: '8px 0 16px', padding: 10 }} id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <button style={{ width: '100%', background: '#1d4ed8', color: '#fff', padding: 10, border: 'none', borderRadius: 4 }}>Reset Password</button>
        </form>
      </div>
    </div>
  );
}

