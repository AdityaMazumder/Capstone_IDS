import { useQuery } from '@tanstack/react-query';
import { Shield, Lock, KeyRound, Key, CreditCard, Wallet, AlertTriangle } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { Skeleton, ErrorState, AlertCard } from '../components/index';
import { getHostIncidents } from '../api/endpoints';
import { hostIncidentToAlert } from '../hooks/useMergedActivity';

dayjs.extend(relativeTime);

export default function Computer() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['host-incidents', 100],
    queryFn: () => getHostIncidents(100),
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (error) return <div className="p-6"><ErrorState message="Could not load host incidents." /></div>;

  const incidents = data?.host_incidents ?? [];
  const stoppedCount = incidents.filter((i) => i.soar_action === 'TERMINATE_PROCESS').length;

  const protectedItems = [
    { id: 'passwords', name: 'Saved browser passwords', icon: Lock, status: 'safe', lastAccessed: null },
    { id: 'cookies', name: 'Login sessions/cookies', icon: KeyRound, status: 'safe', lastAccessed: null },
    { id: 'masterkey', name: 'Browser master key', icon: Key, status: 'safe', lastAccessed: null },
    { id: 'cards', name: 'Autofill data and saved cards', icon: CreditCard, status: 'safe', lastAccessed: null },
    { id: 'wallet', name: 'Crypto wallet', icon: Wallet, status: 'safe', lastAccessed: null },
  ];

  return (
    <div className="aesthetic-icons max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="bg-[var(--color-sage)] p-4 rounded-[1.5rem] shrink-0">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">Computer Protection</h1>
            <p className="text-dark max-w-3xl leading-relaxed">
              SentinelAI watches for programs that secretly open your saved passwords, login cookies or crypto wallet. That's how password-stealing malware works.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg text-sm font-medium text-dark shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Programs stopped: {stoppedCount}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Protected Items</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {protectedItems.map((item) => (
            <div key={item.id} className="bg-[var(--color-sage)] p-6 rounded-[2rem] flex items-start gap-4">
              <div className={`p-2.5 rounded-lg shrink-0 ${item.status === 'safe' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{item.name}</p>
                {item.status === 'safe' ? (
                  <p className="text-sm text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Guarded
                  </p>
                ) : (
                  <p className="text-sm text-orange-600 mt-1 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Accessed by an unknown program {dayjs(item.lastAccessed).fromNow()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-gray-800 mb-4">Recent Computer Activity</h2>
        {incidents.length === 0 ? (
          <div className="bg-[var(--color-sage)] rounded-[2rem] p-8 text-center text-dark">
            No recent incidents found.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {incidents.map((incident) => (
              <AlertCard key={incident.incident_id} alert={hostIncidentToAlert(incident)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

