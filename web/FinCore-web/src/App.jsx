import React, { useState } from 'react';
import Login from './components/Login';
import AnalystReviewPage from './pages/AnalystReviewPage';

function App() {
  const [view, setView] = useState('login');

  return (
    <div style={{ width: '100%', minHeight: '100vh', margin: 0, padding: 0 }}>
      <div style={{ backgroundColor: '#0A1128', color: '#FFF', padding: '12px 24px', display: 'flex', gap: '16px', alignItems: 'center', borderBottom: '1px solid #1E293B' }}>
        <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#0066FF' }}>FC FinCore</span>
        <button
          onClick={() => setView('login')}
          style={{
            padding: '6px 16px',
            backgroundColor: view === 'login' ? '#0066FF' : '#1E293B',
            color: '#FFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Login Page
        </button>
        <button
          onClick={() => setView('dashboard')}
          style={{
            padding: '6px 16px',
            backgroundColor: view === 'dashboard' ? '#0066FF' : '#1E293B',
            color: '#FFF',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Analyst Review Dashboard
        </button>
      </div>

      {view === 'login' ? <Login /> : <AnalystReviewPage />}
    </div>
  );
}

export default App;