import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExpertContext } from '../App';
import { getSystemStatus } from '../api/endpoints';
import { translateAgentName, translateAgentStatus } from '../lib/translate';
import { formatUptime } from '../lib/time';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { Activity, Cpu, HardDrive } from 'lucide-react';

export function Health() {
  const { expert } = useContext(ExpertContext);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['system-status'],
    queryFn: getSystemStatus,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <ErrorState message="Could not connect to SentinelAI." onRetry={() => refetch()} />;
  }

  const agents = Object.entries(data.agent_statuses || {});
  const problemCount = agents.filter(([_, status]) => status === 'ERROR' || status === 'OFFLINE').length;

  const headerMsg = problemCount === 0 
    ? "All protection parts are working" 
    : `${problemCount} part(s) have a problem`;

  return (
    <div className="aesthetic-icons space-y-6 max-w-5xl mx-auto p-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900  mb-2 flex items-center gap-2">
          <Activity className={`w-6 h-6 ${problemCount === 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          {headerMsg}
        </h1>
        <p className="text-dark dark:text-dark">
          Running for {formatUptime(data.uptime_seconds)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-dark  flex items-center gap-2">
              <Cpu className="w-5 h-5 text-dark" />
              Processor Usage
            </h3>
            <span className="font-semibold text-gray-900 ">{data.cpu_percent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${data.cpu_percent > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min(data.cpu_percent, 100)}%` }}
            ></div>
          </div>
        </div>
        
        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-dark  flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-dark" />
              Memory Usage
            </h3>
            <span className="font-semibold text-gray-900 ">{data.memory_percent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${data.memory_percent > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
              style={{ width: `${Math.min(data.memory_percent, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-medium text-gray-900  mt-8 mb-4">Protection Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map(([key, status]) => {
          const { friendlyName, description } = translateAgentName(key);
          const translatedStatus = translateAgentStatus(status).label;
          
          let statusColor = "bg-gray-400";
          let pulsing = false;
          
          if (translatedStatus === 'Idle' || status === 'IDLE') statusColor = "bg-emerald-500";
          else if (translatedStatus === 'Processing' || status === 'PROCESSING') { statusColor = "bg-blue-500"; pulsing = true; }
          else if (translatedStatus === 'Error' || status === 'ERROR') statusColor = "bg-red-500";

          return (
            <div key={key} className="bg-[var(--color-sage)] p-6 rounded-[2rem] flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-gray-900  text-lg">{friendlyName}</h3>
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-700/50 rounded-full">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColor} ${pulsing ? 'animate-pulse' : ''}`}></div>
                  <span className="text-xs font-medium text-dark ">{translatedStatus}</span>
                </div>
              </div>
              <p className="text-dark dark:text-dark text-sm flex-grow">
                {description}
              </p>
              {expert && (
                <div className="mt-4 pt-4 border-t border-gray-100 border-transparent">
                  <p className="text-xs font-mono text-dark">ID: {key}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
