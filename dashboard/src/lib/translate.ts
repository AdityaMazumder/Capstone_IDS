/**
 * SentinelAI Translation Layer
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * EVERY raw backend value goes through this file.
 * No component may render a raw backend code.
 */

// â”€â”€ 6.1 Threat Types â”€â”€

interface ThreatInfo {
  friendlyName: string;
  explanation: string;
  advice: string;
  icon: string; // lucide icon name
}

const THREAT_MAP: Record<string, ThreatInfo> = {
  benign:         { friendlyName: 'Normal activity', explanation: 'Regular, safe traffic.', advice: '', icon: 'CheckCircle' },
  normal:         { friendlyName: 'Normal activity', explanation: 'Regular, safe traffic.', advice: '', icon: 'CheckCircle' },
  ddos:           { friendlyName: 'Flood attack', explanation: 'Many computers sending junk traffic at once to make your internet or service crash.', advice: "Nothing to do. We blocked the sources. If your internet stays slow, restart your router.", icon: 'Waves' },
  dos:            { friendlyName: 'Overload attack', explanation: 'One computer flooding yours to slow it down or crash it.', advice: "Nothing to do. We blocked the source. If your internet stays slow, restart your router.", icon: 'Waves' },
  botnet:         { friendlyName: 'Hijacked-device activity', explanation: 'A device may be under a hacker\'s remote control.', advice: 'Run a full antivirus scan on this computer.', icon: 'Bug' },
  'ssh-bruteforce': { friendlyName: 'Password-guessing attack (remote login)', explanation: 'Someone kept trying passwords to log in to your computer remotely.', advice: "Use a strong, unique password. Turn off remote login if you don't use it.", icon: 'KeyRound' },
  'ftp-bruteforce': { friendlyName: 'Password-guessing attack (file sharing)', explanation: 'Someone kept trying passwords on your file-sharing service.', advice: "Use strong passwords. Turn off FTP if you don't use it.", icon: 'KeyRound' },
  bruteforce:     { friendlyName: 'Password-guessing attack', explanation: 'Repeated password guessing.', advice: 'Use strong passwords and enable two-factor authentication.', icon: 'KeyRound' },
  portscan:       { friendlyName: 'Someone checking for open doors', explanation: 'An outsider was probing your computer to find a way in.', advice: "Nothing to do. This is often the first step of an attack, and we blocked it.", icon: 'Search' },
  infiltration:   { friendlyName: 'Break-in attempt', explanation: 'Someone tried to exploit a weakness to get in.', advice: 'Update Windows and your apps.', icon: 'ShieldAlert' },
  webattack:      { friendlyName: 'Website attack', explanation: 'Someone tried to trick a web service you run.', advice: 'Update your web software.', icon: 'Globe' },
  anomaloustraffic: { friendlyName: 'Unusual activity', explanation: "Traffic that doesn't look normal, but doesn't match a known attack.", advice: 'Keep an eye on it. No action yet.', icon: 'AlertCircle' },
  stealer:        { friendlyName: 'Password-stealing program', explanation: 'A program secretly opened your saved passwords or login cookies.', advice: 'Change your saved passwords, sign out of all sessions, run antivirus.', icon: 'KeyRound' },
  infostealer:    { friendlyName: 'Password-stealing program', explanation: 'A program secretly opened your saved passwords or login cookies.', advice: 'Change your saved passwords, sign out of all sessions, run antivirus.', icon: 'KeyRound' },
  ransomware:     { friendlyName: 'Ransomware (file-locking program)', explanation: 'A program tried to lock your files to demand money.', advice: 'Disconnect from the internet and contact IT support.', icon: 'Lock' },
  malware:        { friendlyName: 'Harmful program', explanation: 'A program behaving like malware.', advice: 'Run a full antivirus scan.', icon: 'Bug' },
};

const DEFAULT_THREAT: ThreatInfo = {
  friendlyName: 'Suspicious activity',
  explanation: 'Something unusual was detected.',
  advice: 'Review the details or ask IT support.',
  icon: 'AlertTriangle',
};

export function translateThreat(raw: string | null | undefined): ThreatInfo {
  if (!raw) return DEFAULT_THREAT;
  const key = raw.toLowerCase().replace(/[\s_-]+/g, '').replace('bruteforce', 'bruteforce');
  // Try direct match
  for (const [k, v] of Object.entries(THREAT_MAP)) {
    if (k.replace(/[\s_-]+/g, '') === key) return v;
  }
  // Try partial match
  for (const [k, v] of Object.entries(THREAT_MAP)) {
    if (key.includes(k.replace(/[\s_-]+/g, ''))) return v;
  }
  return DEFAULT_THREAT;
}

export function isBenign(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return lower === 'benign' || lower === 'normal';
}

// â”€â”€ 6.2 Severity â”€â”€

export interface SeverityInfo {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: string;
}

const SEVERITY_MAP: Record<string, SeverityInfo> = {
  critical: { label: 'Critical: act now', color: 'text-critical', bgColor: 'bg-critical-bg', textColor: 'text-red-700', icon: 'ShieldAlert' },
  high:     { label: 'Serious', color: 'text-high', bgColor: 'bg-high-bg', textColor: 'text-orange-700', icon: 'AlertTriangle' },
  medium:   { label: 'Worth a look', color: 'text-medium', bgColor: 'bg-medium-bg', textColor: 'text-amber-700', icon: 'AlertCircle' },
  low:      { label: 'Minor', color: 'text-low', bgColor: 'bg-low-bg', textColor: 'text-sky-700', icon: 'Info' },
};

export function translateSeverity(raw: string | null | undefined): SeverityInfo {
  if (!raw) return SEVERITY_MAP.low;
  return SEVERITY_MAP[raw.toLowerCase()] ?? SEVERITY_MAP.low;
}

// â”€â”€ 6.3 Risk Score â”€â”€

export function riskToWord(score: number): { label: string; color: string } {
  if (score >= 8.5) return { label: 'Critical', color: 'text-critical' };
  if (score >= 7.0) return { label: 'High', color: 'text-high' };
  if (score >= 5.0) return { label: 'Moderate', color: 'text-medium' };
  return { label: 'Low', color: 'text-low' };
}

export function formatRisk(score: number): string {
  const { label } = riskToWord(score);
  return `${score.toFixed(1)} / 10, ${label}`;
}

// â”€â”€ 6.4 Network Actions â”€â”€

export function translateNetworkAction(raw: string | null | undefined, durationSeconds?: number | null): string {
  if (!raw) return 'No action recorded';
  const dur = durationSeconds ? ` for ${formatDuration(durationSeconds)}` : '';
  switch (raw.toUpperCase()) {
    case 'BLOCK_IP':     return `Blocked this address${dur}`;
    case 'TEMP_BAN_IP':  return `Blocked temporarily${dur}`;
    case 'RATE_LIMIT':   return 'Slowed this address down';
    case 'ALERT_ONLY':   return 'Warned you, no automatic action';
    case 'LOG_ONLY':     return 'Noted for the record, no action needed';
    case 'IGNORE':       return 'Ignored (trusted)';
    default:             return 'Action taken';
  }
}

// â”€â”€ 6.5 Computer Actions â”€â”€

export function translateHostAction(raw: string | null | undefined): string {
  if (!raw) return 'No action recorded';
  switch (raw.toUpperCase()) {
    case 'TERMINATE_PROCESS': return 'Stopped the program';
    case 'SUSPEND_PROCESS':   return 'Paused the program';
    case 'QUARANTINE_FILE':   return 'Moved the file to a safe place';
    case 'ALERT_ONLY':        return 'Warned you (a system program was involved, so we didn\'t stop it for safety)';
    case 'LOG_ONLY':          return 'Noted for the record';
    default:                  return 'Action taken';
  }
}

export function translateActionStatus(raw: string | null | undefined): { label: string; color: string; bgColor: string } {
  if (!raw) return { label: 'Unknown', color: 'text-muted', bgColor: 'bg-slate-100' };
  const upper = raw.toUpperCase();
  if (upper.includes('SUCCESS'))          return { label: 'Done', color: 'text-safe', bgColor: 'bg-safe-bg' };
  if (upper.includes('SIMULATED'))        return { label: 'Test mode: would have done this', color: 'text-brand', bgColor: 'bg-indigo-50' };
  if (upper.includes('FAILED'))           return { label: "Couldn't complete. Please act.", color: 'text-critical', bgColor: 'bg-critical-bg' };
  if (upper.includes('PENDING'))          return { label: 'In progress', color: 'text-muted', bgColor: 'bg-slate-100' };
  if (upper.includes('ALERT_DISPATCHED')) return { label: 'Alert sent', color: 'text-medium', bgColor: 'bg-medium-bg' };
  return { label: raw, color: 'text-muted', bgColor: 'bg-slate-100' };
}

// â”€â”€ 6.6 Firewall Rule Status â”€â”€

export function translateFirewallStatus(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  switch (raw.toUpperCase()) {
    case 'ACTIVE':    return 'Blocked';
    case 'SIMULATED': return 'Test mode';
    case 'RELEASED':  return 'Unblocked';
    case 'FAILED':    return "Couldn't block";
    default:          return raw;
  }
}

// â”€â”€ 6.7 Protected Files â”€â”€

export function translateFileType(fileType: string | null | undefined, filePath: string | null | undefined): string {
  const check = (fileType || filePath || '').toLowerCase();
  
  const browser = detectBrowser(filePath);
  const browserName = browser ? ` ${browser}` : ' browser';

  if (check.includes('login data') || check.includes('logins.json') || check.includes('saved passwords'))
    return `Your saved${browserName} passwords`;
  if (check.includes('key4.db'))
    return "Firefox's password key";
  if (check.includes('cookies') || check.includes('cookiedb'))
    return `Your login sessions (cookies that keep you signed in to${browserName})`;
  if (check.includes('local state'))
    return `Your${browserName} master encryption key`;
  if (check.includes('web data') || check.includes('autofill'))
    return `Your autofill data and saved cards`;
  if (check.includes('wallet.dat'))
    return 'Your crypto wallet';
  
  return fileType || 'A sensitive file';
}

function detectBrowser(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const lower = filePath.toLowerCase();
  if (lower.includes('google') && lower.includes('chrome')) return 'Chrome';
  if (lower.includes('microsoft') && lower.includes('edge')) return 'Edge';
  if (lower.includes('bravesoftware')) return 'Brave';
  if (lower.includes('mozilla') && lower.includes('firefox')) return 'Firefox';
  return null;
}

// â”€â”€ 6.8 Ports and Protocols â”€â”€

const PORT_NAMES: Record<number, string> = {
  22: 'remote login (SSH)',
  21: 'file sharing (FTP)',
  3389: 'Remote Desktop',
  445: 'Windows file sharing',
  80: 'website (HTTP)',
  443: 'secure website (HTTPS)',
  3306: 'database (MySQL)',
  5432: 'database (PostgreSQL)',
  1433: 'database (SQL Server)',
  8080: 'web application',
};

export function translatePort(port: number): string {
  return PORT_NAMES[port] || `port ${port}`;
}

const PROTOCOL_NAMES: Record<number, string> = {
  6: 'TCP',
  17: 'UDP',
  1: 'ICMP (ping)',
};

export function translateProtocol(proto: number): string {
  return PROTOCOL_NAMES[proto] || `Protocol ${proto}`;
}

// â”€â”€ 6.9 IP Addresses â”€â”€

export function isPrivateIP(ip: string): boolean {
  if (!ip) return false;
  return ip.startsWith('192.168.') || ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

export function translateIP(ip: string, expert: boolean = false): string {
  if (!ip) return 'Unknown';
  if (isPrivateIP(ip)) return expert ? ip : `A device on your network (${maskIP(ip)})`;
  return expert ? ip : `An outside computer (${maskIP(ip)})`;
}

export function maskIP(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return ip;
}

export function ipDescription(ip: string): string {
  return isPrivateIP(ip) ? 'A device on your home/office network' : 'An outside computer on the internet';
}

// â”€â”€ 6.10 Time â”€â”€

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h} hours`;
}

// â”€â”€ Agent Friendly Names (Section 5.7) â”€â”€

export function translateAgentName(key: string): { friendlyName: string; description: string } {
  const lower = key.toLowerCase();
  if (lower.includes('detection')) return { friendlyName: 'Threat Detector', description: 'Uses AI to spot attacks in network traffic' };
  if (lower.includes('threat'))    return { friendlyName: 'Threat Analyst', description: 'Figures out what kind of attack it is' };
  if (lower.includes('risk'))      return { friendlyName: 'Danger Scorer', description: 'Decides how serious each threat is' };
  if (lower.includes('decision'))  return { friendlyName: 'Decision Maker', description: 'Chooses the right response' };
  if (lower.includes('firewall'))  return { friendlyName: 'Network Guard', description: 'Blocks harmful addresses' };
  if (lower.includes('host'))      return { friendlyName: 'Computer Guard', description: 'Stops harmful programs on this PC' };
  if (lower.includes('alert'))     return { friendlyName: 'Notifier', description: 'Sends you alerts' };
  if (lower.includes('llm'))       return { friendlyName: 'AI Explainer', description: 'Writes plain-English explanations' };
  if (lower.includes('report'))    return { friendlyName: 'Report Writer', description: 'Creates PDF reports' };
  if (lower.includes('logging'))   return { friendlyName: 'Record Keeper', description: 'Saves a history of everything' };
  if (lower.includes('packet'))    return { friendlyName: 'Network Listener', description: 'Captures network traffic' };
  return { friendlyName: key, description: '' };
}

export function translateAgentStatus(status: string): { label: string; color: string; dotColor: string } {
  switch (status?.toUpperCase()) {
    case 'IDLE':          return { label: 'Ready', color: 'text-safe', dotColor: 'bg-safe' };
    case 'PROCESSING':    return { label: 'Working', color: 'text-brand', dotColor: 'bg-brand' };
    case 'ERROR':         return { label: 'Problem', color: 'text-critical', dotColor: 'bg-critical' };
    case 'OFFLINE':       return { label: 'Off', color: 'text-muted', dotColor: 'bg-muted' };
    case 'UNINITIALIZED': return { label: 'Startingâ€¦', color: 'text-muted', dotColor: 'bg-muted' };
    default:              return { label: status || 'Unknown', color: 'text-muted', dotColor: 'bg-muted' };
  }
}

// â”€â”€ MITRE ATT&CK Link Builder â”€â”€

export function mitreLink(techniqueId: string): string {
  if (!techniqueId) return '#';
  // T1110.001 â†’ /techniques/T1110/001/
  const parts = techniqueId.split('.');
  return `https://attack.mitre.org/techniques/${parts.join('/')}/`;
}
