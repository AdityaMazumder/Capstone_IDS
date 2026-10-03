import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';

export default function Home() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: endpoints.getMetrics,
    refetchInterval: 10000,
  });

  const { data: blocks } = useQuery({
    queryKey: ['blocks'],
    queryFn: endpoints.getBlocks,
    refetchInterval: 15000,
  });

  if (metricsLoading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-2xl p-6 flex items-center space-x-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold">You're protected. Nothing needs your attention.</h1>
          <p className="text-emerald-700 mt-1">Last checked: just now</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-slate-500 text-sm font-medium">Network activity checked</p>
          <p className="text-3xl font-bold mt-2">{metrics?.total_flows_analyzed || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-slate-500 text-sm font-medium">Threats caught</p>
          <p className="text-3xl font-bold mt-2">{metrics?.total_threats_detected || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-slate-500 text-sm font-medium">Addresses blocked</p>
          <p className="text-3xl font-bold mt-2">{blocks?.count || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-slate-500 text-sm font-medium">Average danger level</p>
          <p className="text-3xl font-bold mt-2">{metrics?.average_threat_risk?.toFixed(1) || '0.0'} / 10</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="text-lg font-bold mb-4">Latest alerts</h2>
        <p className="text-slate-500">More charts and alerts list coming soon...</p>
      </div>
    </div>
  );
}
