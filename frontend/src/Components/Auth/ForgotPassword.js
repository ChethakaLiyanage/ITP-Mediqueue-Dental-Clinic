import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const res = await axios.post('http://localhost:5000/forgot-password', { email });
    if (res.data?.status === 'ok') {
      setSent(true);
      // dev: show token so user can proceed to reset without email service
      if (res.data.token) setToken(res.data.token);
    } else {
      alert('Unable to process');
    }
  };

  const goReset = () => navigate(`/reset-password${token ? `?token=${token}` : ''}`);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b1220' }}>
      <div style={{ width: 420, background: '#121c2b', padding: 24, borderRadius: 8, color: '#fff' }}>
        <h2>Forgot Password</h2>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input style={{ width: '100%', margin: '8px 0 16px', padding: 10 }} id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button style={{ width: '100%', background: '#1d4ed8', color: '#fff', padding: 10, border: 'none', borderRadius: 4 }}>Send Reset Link</button>
        </form>
        {sent && (
          <div style={{ marginTop: 12 }}>
            <p>Reset instructions sent if the email exists.</p>
            {token && (
              <>
                <p>Dev token: <code style={{ background: '#0b1220', padding: 4 }}>{token}</code></p>
                <button onClick={goReset} style={{ marginTop: 8, background: 'transparent', border: '1px solid #60a5fa', color: '#60a5fa', padding: '8px 12px', borderRadius: 6 }}>Continue to Reset</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

