import React from 'react';
import DeviceHistory from './pages/admin/DeviceHistory';
import Login from './components/Login';

function App() {
  return (
    <div>
      <h1>FinCore Test</h1>
      <Login />
      <hr style={{ margin: '20px 0' }} />
      {/* Passing 1 to match the dummy database record */}
      <DeviceHistory userId={1} /> 
    </div>
  );
}

export default App;