import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';

export default function Computer() {
  const { data, isLoading } = useQuery({
    queryKey: ['host-incidents'],
    queryFn: endpoints.getHostIncidents,
    refetchInterval: 15000,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Computer Protection</h1>
      <p className="text-slate-600 dark:text-slate-400">
        SentinelAI watches for programs that secretly open your saved passwords, login cookies or crypto wallet.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Protected items mock grid */}
        {['Your saved browser passwords', 'Your login sessions', 'Your autofill data'].map(item => (
          <div key={item} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center">
             <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
             </div>
             <h3 className="font-medium text-sm">{item}</h3>
             <span className="text-emerald-600 text-sm font-semibold mt-1">Guarded</span>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold mt-8">Recent Computer Threats</h2>
      {isLoading ? <div>Loading...</div> : (
        <div className="space-y-3">
           {data?.host_incidents?.length ? data.host_incidents.map((inc: any) => (
             <div key={inc.incident_id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               <p className="font-bold">{inc.process_name}</p>
               <p className="text-sm text-slate-500">{inc.file_type || inc.file_path}</p>
             </div>
           )) : (
             <p className="text-slate-500">No computer threats detected.</p>
           )}
        </div>
      )}
    </div>
  );
}
