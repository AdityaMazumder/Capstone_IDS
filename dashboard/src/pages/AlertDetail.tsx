import React, { useContext, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Copy,
  Download,
  Shield,
  ShieldAlert,
  TestTube,
  XCircle,
  Clock,
  Unlock
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { ExpertContext } from '../App';
import { Skeleton, ErrorState, RiskGauge, TechDetails, ConfirmModal, StoryFlow, SeverityBadge } from '../components/index';
import { getIncidentDetail, getHostIncidents, unblockIP, generateReport } from '../api/endpoints';
import { translateThreat, translateFileType } from '../lib/translate';
import {} from '../components/index';

dayjs.extend(relativeTime);

export default function AlertDetail() {
  const { expert } = useContext(ExpertContext);
  const { source, id } = useParams<{ source: string; id: string }>();
  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [isReviewed, setIsReviewed] = useState(
    localStorage.getItem(`sentinel_reviewed_${id}`) === 'true'
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['incident-detail', source, id],
    queryFn: async () => {
      if (source === 'network') {
        return await getIncidentDetail(id!);
      } else if (source === 'computer') {
        const incidents = await getHostIncidents(500);
        const incident = incidents.find((i: any) => i.id === id);
        if (incident && incident.raw_json) {
          incident.details = JSON.parse(incident.raw_json);
        }
        return incident;
      }
      throw new Error('Unknown source');
    },
    enabled: !!id && !!source,
  });

  if (isLoading) return <div className="p-6 max-w-4xl mx-auto"><Skeleton className="h-64 w-full" /></div>;
  if (error || !data) return <div className="p-6 max-w-4xl mx-auto"><ErrorState message="Could not load alert details." /></div>;

  const markReviewed = () => {
    localStorage.setItem(`sentinel_reviewed_${id}`, 'true');
    setIsReviewed(true);
  };

  const handleDownload = () => {
    generateReport(id!);
  };

  const handleUnblock = async () => {
    if (source === 'network' && data.src_ip) {
      await unblockIP(data.src_ip);
      setUnblockModalOpen(false);
    }
  };

  // Compute values
  const threatInfo = translateThreat(data.attack_label || data.event_type || 'Unknown');
  const severity = data.severity || threatInfo.severity;
  const time = dayjs(data.timestamp);
  
  let llmSummary = data.llm_explanation?.summary;
  let summary = llmSummary || threatInfo.template;
  if (source === 'network') {
    summary = summary.replace('{src_ip}', data.src_ip).replace('{dst_port}', data.dst_port);
  } else if (source === 'computer') {
    summary = `${data.process_name || 'A program'} tried to access ${translateFileType(data.file_path || '')}. ${summary}`;
  }

  const confidence = data.confidence ? Math.round(data.confidence * 100) : 85;
  const riskScore = data.anomaly_score || 5; 

  const expiry = data.expiry_timestamp ? dayjs(data.expiry_timestamp) : null;
  const timerText = expiry ? `Block ends in ${expiry.diff(dayjs(), 'hour')}h ${expiry.diff(dayjs(), 'minute') % 60}m` : '';

  const isNetworkBlockActive = source === 'network' && data.soar_action === 'BLOCK_IP' && data.action_status === 'ACTIVE';

  let advice = data.llm_explanation?.soc_recommendations || threatInfo.advice;
  if (threatInfo.isStealer || source === 'computer') {
    advice = [
      "Change the passwords saved in your browser.",
      "Sign out of all sessions on important websites (email, bank).",
      "Run a full antivirus scan.",
      ...(Array.isArray(advice) ? advice : [advice])
    ];
  } else if (!Array.isArray(advice)) {
    advice = [advice];
  }

  return (
    <div className="aesthetic-icons max-w-4xl mx-auto p-4 md:p-6 space-y-6 text-gray-800">
      <Link to="/" className="inline-flex items-center text-sm text-dark hover:text-dark">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--color-sage)] p-6 rounded-[2rem]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <SeverityBadge severity={severity} />
            <h1 className="text-xl font-semibold">{threatInfo.title}</h1>
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
          
          {source === 'computer' && (
             <StoryFlow process={data.process_name} target={translateFileType(data.file_path)} response={data.soar_action} />
          )}
        </div>

        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem] space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2 text-dark">
            <span className="bg-gray-100 text-dark rounded-full w-6 h-6 inline-flex items-center justify-center text-xs font-bold">2</span>
            How dangerous is it?
          </h2>
          <div className="flex flex-col items-center">
             <RiskGauge score={riskScore} />
             <p className="mt-4 text-sm text-dark font-medium">We're {confidence}% sure this is real.</p>
          </div>
        </div>

        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem] space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2 text-dark">
            <span className="bg-gray-100 text-dark rounded-full w-6 h-6 inline-flex items-center justify-center text-xs font-bold">3</span>
            What did SentinelAI do?
          </h2>
          <div className="bg-gray-50 rounded-lg p-4 flex items-start gap-4">
            {data.action_status === 'ACTIVE' && data.soar_action === 'BLOCK_IP' && (
               <>
                 <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-800">Blocked this address for 24h</p>
                   {timerText && <p className="text-sm text-dark mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {timerText}</p>}
                 </div>
               </>
            )}
            {data.action_status === 'SIMULATED' && (
               <>
                 <TestTube className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-800">Test mode: we would have {source === 'network' ? 'blocked this address' : 'stopped this program'}</p>
                 </div>
               </>
            )}
            {data.action_status === 'FAILED' && (
               <>
                 <XCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-800">We tried to stop it but couldn't</p>
                 </div>
               </>
            )}
            {source === 'computer' && data.action_status === 'SUCCESS' && (
               <>
                 <Shield className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-800">Stopped the program</p>
                 </div>
               </>
            )}
          </div>
          
          {isNetworkBlockActive && (
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
            {advice.map((item: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-dark">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-[var(--color-sage)] rounded-[2rem] overflow-hidden">
        <TechDetails data={data} source={source} expert={expert} />
      </div>

      {unblockModalOpen && (
        <ConfirmModal
          title="Unblock this address?"
          description={`Are you sure you want to unblock ${data.src_ip}? This address tried to ${threatInfo.title}. It will be able to reach your computer again.`}
          primaryAction="Keep blocked"
          secondaryAction="Unblock anyway"
          onConfirm={() => setUnblockModalOpen(false)}
          onSecondary={handleUnblock}
          onClose={() => setUnblockModalOpen(false)}
        />
      )}
    </div>
  );
}

