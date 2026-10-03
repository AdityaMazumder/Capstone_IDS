const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'api', 'mocks');
fs.mkdirSync(dir, { recursive: true });

const now = Math.floor(Date.now() / 1000);

// 1. metrics.json
fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify({
  total_flows_analyzed: 12500,
  total_threats_detected: 42,
  active_firewall_blocks: 0,
  average_threat_risk: 7.2,
  attack_distribution: {
    "DDoS": 12,
    "PortScan": 15,
    "SSH-Bruteforce": 10,
    "Stealer": 5
  },
  top_offenders: [
    { src_ip: "45.33.1.2", incident_count: 8, max_risk_score: 9.1, attack_types: ["SSH-Bruteforce"], last_seen: now - 100 }
  ]
}));

// 2. incidents.json
const incidents = [];
for(let i=0; i<15; i++) {
  incidents.push({
    incident_id: `net-${i}`,
    timestamp: now - i * 3600,
    src_ip: `45.33.${i}.1`,
    dst_ip: "192.168.1.100",
    src_port: 40000 + i,
    dst_port: 22,
    protocol: 6,
    attack_type: i % 2 === 0 ? "SSH-Bruteforce" : "PortScan",
    confidence: 0.95,
    risk_score: 8.0,
    severity: i % 3 === 0 ? "CRITICAL" : "HIGH",
    action_taken: "TEMP_BAN_IP",
    mitre_technique_id: "T1110",
    mitre_technique_name: "Brute Force",
    explanation: "Multiple failed login attempts detected.",
    raw_json: "{}",
    status: "NEW"
  });
}
fs.writeFileSync(path.join(dir, 'incidents.json'), JSON.stringify({
  count: 15,
  incidents
}));

// 3. incident_detail
fs.writeFileSync(path.join(dir, 'incidents_net-0.json'), JSON.stringify({
  incident_id: "net-0",
  timestamp: now,
  status: "NEW",
  flow: { src_ip: "45.33.1.1", dst_ip: "192.168.1.100", src_port: 45678, dst_port: 22, protocol: 6, flow_duration: 120 },
  detection: { attack_type: "SSH-Bruteforce", confidence: 0.98, probabilities: {"SSH-Bruteforce": 0.98}, ml_attack_type: "SSH-Bruteforce", policy_applied: "Block High Risk", policy_reason: "Score > 7", inference_time_ms: 12 },
  threat: { indicators: [], anomaly_explanation: "High rate of SYN packets", mitre_technique_id: "T1110.001", mitre_technique_name: "Password Guessing", mitre_tactic: "Credential Access" },
  risk: { score: 8.5, severity: "CRITICAL", rationale: "Known malicious IP", frequency_count_60s: 50 },
  action_plan: { action_type: "TEMP_BAN_IP", target_ip: "45.33.1.1", ban_duration_seconds: 86400, priority: 1, rationale: "Stop bruteforce" },
  firewall_rule: { rule_id: "rule-1", target_ip: "45.33.1.1", status: "SIMULATED", expires_at: now + 86400 },
  llm_explanation: {
    summary: "An outside computer (45.33.1.1) tried to log in to your computer's remote access 50 times in one minute, trying different passwords.",
    technical_analysis: "High volume of TCP port 22 connections with failed auth.",
    mitre_context: "T1110.001",
    soc_recommendations: ["Use a strong, unique password.", "Turn off remote login if you don't use it."],
    provider: "local"
  }
}));

fs.writeFileSync(path.join(dir, 'incidents_net-1.json'), JSON.stringify({
  incident_id: "net-1",
  timestamp: now - 3600,
  status: "NEW",
  flow: { src_ip: "45.33.1.2", dst_ip: "192.168.1.100", src_port: 45679, dst_port: 80, protocol: 6, flow_duration: 10 },
  detection: { attack_type: "PortScan", confidence: 0.85, probabilities: {"PortScan": 0.85}, ml_attack_type: "PortScan", policy_applied: "Log Only", policy_reason: "Score < 5", inference_time_ms: 10 },
  threat: { indicators: [], anomaly_explanation: "Scanning multiple ports", mitre_technique_id: "T1046", mitre_technique_name: "Network Service Discovery", mitre_tactic: "Discovery" },
  risk: { score: 4.0, severity: "LOW", rationale: "Reconnaissance activity", frequency_count_60s: 100 },
  action_plan: { action_type: "LOG_ONLY", target_ip: "45.33.1.2", ban_duration_seconds: 0, priority: 0, rationale: "Monitor only" },
  firewall_rule: null,
  llm_explanation: null
}));

// 4. host_incidents.json
fs.writeFileSync(path.join(dir, 'host_incidents.json'), JSON.stringify({
  count: 3,
  host_incidents: [
    {
      incident_id: "host-1", timestamp: now - 600, hostname: "LAPTOP-123", pid: 5892, process_name: "svc_update.exe", parent_name: "powershell.exe",
      cpu_percent: 5.2, memory_mb: 45.0, file_path: "C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Login Data",
      file_type: "Saved Passwords", event_type: "MODIFY", classification: "Stealer", confidence: 0.9, risk_score: 9.2, severity: "CRITICAL",
      mitre_technique_id: "T1555.003", mitre_technique_name: "Credentials from Web Browsers", soar_action: "TERMINATE_PROCESS", action_status: "SUCCESS",
      remediation_notes: "Killed successfully.", raw_json: JSON.stringify({
        llm_explanation: { soc_recommendations: ["Change the passwords saved in your browser."] }, anomaly_score: 0.92, mitre_tactic: "Credential Access", process: { exe_path: "C:\\temp\\svc.exe" }, file_event: { target_browser: "Chrome" }
      })
    },
    {
      incident_id: "host-2", timestamp: now - 7200, hostname: "LAPTOP-123", pid: 1234, process_name: "unknown.exe", parent_name: "explorer.exe",
      cpu_percent: 1.0, memory_mb: 10.0, file_path: "C:\\wallet.dat",
      file_type: "Crypto Wallet", event_type: "READ", classification: "Stealer", confidence: 0.8, risk_score: 8.5, severity: "HIGH",
      mitre_technique_id: "T1555", mitre_technique_name: "Credentials from Password Stores", soar_action: "TERMINATE_PROCESS", action_status: "SIMULATED",
      remediation_notes: "Would have killed.", raw_json: JSON.stringify({
        llm_explanation: null, anomaly_score: 0.85, mitre_tactic: "Credential Access", process: { exe_path: "C:\\unknown.exe" }, file_event: { target_browser: "Unknown" }
      })
    },
    {
      incident_id: "host-3", timestamp: now - 86400, hostname: "LAPTOP-123", pid: 4, process_name: "System", parent_name: "",
      cpu_percent: 0.1, memory_mb: 1.0, file_path: "C:\\cookies",
      file_type: "Cookies", event_type: "READ", classification: "AnomalousTraffic", confidence: 0.5, risk_score: 4.0, severity: "LOW",
      mitre_technique_id: "T1000", mitre_technique_name: "Test", soar_action: "ALERT_ONLY", action_status: "SUCCESS",
      remediation_notes: "System process, ignored.", raw_json: JSON.stringify({})
    }
  ]
}));

// 5. blocks.json
fs.writeFileSync(path.join(dir, 'blocks.json'), JSON.stringify({
  count: 3,
  blocked_ips: [
    { rule_id: "r1", ip_address: "45.33.1.1", direction: "inbound", block_timestamp: now - 3600, expiry_timestamp: now + 82800, reason: "SSH Bruteforce", status: "ACTIVE", command_executed: "netsh advfirewall..." },
    { rule_id: "r2", ip_address: "45.33.1.2", direction: "inbound", block_timestamp: now - 7200, expiry_timestamp: now + 79200, reason: "Port Scan", status: "SIMULATED", command_executed: "netsh advfirewall..." },
    { rule_id: "r3", ip_address: "10.0.0.5", direction: "inbound", block_timestamp: now - 86400, expiry_timestamp: null, reason: "Manual Ban", status: "ACTIVE", command_executed: "netsh advfirewall..." }
  ]
}));

// 6. status.json
fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({
  timestamp: now, total_flows: 12500, total_threats: 42, total_blocked_ips: 3, total_alerts: 45, active_firewall_rules: 3,
  cpu_percent: 15.0, memory_percent: 45.0, uptime_seconds: 36000,
  agent_statuses: {
    "detection_agent": "PROCESSING",
    "threat_agent": "IDLE",
    "risk_agent": "ERROR",
    "decision_agent": "IDLE",
    "firewall_agent": "IDLE",
    "host_agent": "IDLE"
  }
}));

console.log("Mocks generated successfully.");
