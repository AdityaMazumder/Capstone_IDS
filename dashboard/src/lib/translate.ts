export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export function getSeverityStyle(severity: Severity) {
  switch (severity) {
    case 'CRITICAL': return { label: 'Critical: act now', color: 'text-red-600', icon: 'ShieldAlert' };
    case 'HIGH': return { label: 'Serious', color: 'text-orange-500', icon: 'AlertTriangle' };
    case 'MEDIUM': return { label: 'Worth a look', color: 'text-amber-400', icon: 'AlertCircle' };
    case 'LOW': return { label: 'Minor', color: 'text-sky-500', icon: 'Info' };
    default: return { label: 'Unknown', color: 'text-slate-400', icon: 'Info' };
  }
}

export function formatRiskScore(score: number) {
  let word = 'Low';
  if (score >= 8.5) word = 'Critical';
  else if (score >= 7.0) word = 'High';
  else if (score >= 5.0) word = 'Moderate';
  
  return `${score.toFixed(1)} / 10, ${word}`;
}

export function getThreatDetails(raw: string) {
  const type = raw.toLowerCase();
  if (['benign', 'normal'].includes(type)) return { name: 'Normal activity', desc: 'Regular, safe traffic.', action: null };
  if (type === 'ddos') return { name: 'Flood attack', desc: 'Many computers sending junk traffic at once to make your internet or service crash.', action: 'Nothing to do. We blocked the sources. If your internet stays slow, restart your router.' };
  if (type === 'dos') return { name: 'Overload attack', desc: 'One computer flooding yours to slow it down or crash it.', action: 'Nothing to do. We blocked the sources. If your internet stays slow, restart your router.' };
  if (type === 'botnet') return { name: 'Hijacked-device activity', desc: "A device may be under a hacker's remote control.", action: 'Run a full antivirus scan on this computer.' };
  if (type === 'ssh-bruteforce') return { name: 'Password-guessing attack (remote login)', desc: 'Someone kept trying passwords to log in to your computer remotely.', action: "Use a strong, unique password. Turn off remote login if you don't use it." };
  if (type === 'ftp-bruteforce') return { name: 'Password-guessing attack (file sharing)', desc: 'Someone kept trying passwords on your file-sharing service.', action: "Use strong passwords. Turn off FTP if you don't use it." };
  if (type === 'bruteforce') return { name: 'Password-guessing attack', desc: 'Repeated password guessing.', action: "Use a strong, unique password. Turn off remote login if you don't use it." };
  if (type === 'portscan') return { name: 'Someone checking for open doors', desc: 'An outsider was probing your computer to find a way in.', action: 'Nothing to do. This is often the first step of an attack, and we blocked it.' };
  if (type === 'infiltration') return { name: 'Break-in attempt', desc: 'Someone tried to exploit a weakness to get in.', action: 'Update Windows and your apps.' };
  if (type === 'webattack') return { name: 'Website attack', desc: 'Someone tried to trick a web service you run.', action: 'Update your web software.' };
  if (type === 'anomaloustraffic') return { name: 'Unusual activity', desc: "Traffic that doesn't look normal, but doesn't match a known attack.", action: 'Keep an eye on it. No action yet.' };
  if (type === 'stealer' || type === 'infostealer') return { name: 'Password-stealing program', desc: 'A program secretly opened your saved passwords or login cookies.', action: 'Change your saved passwords, sign out of all sessions, run antivirus.' };
  if (type === 'ransomware') return { name: 'Ransomware (file-locking program)', desc: 'A program tried to lock your files to demand money.', action: 'Disconnect from the internet and contact IT support.' };
  if (type === 'malware') return { name: 'Harmful program', desc: 'A program behaving like malware.', action: 'Run a full antivirus scan.' };
  return { name: 'Suspicious activity', desc: 'Something unusual was detected.', action: 'Review the details or ask IT support.' };
}

export function translateNetworkAction(action: string, duration?: string) {
  switch (action) {
    case 'BLOCK_IP': return `Blocked this address${duration ? ' ' + duration : ''}`;
    case 'TEMP_BAN_IP': return `Blocked temporarily${duration ? ' ' + duration : ''}`;
    case 'RATE_LIMIT': return 'Slowed this address down';
    case 'ALERT_ONLY': return 'Warned you, no automatic action';
    case 'LOG_ONLY': return 'Noted for the record, no action needed';
    case 'IGNORE': return 'Ignored (trusted)';
    default: return action;
  }
}

export function translateComputerAction(action: string) {
  switch (action) {
    case 'TERMINATE_PROCESS': return 'Stopped the program';
    case 'SUSPEND_PROCESS': return 'Paused the program';
    case 'QUARANTINE_FILE': return 'Moved the file to a safe place';
    case 'ALERT_ONLY': return "Warned you (a system program was involved, so we didn't stop it for safety)";
    case 'LOG_ONLY': return 'Noted for the record';
    default: return action;
  }
}

export function translateComputerActionStatus(status: string) {
  if (status.includes('SUCCESS')) return { label: 'Done', color: 'text-emerald-500' };
  if (status.includes('SIMULATED')) return { label: 'Test mode: would have done this', color: 'text-blue-500' };
  if (status.includes('FAILED')) return { label: "Couldn't complete. Please act.", color: 'text-red-500' };
  if (status.includes('PENDING')) return { label: 'In progress', color: 'text-slate-500' };
  if (status.includes('ALERT_DISPATCHED')) return { label: 'Alert sent', color: 'text-amber-500' };
  return { label: status, color: 'text-slate-500' };
}
