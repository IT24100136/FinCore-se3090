const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log("=== Checking Multi-Agent System on port 8000 ===");

  // 1. Health check
  const health = await get('http://localhost:8000/health');
  console.log("Health Status:", health.status, health.data);

  // 2. Test low-risk transaction
  console.log("\n--- Test Low-Risk Transaction ($2,500 Grocery) ---");
  const lowRisk = await post('http://localhost:8000/api/agents/evaluate', {
    transaction_id: "TX-TEST-LOW",
    user_id: "USR-1001",
    amount: 2500.0,
    recipient_id: "WLT-5555",
    note: "Supermarket groceries",
    ip_address: "127.0.0.1",
    device_id: "device_iphone_trusted_01",
    velocity_24h: 1
  });
  console.log("Decision:", lowRisk.data.decision, "Status:", lowRisk.data.status, "Composite Score:", lowRisk.data.composite_risk_score);
  console.log("Agent 1 (Spending Profile):", lowRisk.data.agent_1.status, "Score:", lowRisk.data.agent_1.final_risk_score);
  console.log("Agent 2 (Anomaly Signals):", lowRisk.data.agent_2.flagged_signals);
  console.log("Agent 3 (Resolution):", lowRisk.data.agent_3.resolution_path);

  // 3. Test high-risk / impossible travel transaction
  console.log("\n--- Test High-Risk Transaction (Impossible Travel + Large Amount $85,000) ---");
  const highRisk = await post('http://localhost:8000/api/agents/evaluate', {
    transaction_id: "TX-TEST-HIGH",
    user_id: "USR-1001",
    amount: 85000.0,
    recipient_id: "WLT-9999",
    note: "Urgent crypto wire transfer",
    ip_address: "185.220.101.5", // Tor exit node / unknown IP
    device_id: "unknown_hacker_device_99",
    velocity_24h: 8,
    prev_tx_lat: 6.9271, // Colombo, Sri Lanka
    prev_tx_lon: 79.8612,
    prev_tx_timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    current_lat: 51.5074, // London, UK (~8,700 km away in 30 minutes! Speed > 17,000 km/h)
    current_lon: -0.1278,
    current_timestamp: new Date().toISOString()
  });
  console.log("Decision:", highRisk.data.decision, "Status:", highRisk.data.status, "Composite Score:", highRisk.data.composite_risk_score);
  console.log("Reasons Flagged:", highRisk.data.reasons);
  console.log("Primary SHAP Feature:", highRisk.data.primary_shap_feature);
  console.log("Agent 3 Priority:", highRisk.data.agent_3.priority_label, "Requires Human Approval:", highRisk.data.requires_human_approval);
  console.log("Agent 4 Side Effect (Notification):", highRisk.data.agent_4);

  // 4. Test SHAP Direct Explainability
  console.log("\n--- Test SHAP Direct Explainer ---");
  const shapRes = await post('http://localhost:8000/api/fraud/explain', {
    transaction_id: "TX-TEST-HIGH",
    features: {
      amount: 85000.0,
      tx_count_24h: 8,
      ip_distance_km: 8700.0,
      is_new_device: 1
    }
  });
  console.log("SHAP Primary Reason:", shapRes.data.primary_reason);
  console.log("Top SHAP Contributions:", shapRes.data.shap_values ? Object.entries(shapRes.data.shap_values).slice(0, 3) : "N/A");
}

run().catch(console.error);
