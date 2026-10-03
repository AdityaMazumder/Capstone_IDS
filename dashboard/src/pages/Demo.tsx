import { useContext, useState } from 'react';
import { ExpertContext } from '../App';
import { ingestFlow, ingestHostEvent } from '../api/endpoints';
import { toast } from 'sonner';
import { Zap, ShieldAlert, Search, EyeOff, CheckCircle, Loader2 } from 'lucide-react';

export function Demo() {
  const { expert } = useContext(ExpertContext);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  if (!expert) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full mb-4">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900  mb-2">Restricted Access</h2>
        <p className="text-dark dark:text-dark max-w-md">
          Switch to Expert view in Settings to access the Demo Panel and simulate attacks.
        </p>
      </div>
    );
  }

  const handleSimulate = async (id: number, action: () => Promise<any>, successMsg: string) => {
    setLoadingId(id);
    try {
      await action();
      toast.success(successMsg);
    } catch (err) {
      toast.error('Simulation failed to send');
      console.error(err);
    } finally {
      // Disable for 2 seconds visually, but release loading state to just show disabled
      setTimeout(() => {
        setLoadingId(null);
      }, 2000);
    }
  };

  const demos = [
    {
      id: 1,
      title: 'Simulate password-guessing attack (SSH)',
      description: 'Sends a flow indicating repeated SSH connection attempts.',
      icon: <ShieldAlert className="w-6 h-6" />,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      action: () => ingestFlow({ dst_port: 22, syn_flag_count: 50, flow_pkts_s: 500 })
    },
    {
      id: 2,
      title: 'Simulate flood attack (DDoS)',
      description: 'Sends a massive volume of packets to overwhelm the system.',
      icon: <Zap className="w-6 h-6" />,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      action: () => ingestFlow({ flow_pkts_s: 50000, tot_fwd_pkts: 10000 })
    },
    {
      id: 3,
      title: 'Simulate port scan',
      description: 'Sends reconnaissance traffic scanning for open ports.',
      icon: <Search className="w-6 h-6" />,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      action: () => ingestFlow({ dst_port: 0, syn_flag_count: 100 })
    },
    {
      id: 4,
      title: 'Simulate password-stealer program',
      description: 'Simulates a host process accessing sensitive browser data.',
      icon: <EyeOff className="w-6 h-6" />,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      action: () => ingestHostEvent({
        pid: 40000 + Math.floor(Math.random() * 20000),
        process_name: 'svc_update.exe',
        parent_name: 'powershell.exe',
        file_path: 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Login Data',
        event_type: 'READ',
        label: 'Stealer',
        confidence: 0.97,
      })
    },
    {
      id: 5,
      title: 'Simulate normal traffic',
      description: 'Sends standard benign network flow data.',
      icon: <CheckCircle className="w-6 h-6" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      action: () => ingestFlow({ dst_port: 443, flow_pkts_s: 10, tot_fwd_pkts: 5 })
    }
  ];

  return (
    <div className="aesthetic-icons space-y-6 max-w-5xl mx-auto p-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900  mb-2">Demo Panel</h1>
        <p className="text-dark dark:text-dark">
          Inject mock data into the system to test the detection and alerting capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demos.map((demo) => {
          const isLoading = loadingId === demo.id;
          return (
            <button
              key={demo.id}
              onClick={() => handleSimulate(demo.id, demo.action, 'Attack sent, watch the Home page')}
              disabled={loadingId !== null}
              className="text-left bg-[var(--color-sage)] p-6 rounded-[2rem] hover:border-blue-500 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${demo.bg} ${demo.color}`}>
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : demo.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900  mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {demo.title}
                  </h3>
                  <p className="text-sm text-dark dark:text-dark">
                    {demo.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
