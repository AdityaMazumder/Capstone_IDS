import { useState } from 'react';
import {
  Home, Shield, ShieldBan, ShieldAlert, AlertTriangle,
  Bell, ChevronRight, Globe, Monitor, CheckCircle, XCircle,
  Lock, CreditCard, Wallet, Key, TrendingUp, Activity, Zap,
  ChevronDown, Code, Copy, Check, RotateCcw, Eye, EyeOff,
  Wifi, WifiOff, FlaskConical
} from 'lucide-react';

// ─── TRANSLATION LAYER ─────────────────────────────────────────────────
function translateThreat(raw: string) {
  const t = raw?.toLowerCase() ?? '';
  const map: Record<string, { name: string; desc: string; advice: string }> = {
    'stealer':        { name: 'Password-stealing program', desc: 'A program secretly opened your saved passwords or login cookies.', advice: 'Change your saved passwords and sign out of all sessions on important sites.' },
    'infostealer':    { name: 'Password-stealing program', desc: 'A program secretly opened your saved passwords or login cookies.', advice: 'Change your saved passwords and sign out of all sessions on important sites.' },
    'ddos':           { name: 'Flood attack', desc: 'Many computers sending junk traffic to crash your service.', advice: 'Nothing to do — we blocked the sources. If internet stays slow, restart your router.' },
    'dos':            { name: 'Overload attack', desc: 'One computer flooding yours to slow it down or crash it.', advice: 'Nothing to do — we blocked the source.' },
    'ssh-bruteforce': { name: 'Password-guessing attack', desc: 'Someone kept trying passwords to log in to your computer remotely.', advice: "Use a strong, unique password and turn off remote login if you don't use it." },
    'bruteforce':     { name: 'Password-guessing attack', desc: 'Repeated password guessing on your system.', advice: 'Use strong, unique passwords.' },
    'portscan':       { name: 'Someone checking for open doors', desc: 'An outsider was probing your computer to find a way in.', advice: 'Nothing to do — this was the first step of an attack, and we blocked it.' },
    'botnet':         { name: 'Hijacked-device activity', desc: "A device may be under a hacker's remote control.", advice: 'Run a full antivirus scan.' },
    'infiltration':   { name: 'Break-in attempt', desc: 'Someone tried to exploit a weakness to get in.', advice: 'Update Windows and your apps.' },
    'ransomware':     { name: 'Ransomware (file-locking program)', desc: 'A program tried to lock your files and demand money.', advice: 'Disconnect from the internet immediately and contact IT support.' },
    'malware':        { name: 'Harmful program', desc: 'A program behaving like malware.', advice: 'Run a full antivirus scan.' },
  };
  return map[t] ?? { name: 'Suspicious activity', desc: 'Something unusual was detected.', advice: 'Review the details or ask IT support.' };
}

function translateAction(raw: string) {
  const map: Record<string, string> = {
    'TEMP_BAN_IP': 'Blocked temporarily',
    'BLOCK_IP': 'Blocked this address',
    'TERMINATE_PROCESS': 'Stopped the program',
    'ALERT_ONLY': 'Warned you, no automatic action',
    'LOG_ONLY': 'Noted for the record',
    'RATE_LIMIT': 'Slowed this address down',
  };
  return map[raw] ?? raw;
}

function maskIP(ip: string) {
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.x.x`;
}

function formatRisk(score: number) {
  if (score >= 8.5) return { label: 'Critical', color: 'text-red-500' };
  if (score >= 7.0) return { label: 'High', color: 'text-orange-500' };
  if (score >= 5.0) return { label: 'Moderate', color: 'text-amber-400' };
  return { label: 'Low', color: 'text-sky-400' };
}

function timeAgo(epochSeconds: number) {
  const diff = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── MOCK DATA ──────────────────────────────────────────────────────────
const NOW = Math.floor(Date.now() / 1000);
const MOCK_METRICS = { flows: 12547, threats: 42, blocked: 3, avgRisk: 7.2 };

const MOCK_ALERTS = [
  { id: 'net-1', source: 'network', time: NOW - 120,  severity: 'CRITICAL', typeRaw: 'SSH-Bruteforce', actionRaw: 'TEMP_BAN_IP', srcIp: '45.33.1.14', dstPort: 22, protocol: 'TCP', mitre: 'T1110.001', confidence: 0.98, risk: 9.1, status: 'SIMULATED' },
  { id: 'net-2', source: 'network', time: NOW - 900,  severity: 'HIGH',     typeRaw: 'DDoS',           actionRaw: 'TEMP_BAN_IP', srcIp: '91.108.4.5',  dstPort: 443, protocol: 'UDP', mitre: 'T1498', confidence: 0.94, risk: 8.0, status: 'SIMULATED' },
  { id: 'net-3', source: 'network', time: NOW - 3600, severity: 'MEDIUM',   typeRaw: 'PortScan',       actionRaw: 'LOG_ONLY',    srcIp: '185.220.3.2', dstPort: 80,  protocol: 'TCP', mitre: 'T1046', confidence: 0.81, risk: 5.5, status: 'SUCCESS' },
  { id: 'cmp-1', source: 'computer', time: NOW - 600, severity: 'CRITICAL', typeRaw: 'Stealer', actionRaw: 'TERMINATE_PROCESS', process: 'svc_update.exe', parent: 'powershell.exe', file: 'Login Data (Chrome)', mitre: 'T1555.003', confidence: 0.97, risk: 9.5, status: 'SIMULATED' },
  { id: 'cmp-2', source: 'computer', time: NOW - 4000, severity: 'HIGH',   typeRaw: 'Stealer', actionRaw: 'TERMINATE_PROCESS', process: 'unknown.exe', parent: 'explorer.exe', file: 'wallet.dat', mitre: 'T1555', confidence: 0.88, risk: 8.5, status: 'SUCCESS' },
];

const MOCK_BLOCKS = [
  { id: 'r1', ip: '45.33.1.14',  reason: 'SSH-Bruteforce', since: NOW - 120,   expires: NOW + 82800, status: 'SIMULATED' },
  { id: 'r2', ip: '91.108.4.5',  reason: 'DDoS',           since: NOW - 900,   expires: NOW + 79200, status: 'SIMULATED' },
  { id: 'r3', ip: '10.0.0.5',    reason: 'Manual ban',     since: NOW - 86400, expires: null,         status: 'ACTIVE' },
];

const GUARDED_ASSETS = [
  { icon: Key,        label: 'Saved browser passwords', file: 'Login Data',     status: 'safe' },
  { icon: Shield,     label: 'Login sessions (cookies)', file: 'Cookies',       status: 'safe' },
  { icon: Lock,       label: 'Browser master key',      file: 'Local State',    status: 'safe' },
  { icon: CreditCard, label: 'Autofill & saved cards',  file: 'Web Data',       status: 'safe' },
  { icon: Wallet,     label: 'Crypto wallet',            file: 'wallet.dat',     status: 'safe' },
  { icon: Key,        label: "Firefox's password key",  file: 'key4.db',        status: 'safe' },
];

// ─── COMPONENTS ─────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    CRITICAL: { label: 'Critical', cls: 'bg-red-100 text-red-700 border border-red-200' },
    HIGH:     { label: 'Serious',  cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
    MEDIUM:   { label: 'Worth a look', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
    LOW:      { label: 'Minor',    cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
  };
  const s = map[severity] ?? { label: severity, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

function ActionChip({ actionRaw, status }: { actionRaw: string; status: string }) {
  const isTest = status === 'SIMULATED';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      isTest ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    }`}>
      {isTest ? <FlaskConical size={11} /> : <CheckCircle size={11} />}
      {isTest ? 'Test mode' : translateAction(actionRaw)}
    </span>
  );
}

function AlertCard({ alert, expertView }: { alert: typeof MOCK_ALERTS[0]; expertView: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const threat = translateThreat(alert.typeRaw);
  const borderColor = alert.severity === 'CRITICAL' ? 'border-l-red-500' : alert.severity === 'HIGH' ? 'border-l-orange-500' : alert.severity === 'MEDIUM' ? 'border-l-amber-400' : 'border-l-sky-400';

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(alert, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderColor} shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${alert.source === 'network' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'}`}>
              {alert.source === 'network' ? <Globe size={16} /> : <Monitor size={16} />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <SeverityBadge severity={alert.severity} />
                <span className="text-xs text-slate-400">{alert.source === 'network' ? 'Internet threat' : 'Computer threat'}</span>
                <ActionChip actionRaw={alert.actionRaw} status={alert.status} />
              </div>
              <p className="font-semibold text-slate-800 text-sm">{threat.name}</p>
              <p className="text-sm text-slate-500 mt-0.5 leading-snug">{threat.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(alert.time)}</span>
            {expertView && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Toggle technical details"
              >
                <ChevronDown size={16} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Expert Expanded Panel */}
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expertView && expanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
          <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
              </div>
              <button onClick={handleCopy} className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors">
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy JSON</>}
              </button>
            </div>
            <div className="text-slate-300 space-y-0.5 overflow-auto max-h-52">
              {alert.source === 'network' ? (
                <>
                  <div><span className="text-purple-400">attack_type:</span> <span className="text-emerald-400">"{alert.typeRaw}"</span></div>
                  <div><span className="text-purple-400">src_ip:</span> <span className="text-amber-400">"{alert.srcIp}"</span></div>
                  <div><span className="text-purple-400">dst_port:</span> <span className="text-sky-400">{alert.dstPort}</span></div>
                  <div><span className="text-purple-400">protocol:</span> <span className="text-emerald-400">"{alert.protocol}"</span></div>
                  <div><span className="text-purple-400">confidence:</span> <span className="text-sky-400">{alert.confidence}</span></div>
                  <div><span className="text-purple-400">risk_score:</span> <span className="text-red-400">{alert.risk}</span></div>
                  <div><span className="text-purple-400">mitre:</span> <span className="text-emerald-400">"{alert.mitre}"</span></div>
                  <div><span className="text-purple-400">action_taken:</span> <span className="text-emerald-400">"{alert.actionRaw}"</span></div>
                  <div><span className="text-purple-400">status:</span> <span className="text-amber-400">"{alert.status}"</span></div>
                </>
              ) : (
                <>
                  <div><span className="text-purple-400">classification:</span> <span className="text-emerald-400">"{alert.typeRaw}"</span></div>
                  <div><span className="text-purple-400">process_name:</span> <span className="text-amber-400">"{(alert as any).process}"</span></div>
                  <div><span className="text-purple-400">parent_name:</span> <span className="text-amber-400">"{(alert as any).parent}"</span></div>
                  <div><span className="text-purple-400">file_accessed:</span> <span className="text-emerald-400">"{(alert as any).file}"</span></div>
                  <div><span className="text-purple-400">mitre:</span> <span className="text-emerald-400">"{alert.mitre}"</span></div>
                  <div><span className="text-purple-400">confidence:</span> <span className="text-sky-400">{alert.confidence}</span></div>
                  <div><span className="text-purple-400">risk_score:</span> <span className="text-red-400">{alert.risk}</span></div>
                  <div><span className="text-purple-400">soar_action:</span> <span className="text-emerald-400">"{alert.actionRaw}"</span></div>
                  <div><span className="text-purple-400">action_status:</span> <span className="text-amber-400">"{alert.status}"</span></div>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-indigo-600 font-medium mt-2 px-0.5">💡 {threat.advice}</p>
        </div>

        {/* Simple view advice */}
        {!expertView && (
          <p className="text-xs text-indigo-600 font-medium mt-2 px-0.5">💡 {threat.advice}</p>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-default group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform duration-200`}>
          <Icon size={20} />
        </div>
        <TrendingUp size={14} className="text-emerald-500 mt-1" />
      </div>
      <p className="text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
      <p className="text-sm font-semibold text-slate-700 mt-1">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── PAGE: HOME ─────────────────────────────────────────────────────────
function HomePage({ expertView }: { expertView: boolean }) {
  const hasCritical = MOCK_ALERTS.some(a => a.severity === 'CRITICAL');

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`rounded-2xl p-6 flex items-center gap-5 ${hasCritical ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200' : 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200'}`}>
        <div className={`shrink-0 w-14 h-14 rounded-full flex items-center justify-center ${hasCritical ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {hasCritical ? <AlertTriangle size={28} /> : <Shield size={28} />}
        </div>
        <div className="flex-1">
          <h1 className={`text-xl font-bold ${hasCritical ? 'text-amber-900' : 'text-emerald-900'}`}>
            {hasCritical ? `We stopped ${MOCK_ALERTS.filter(a => a.severity === 'CRITICAL').length} threats today. No action needed from you.` : "You're protected. Nothing needs your attention."}
          </h1>
          <p className={`text-sm mt-1 ${hasCritical ? 'text-amber-700' : 'text-emerald-700'}`}>Last checked: just now · All automatic protections are active</p>
        </div>
        <div className={`text-5xl font-black ${hasCritical ? 'text-amber-200' : 'text-emerald-200'}`}>
          {hasCritical ? '⚠' : '✓'}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Activity} label="Network activity checked" value={MOCK_METRICS.flows.toLocaleString()} sub="Connections inspected by SentinelAI" color="bg-indigo-50 text-indigo-600" />
        <KpiCard icon={ShieldAlert} label="Threats caught" value={MOCK_METRICS.threats} sub="Suspicious things found and handled" color="bg-orange-50 text-orange-600" />
        <KpiCard icon={ShieldBan} label="Addresses blocked" value={MOCK_METRICS.blocked} sub="Outsiders currently kept out" color="bg-red-50 text-red-600" />
        <KpiCard icon={Zap} label="Average danger level" value={`${MOCK_METRICS.avgRisk}/10`} sub={`${formatRisk(MOCK_METRICS.avgRisk).label} — within normal range`} color="bg-amber-50 text-amber-600" />
      </div>

      {/* Latest Alerts */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Latest alerts</h2>
          {expertView && (
            <span className="text-xs text-indigo-500 font-medium flex items-center gap-1">
              <Code size={12} /> Expert mode — click chevron for raw data
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {MOCK_ALERTS.map(a => <AlertCard key={a.id} alert={a} expertView={expertView} />)}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: COMPUTER PROTECTION ──────────────────────────────────────────
function ComputerPage({ expertView }: { expertView: boolean }) {
  const hostAlerts = MOCK_ALERTS.filter(a => a.source === 'computer');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Computer Protection</h1>
        <p className="text-slate-500 text-sm mt-1">SentinelAI watches for programs that secretly open your saved passwords, login cookies or crypto wallet.</p>
      </div>

      {/* Guarded Assets */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Protected items</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {GUARDED_ASSETS.map(({ icon: Icon, label, file }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-200 group cursor-default">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Icon size={20} />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle size={11} /> Guarded
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              {expertView && <p className="text-xs text-slate-400 mt-0.5 font-mono">{file}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Threat History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Stopped programs</h2>
          <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">{hostAlerts.length} stopped</span>
        </div>
        <div className="p-4 space-y-3">
          {hostAlerts.map(a => <AlertCard key={a.id} alert={a} expertView={expertView} />)}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: BLOCKED CONNECTIONS ───────────────────────────────────────────
function BlockedPage({ expertView }: { expertView: boolean }) {
  const blocks = MOCK_BLOCKS;
  const [loading, setLoading] = useState<string | null>(null);
  const [unblocked, setUnblocked] = useState<Set<string>>(new Set());

  function handleUnblock(id: string) {
    setLoading(id);
    setTimeout(() => {
      setLoading(null);
      setUnblocked(prev => new Set([...prev, id]));
    }, 1500);
  }

  function getStatusBadge(status: string, id: string) {
    if (unblocked.has(id)) return <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Unblocked</span>;
    if (status === 'SIMULATED') return <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1"><FlaskConical size={11}/>Test mode</span>;
    return <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1"><Shield size={11}/>Blocked</span>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Blocked Connections</h1>
        <p className="text-slate-500 text-sm mt-1">These outside addresses tried to harm your computer. SentinelAI is keeping them out.</p>
      </div>

      {blocks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <Shield size={32} className="text-emerald-500" />
          </div>
          <h2 className="font-bold text-slate-800">No one is blocked right now</h2>
          <p className="text-slate-500 text-sm mt-1">That's a good thing.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Address</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Reason</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Since</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Expires</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {blocks.map(b => (
                <tr key={b.id} className={`hover:bg-slate-50 transition-colors ${unblocked.has(b.id) ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="font-mono text-sm font-semibold text-slate-800">{expertView ? b.ip : maskIP(b.ip)}</div>
                    {!expertView && <div className="text-xs text-slate-400">Outside computer</div>}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{translateThreat(b.reason).name}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">{timeAgo(b.since)}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">
                    {b.expires ? `${Math.max(0, Math.floor((b.expires - Date.now() / 1000) / 3600))}h left` : 'Permanent'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex">{getStatusBadge(b.status, b.id)}</div>
                  </td>
                  <td className="px-4 py-4">
                    {!unblocked.has(b.id) && (
                      <button
                        onClick={() => handleUnblock(b.id)}
                        disabled={loading === b.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {loading === b.id ? (
                          <><RotateCcw size={12} className="animate-spin" /> Unblocking…</>
                        ) : (
                          <><XCircle size={12} /> Unblock</>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────────────────
type Page = 'home' | 'computer' | 'blocked';

const NAV_ITEMS: { id: Page; label: string; icon: any }[] = [
  { id: 'home',     label: 'Home',                 icon: Home      },
  { id: 'computer', label: 'Computer Protection',  icon: Monitor   },
  { id: 'blocked',  label: 'Blocked Connections',  icon: ShieldBan },
];

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [expertView, setExpertView] = useState(false);
  const [wsStatus] = useState<'Live' | 'Offline'>('Live'); // mock
  const [bellCount] = useState(3);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">

      {/* ─ Sidebar ─ */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col transform transition-transform duration-300 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-slate-700/60 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3 shadow">
            <Shield size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">SentinelAI</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPage(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                page === id
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
              {page === id && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-slate-700/60 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            All systems operational
          </div>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ─ Main ─ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-4">
          {/* Left */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>

            {/* Connection pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              wsStatus === 'Live' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${wsStatus === 'Live' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {wsStatus === 'Live' ? <><Wifi size={12} /> Live</> : <><WifiOff size={12} /> Offline</>}
            </div>

            {/* Test mode */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold tracking-wide">
              <FlaskConical size={12} /> TEST MODE
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Expert toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <span className="text-xs font-medium text-slate-500 hidden sm:block group-hover:text-slate-700 transition-colors">
                {expertView ? 'Expert view' : 'Simple view'}
              </span>
              <button
                onClick={() => setExpertView(!expertView)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${expertView ? 'bg-indigo-600' : 'bg-slate-300'}`}
                aria-label="Toggle expert view"
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${expertView ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              {expertView ? <Eye size={15} className="text-indigo-600" /> : <EyeOff size={15} className="text-slate-400" />}
            </label>

            {/* Bell */}
            <button className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors active:scale-95">
              <Bell size={18} />
              {bellCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">{bellCount}</span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto">
            {page === 'home'     && <HomePage     expertView={expertView} />}
            {page === 'computer' && <ComputerPage expertView={expertView} />}
            {page === 'blocked'  && <BlockedPage  expertView={expertView} />}
          </div>
        </main>

      </div>
    </div>
  );
}
