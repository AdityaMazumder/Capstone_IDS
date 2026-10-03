import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';

export default function Blocked() {
  const { data: blocks, isLoading } = useQuery({
    queryKey: ['blocks'],
    queryFn: endpoints.getBlocks,
    refetchInterval: 15000,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Blocked Connections</h1>
      <p className="text-slate-600 dark:text-slate-400">These outside addresses tried to harm your computer. SentinelAI is keeping them out.</p>
      
      {isLoading ? (
        <div className="p-4">Loading...</div>
      ) : blocks?.count === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 text-center rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <p className="text-slate-500">No one is blocked right now. That's a good thing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks?.blocked_ips?.map((block: any) => (
            <div key={block.rule_id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="font-bold">{block.ip_address}</h3>
                <p className="text-sm text-slate-500">{block.reason}</p>
              </div>
              <button className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
