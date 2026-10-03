import React, { useContext, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Shield, ShieldOff, Clock, TestTube, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { ExpertContext } from '../App';
import { Skeleton, ErrorState, ConfirmModal } from '../components/index';
import { getBlocks, unblockIP } from '../api/endpoints';
import { translateThreat } from '../lib/translate';
import {} from '../components/index';
import { toast } from 'sonner';

dayjs.extend(relativeTime);

export default function Blocked() {
  const { expert } = useContext(ExpertContext);
  const queryClient = useQueryClient();
  const [selectedIp, setSelectedIp] = useState<string | null>(null);

  const { data: blocks = [], isLoading, error } = useQuery({
    queryKey: ['blocks'],
    queryFn: getBlocks,
    refetchInterval: 15000,
  });

  const unblockMutation = useMutation({
    mutationFn: unblockIP,
    onMutate: async (ip) => {
      await queryClient.cancelQueries({ queryKey: ['blocks'] });
      const previousBlocks = queryClient.getQueryData(['blocks']);
      queryClient.setQueryData(['blocks'], (old: any) =>
        old?.map((b: any) => b.ip_address === ip ? { ...b, status: 'RELEASED' } : b)
      );
      return { previousBlocks };
    },
    onError: (err, ip, context) => {
      queryClient.setQueryData(['blocks'], context?.previousBlocks);
      toast.error('Failed to unblock address');
    },
    onSuccess: () => {
      toast.success('Address unblocked');
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    },
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (error) return <div className="p-6"><ErrorState message="Could not load blocked addresses." /></div>;

  const handleUnblock = (ip: string) => {
    setSelectedIp(ip);
  };

  const confirmUnblock = () => {
    if (selectedIp) {
      unblockMutation.mutate(selectedIp);
      setSelectedIp(null);
    }
  };

  const maskIp = (ip: string) => {
    if (expert) return ip;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `Outside computer ${parts[0]}.${parts[1]}.x.x`;
    }
    return 'Outside computer';
  };

  const selectedBlock = blocks.find((b: any) => b.ip_address === selectedIp);
  const selectedReason = selectedBlock ? translateThreat(selectedBlock.reason || 'Unknown').friendly : '';

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">Blocked Addresses</h1>
        <p className="text-dark">These outside addresses tried to harm your computer. SentinelAI is keeping them out.</p>
      </div>

      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-800">No one is blocked right now</h3>
          <p className="text-dark mt-2">That's a good thing. We'll keep watching.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {blocks.map((block: any) => {
            const threatInfo = translateThreat(block.reason || 'Unknown');
            const timeSince = dayjs(block.block_timestamp).fromNow();
            const expiry = block.expiry_timestamp ? dayjs(block.expiry_timestamp) : null;
            const isPermanent = !expiry;
            let timerText = "Permanent";
            if (!isPermanent && expiry) {
                const diffHours = expiry.diff(dayjs(), 'hour');
                const diffMins = expiry.diff(dayjs(), 'minute') % 60;
                timerText = diffHours > 0 ? `${diffHours}h ${diffMins}m remaining` : `${diffMins}m remaining`;
            }

            let statusColor = 'bg-emerald-100 text-emerald-700';
            let statusText = 'Blocked';
            if (block.status === 'SIMULATED') {
              statusColor = 'bg-blue-100 text-blue-700';
              statusText = 'Test mode';
            } else if (block.status === 'RELEASED') {
              statusColor = 'bg-gray-100 text-dark';
              statusText = 'Unblocked';
            } else if (block.status === 'FAILED') {
              statusColor = 'bg-rose-100 text-rose-700';
              statusText = "Couldn't block";
            }

            return (
              <div key={block.id || block.ip_address} className="bg-[var(--color-sage)] rounded-[2rem] p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="font-mono text-sm font-medium text-gray-800 bg-gray-50 px-2 py-1 rounded">
                    {maskIp(block.ip_address)}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>
                    {statusText}
                  </span>
                </div>
                
                <div className="mb-4 flex-1">
                  <p className="text-sm font-medium text-dark">{threatInfo.title}</p>
                  <p className="text-xs text-dark mt-1">Blocked {timeSince}</p>
                  {block.status === 'ACTIVE' && (
                    <p className="text-xs text-dark mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timerText}
                    </p>
                  )}
                </div>

                {(block.status === 'ACTIVE' || block.status === 'SIMULATED') && (
                  <button 
                    onClick={() => handleUnblock(block.ip_address)}
                    className="w-full py-2 px-4 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-dark rounded-lg transition-colors border border-gray-200"
                  >
                    Unblock Address
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedIp && (
        <ConfirmModal
          title={`Unblock ${maskIp(selectedIp)}?`}
          description={`This address tried to ${selectedReason}. It will be able to reach your computer again.`}
          primaryAction="Keep blocked"
          secondaryAction="Unblock anyway"
          onConfirm={() => setSelectedIp(null)}
          onSecondary={confirmUnblock}
          onClose={() => setSelectedIp(null)}
        />
      )}
    </div>
  );
}

