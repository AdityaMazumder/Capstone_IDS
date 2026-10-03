import { useContext, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Shield,
  TestTube,
  XCircle,
  Clock,
  Unlock,
  Info,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { toast } from 'sonner';

import { ExpertContext } from '../App';
import { Skeleton, ErrorState, RiskGauge, TechDetails, ConfirmModal, StoryFlow, SeverityBadge } from '../components/index';
import { getIncidentDetail, getHostIncidents, unblockIP, generateReport, getReportDownloadUrl } from '../api/endpoints';
import { translateThreat, translateFileType, translateHostAction, translateNetworkAction, formatDuration } from '../lib/translate';

dayjs.extend(relativeTime);

type ActionOutcome = 'done' | 'test' | 'failed' | 'other';

interface AlertView {
  source: 'network' | 'computer';
  incidentId: string;
  timestamp: number;
  threatRaw: string;
  severity: string;
  riskScore: number;
  confidence: number | null;
  srcIp?: string;
  dstIp?: string;
  dstPort?: number;
  processName?: string;
  filePath?: string;
  fileType?: string;
  actionLabel: string;
  outcome: ActionOutcome;
  banSeconds?: number;
  ruleId?: string;
  ruleStatus?: string;
  expiresAt?: number | null;
  llm?: { summary?: string; soc_recommendations?: string[] } | null;
  raw: Record<string, any>;
}

function outcomeFromStatus(status: string | null | undefined): ActionOutcome {
  const s = (status || '').toUpperCase();
  if (s.includes('FAILED')) return 'failed';
  if (s.includes('SIMULATED')) return 'test';
  if (s.includes('SUCCESS') || s === 'ACTIVE') return 'done';
  return 'other';
}

// GET /api/incidents/{id} returns Incident.to_dict() (nested) when raw_json exists, otherwise the flat DB row.
function networkView(d: any): AlertView {
  if (d.flow) {
    const rule = d.firewall_rule;
    const action = d.action_plan?.action_type;
    return {
      source: 'network',
      incidentId: d.incident_id,
      timestamp: d.timestamp,
      threatRaw: d.detection?.attack_type || 'Unknown',
      severity: d.risk?.severity || 'LOW',
      riskScore: d.risk?.score ?? 0,
      confidence: d.detection?.confidence ?? null,
      srcIp: d.flow.src_ip,
      dstIp: d.flow.dst_ip,
      dstPort: d.flow.dst_port,
      actionLabel: translateNetworkAction(action, d.action_plan?.ban_duration_seconds),
      outcome: rule ? outcomeFromStatus(rule.status) : 'other',
      banSeconds: d.action_plan?.ban_duration_seconds,
      ruleId: rule?.rule_id,
      ruleStatus: rule?.status,
      expiresAt: rule?.expires_at ?? null,
      llm: d.llm_explanation,
      raw: d,
    };
  }
  return {
    source: 'network',
    incidentId: d.incident_id,
    timestamp: d.timestamp,
    threatRaw: d.attack_type || 'Unknown',
    severity: d.severity || 'LOW',
    riskScore: d.risk_score ?? 0,
    confidence: d.confidence ?? null,
    srcIp: d.src_ip,
    dstIp: d.dst_ip,
    dstPort: d.dst_port,
    actionLabel: translateNetworkAction(d.action_taken),
    outcome: 'other',
    llm: null,
    raw: d,
  };
}

function hostView(row: any): AlertView {
  const details = row.raw_json ? JSON.parse(row.raw_json) : {};
  return {
    source: 'computer',
    incidentId: row.incident_id,
    timestamp: row.timestamp,
    threatRaw: row.classification || 'Unknown',
    severity: row.severity || 'LOW',
    riskScore: row.risk_score ?? 0,
    confidence: row.confidence ?? null,
    processName: row.process_name,
    filePath: row.file_path,
    fileType: row.file_type,
    actionLabel: translateHostAction(row.soar_action),
    outcome: outcomeFromStatus(row.action_status),
    llm: details.llm_explanation,
    raw: { ...row, raw_json: undefined, details },
  };
}

export default function AlertDetail() {
  const { expert } = useContext(ExpertContext);
  const queryClient = useQueryClient();
  const { source, id } = useParams<{ source: string; id: string }>();
  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [isReviewed, setIsReviewed] = useState(
    localStorage.getItem(`sentinel_reviewed_${id}`) === 'true'
  );

  const { data: view, isLoading, error } = useQuery({
    queryKey: ['incident-detail', source, id],
    queryFn: async (): Promise<AlertView> => {
      if (source === 'network') {
        return networkView(await getIncidentDetail(id!));
      }
      if (source === 'computer') {
        const { host_incidents } = await getHostIncidents(500);
        const incident = host_incidents.find((i) => i.incident_id === id);
        if (!incident) throw new Error('Incident not found');
        return hostView(incident);
      }
      throw new Error('Unknown source');
    },
    enabled: !!id && !!source,
  });

  if (isLoading) return <div className="p-6 max-w-4xl mx-auto"><Skeleton className="h-64 w-full" /></div>;
  if (error || !view) return <div className="p-6 max-w-4xl mx-auto"><ErrorState message="Could not load alert details." /></div>;

  const markReviewed = () => {
    localStorage.setItem(`sentinel_reviewed_${id}`, 'true');
    setIsReviewed(true);
  };

  const handleDownload = async () => {
    try {
      const report = await generateReport();
      window.open(getReportDownloadUrl(report.filename), '_blank');
    } catch {
      toast.error("Couldn't create the report");
    }
  };

  const handleUnblock = async () => {
    if (!view.ruleId) return;
    try {
      await unblockIP(view.ruleId);
      toast.success('Address unblocked');
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['incident-detail', source, id] });
    } catch {
      toast.error('Failed to unblock address');
    }
  };

  const threatInfo = translateThreat(view.threatRaw);
  const time = dayjs.unix(view.timestamp);
  const targetFile = translateFileType(view.fileType, view.filePath);

  let summary: string = view.llm?.summary || threatInfo.explanation;
  if (view.source === 'computer') {
    summary = `${view.processName || 'A program'} tried to access ${targetFile}. ${summary}`;
  }

  const confidence = view.confidence != null ? Math.round(view.confidence * 100) : null;

  const expiry = view.expiresAt ? dayjs.unix(view.expiresAt) : null;
  const minutesLeft = expiry ? Math.max(expiry.diff(dayjs(), 'minute'), 0) : 0;
  const timerText = expiry ? `Block ends in ${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m` : '';

  const canUnblock = view.source === 'network' && !!view.ruleId && ['ACTIVE', 'SIMULATED'].includes((view.ruleStatus || '').toUpperCase());

  let advice: string[] = view.llm?.soc_recommendations?.length
    ? view.llm.soc_recommendations
    : [threatInfo.advice].filter(Boolean);
  if (view.threatRaw.toLowerCase().includes('stealer') || view.source === 'computer') {
    advice = [
      'Change the passwords saved in your browser.',
      'Sign out of all sessions on important websites (email, bank).',
      'Run a full antivirus scan.',
      ...advice,
    ];
  }

  const blockedFor = view.banSeconds ? ` for ${formatDuration(view.banSeconds)}` : '';

  return (
    <div className="aesthetic-icons max-w-4xl mx-auto p-4 md:p-6 space-y-6 text-gray-800">
      <Link to="/" className="inline-flex items-center text-sm text-dark hover:text-dark">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--color-sage)] p-6 rounded-[2rem]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <SeverityBadge severity={view.severity} />
            <h1 className="text-xl font-semibold">{threatInfo.friendlyName}</h1>
          </div>
          <p className="text-sm text-dark" title={time.format('YYYY-MM-DD HH:mm:ss')}>
            {time.fromNow()}
          </p>
        </div>
        <div className="flex gap-2">
          {!isReviewed && (
            <button onClick={markReviewed} className="px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
              Mark as reviewed
            </button>
          )}
          <button onClick={handleDownload} className="px-3 py-1.5 text-sm font-medium text-dark bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center gap-2">
            <Download className="w-4 h-4" /> Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem] space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2 text-dark">
            <span className="bg-gray-100 text-dark rounded-full w-6 h-6 inline-flex items-center justify-center text-xs font-bold">1</span>
            What happened?
          </h2>
          <p className="text-dark leading-relaxed">{summary}</p>
          {view.source === 'network' && expert && view.srcIp && (
            <p className="text-xs font-mono text-dark">
              {view.srcIp} &rarr; {view.dstIp}{view.dstPort ? `:${view.dstPort}` : ''}
            </p>
          )}

          {view.source === 'computer' && (
             <StoryFlow
               steps={[
                 { icon: 'cpu', label: view.processName || 'A program' },
                 { icon: 'file-lock', label: targetFile },
                 { icon: 'shield', label: view.actionLabel },
               ]}
             />
          )}
        </div>

        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem] space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2 text-dark">
            <span className="bg-gray-100 text-dark rounded-full w-6 h-6 inline-flex items-center justify-center text-xs font-bold">2</span>
            How dangerous is it?
          </h2>
          <div className="flex flex-col items-center">
             <RiskGauge score={view.riskScore} />
             {confidence != null && (
               <p className="mt-4 text-sm text-dark font-medium">We're {confidence}% sure this is real.</p>
             )}
          </div>
        </div>

        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem] space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2 text-dark">
            <span className="bg-gray-100 text-dark rounded-full w-6 h-6 inline-flex items-center justify-center text-xs font-bold">3</span>
            What did SentinelAI do?
          </h2>
          <div className="bg-gray-50 rounded-lg p-4 flex items-start gap-4">
            {view.outcome === 'done' && (
               <>
                 {view.source === 'network'
                   ? <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                   : <Shield className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />}
                 <div>
                   <p className="font-medium text-gray-800">
                     {view.source === 'network' ? `Blocked this address${blockedFor}` : view.actionLabel}
                   </p>
                   {timerText && <p className="text-sm text-dark mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {timerText}</p>}
                 </div>
               </>
            )}
            {view.outcome === 'test' && (
               <>
                 <TestTube className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-800">Test mode: we would have {view.source === 'network' ? `blocked this address${blockedFor}` : view.actionLabel.toLowerCase()}</p>
                   {timerText && <p className="text-sm text-dark mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {timerText}</p>}
                 </div>
               </>
            )}
            {view.outcome === 'failed' && (
               <>
                 <XCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-800">We tried to stop it but couldn't</p>
                 </div>
               </>
            )}
            {view.outcome === 'other' && (
               <>
                 <Info className="w-6 h-6 text-slate-500 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-800">{view.actionLabel}</p>
                 </div>
               </>
            )}
          </div>

          {canUnblock && (
            <button onClick={() => setUnblockModalOpen(true)} className="mt-2 text-sm text-blue-600 font-medium hover:underline flex items-center gap-1">
              <Unlock className="w-4 h-4" /> Unblock this address
            </button>
          )}
        </div>

        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem] space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2 text-dark">
            <span className="bg-gray-100 text-dark rounded-full w-6 h-6 inline-flex items-center justify-center text-xs font-bold">4</span>
            What should you do?
          </h2>
          <ul className="space-y-2">
            {advice.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-dark">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-[var(--color-sage)] rounded-[2rem] overflow-hidden">
        <TechDetails data={view.raw} defaultOpen={expert} />
      </div>

      <ConfirmModal
        isOpen={unblockModalOpen}
        title="Unblock this address?"
        message={`Are you sure you want to unblock ${view.srcIp}? It was blocked for: ${threatInfo.friendlyName.toLowerCase()}. It will be able to reach your computer again.`}
        cancelLabel="Keep blocked"
        confirmLabel="Unblock anyway"
        variant="danger"
        onConfirm={handleUnblock}
        onClose={() => setUnblockModalOpen(false)}
      />
    </div>
  );
}
