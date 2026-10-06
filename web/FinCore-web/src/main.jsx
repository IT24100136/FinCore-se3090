import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// Configure API Base URL for deployed environments (e.g. Render backend)
const apiBaseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl.replace(/\/+$/, '');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
