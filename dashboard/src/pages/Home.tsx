import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldAlert, Ban, Gauge, ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import dayjs from 'dayjs';
import { ExpertContext } from '../App';
import { StatusBanner } from '../components/StatusBanner';
import { KpiCard } from '../components/KpiCard';
import { AlertCard } from '../components/AlertCard';
import { InfoTooltip } from '../components/InfoTooltip';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { getMetrics, getBlocks } from '../api/endpoints';
import { useMergedActivity } from '../hooks/useMergedActivity';
import { useOverallStatus } from '../hooks/useOverallStatus';
import { translateThreat, riskToWord, isBenign } from '../lib/translate';
import { getHourBucket } from '../lib/time';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function Home() {
  const { expert } = useContext(ExpertContext);
  
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
    refetchInterval: 10000,
  });

  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ['blocks'],
    queryFn: getBlocks,
    refetchInterval: 15000,
  });

  const { activity, isLoading: activityLoading } = useMergedActivity();
  const overallStatus = useOverallStatus();

  const chartData = useMemo(() => {
    if (!activity) return [];
    const buckets: Record<string, number> = {};
    const now = dayjs();
    for (let i = 23; i >= 0; i--) {
      buckets[now.subtract(i, 'hour').format('HA')] = 0;
    }
    
    activity.forEach((item: any) => {
      if (now.diff(dayjs(item.timestamp * 1000), 'hour') < 24) {
        const bucket = dayjs(item.timestamp * 1000).format('HA');
        if (buckets[bucket] !== undefined) {
          buckets[bucket]++;
        }
      }
    });

    return Object.entries(buckets).map(([time, count]) => ({ time, threats: count }));
  }, [activity]);

  const pieData = useMemo(() => {
    if (!metrics?.attack_distribution) return [];
    return Object.entries(metrics.attack_distribution)
      .filter(([type]) => !isBenign(type))
      .map(([type, count]) => ({
        name: translateThreat(type).title,
        value: count as number,
        rawType: type
      }))
      .sort((a, b) => b.value - a.value);
  }, [metrics]);

  const latestAlerts = useMemo(() => {
    if (!activity) return [];
    return activity.filter((a: any) => !isBenign(a.type)).slice(0, 5);
  }, [activity]);

  const topOffender = metrics?.top_offenders?.[0];

  return (
    <div className="space-y-6">
      <StatusBanner {...overallStatus} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricsLoading ? <Skeleton className="h-24 w-full" /> : (
          <KpiCard
            icon={<Activity size={24} />}
            value={new Intl.NumberFormat().format(metrics?.total_flows_analyzed || 0)}
            title="Network activity checked"
            helperText="Connections SentinelAI has inspected"
          />
        )}
        {metricsLoading ? <Skeleton className="h-24 w-full" /> : (
          <KpiCard
            icon={<ShieldAlert size={24} />}
            value={new Intl.NumberFormat().format((metrics?.total_threats_detected || 0) + (activity?.filter((a: any) => a.source === 'host').length || 0))}
            title="Threats caught"
            helperText="Suspicious things we found and handled"
          />
        )}
        {blocksLoading ? <Skeleton className="h-24 w-full" /> : (
          <KpiCard
            icon={<Ban size={24} />}
            value={new Intl.NumberFormat().format(blocks?.count || 0)}
            title="Addresses blocked"
            helperText="Outsiders currently kept out"
          />
        )}
        {metricsLoading ? <Skeleton className="h-24 w-full" /> : (
          <KpiCard
            icon={<Gauge size={24} />}
            value={`${(metrics?.average_threat_risk || 0).toFixed(1)} / 10`}
            title="Average danger level"
            helperText={`Current network risk is ${riskToWord(metrics?.average_threat_risk || 0).label.toLowerCase()}`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--color-sage)] p-6 rounded-[2rem]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg text-[#1A1A1A] font-bold flex items-center gap-2">
              What happened today
              <InfoTooltip text="Number of threats stopped per hour over the last 24 hours" />
            </h2>
          </div>
          {activityLoading ? <Skeleton className="h-64 w-full" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="time" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [value, 'Threats']}
                    labelStyle={{ color: '#1A1A1A', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="threats" stroke="#4F46E5" strokeWidth={3} fill="#4F46E5" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg text-[#1A1A1A] font-bold flex items-center gap-2">
              Types of threats
              <InfoTooltip text="Breakdown of all blocked attacks" />
            </h2>
          </div>
          {metricsLoading ? <Skeleton className="h-64 w-full" /> : pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-[#1A1A1A] font-bold">No threats today</div>
          ) : (
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1A1A1A', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-[#1A1A1A]">{metrics?.total_threats_detected || 0}</span>
                <span className="text-xs text-[#1A1A1A] font-bold uppercase">Total</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[var(--color-sage)] p-6 rounded-[2rem]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-lg text-[#1A1A1A] font-bold">Latest alerts</h2>
          <Link to="/activity" className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center">
            See all activity <ChevronRight size={16} />
          </Link>
        </div>
        
        {activityLoading ? <Skeleton className="h-32 w-full mb-2" count={3} /> : latestAlerts.length === 0 ? (
          <div className="text-center py-8 text-[#1A1A1A] font-bold">
            All clear! No recent threats detected.
          </div>
        ) : (
          <div className="space-y-3">
            {latestAlerts.map((alert: any) => (
              <AlertCard key={`${alert.source}-${alert.id}`} alert={alert} />
            ))}
          </div>
        )}
      </div>

      {topOffender && (
        <div className="bg-[var(--color-sage)] p-6 rounded-[2rem]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg text-[#1A1A1A] font-bold flex items-center gap-2">
              Most active troublemaker
              <InfoTooltip text="The outside address that tried to connect the most" />
            </h2>
          </div>
          
          {!expert ? (
            <p className="text-[#1A1A1A] font-bold">
              Most attempts came from 1 outside address, now blocked.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-[#1A1A1A] font-bold uppercase">Address</th>
                    <th className="pb-3 text-[#1A1A1A] font-bold uppercase">Attempts</th>
                    <th className="pb-3 text-[#1A1A1A] font-bold uppercase">Peak Danger</th>
                    <th className="pb-3 text-[#1A1A1A] font-bold uppercase">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 font-mono text-[#1A1A1A] font-bold">{topOffender.src_ip}</td>
                    <td className="py-3 text-[#1A1A1A] font-bold">{topOffender.incident_count}</td>
                    <td className="py-3 text-[#1A1A1A] font-bold">{topOffender.max_risk_score.toFixed(1)}</td>
                    <td className="py-3 text-[#1A1A1A] font-bold">{dayjs(topOffender.last_seen * 1000).fromNow()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}