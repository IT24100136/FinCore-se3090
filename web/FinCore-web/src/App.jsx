import React from 'react';
import DeviceHistory from './pages/admin/DeviceHistory';

function App() {
  return (
    <div>
      <h1>FinCore Test</h1>
      {/* Passing 1 to match the dummy database record */}
      <DeviceHistory userId={1} /> 
    </div>
  );
}

export default App;