import React, { useContext, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { ExpertContext } from '../App';
import { AlertCard } from '../components/AlertCard';
import { Skeleton } from '../components/Skeleton';
import { ErrorState } from '../components/ErrorState';
import { useMergedActivity } from '../hooks/useMergedActivity';
import { translateThreat, riskToWord, isBenign } from '../lib/translate';
import { formatTime } from '../lib/time';

export default function Activity() {
  const { expert } = useContext(ExpertContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const { activity, isLoading, error } = useMergedActivity();

  const [searchQuery, setSearchQuery] = useState('');
  const [showBenign, setShowBenign] = useState(false);
  const [tableView, setTableView] = useState(false);

  const filterSource = searchParams.get('source') || 'all';
  const filterDanger = searchParams.get('danger') || 'all';

  const updateParam = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === 'all') {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  };

  const filteredActivity = useMemo(() => {
    if (!activity) return [];
    return activity.filter((item: any) => {
      if (!showBenign && isBenign(item.type)) return false;
      if (filterSource !== 'all') {
        if (filterSource === 'network' && item.source !== 'network') return false;
        if (filterSource === 'computer' && item.source !== 'host') return false;
      }
      if (filterDanger !== 'all') {
        const riskLevel = riskToWord(item.risk_score || 0).label.toLowerCase();
        if (filterDanger === 'critical' && riskLevel !== 'critical') return false;
        if (filterDanger === 'serious' && riskLevel !== 'serious') return false;
        if (filterDanger === 'look' && riskLevel !== 'look') return false;
        if (filterDanger === 'minor' && riskLevel !== 'minor') return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchStr = `${item.type} ${item.src_ip} ${item.process_name}`.toLowerCase();
        if (!searchStr.includes(q)) return false;
      }
      return true;
    });
  }, [activity, filterSource, filterDanger, searchQuery, showBenign]);

  const groupedActivity = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredActivity.forEach((item: any) => {
      const date = dayjs(item.timestamp);
      let groupKey = date.format('MMM D');
      if (date.isSame(dayjs(), 'day')) groupKey = 'Today';
      else if (date.isSame(dayjs().subtract(1, 'day'), 'day')) groupKey = 'Yesterday';
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    return groups;
  }, [filteredActivity]);

  if (error) return <ErrorState message="Failed to load activity." />;

  return (
    <div className="aesthetic-icons space-y-6">
      <div className="bg-[var(--color-sage)] p-6 rounded-[2rem] shadow border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-2">
            {['all', 'network', 'computer'].map(src => (
              <button
                key={src}
                onClick={() => updateParam('source', src)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterSource === src ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-dark hover:bg-slate-200'}`}
              >
                {src.charAt(0).toUpperCase() + src.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {['all', 'critical', 'serious', 'look', 'minor'].map(danger => (
              <button
                key={danger}
                onClick={() => updateParam('danger', danger)}
                className={`px-3 py-1 rounded text-sm transition-colors ${filterDanger === danger ? 'bg-slate-700 text-white' : 'bg-slate-100 text-dark hover:bg-slate-200'}`}
              >
                {danger === 'all' ? 'All Risks' : danger.charAt(0).toUpperCase() + danger.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <input
            type="text"
            placeholder="Search by program name, address or threat type"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-96 px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-dark cursor-pointer">
              <input type="checkbox" checked={showBenign} onChange={e => setShowBenign(e.target.checked)} className="rounded border-slate-300" />
              Show normal activity too
            </label>
            {expert && (
              <label className="flex items-center gap-2 text-sm text-dark cursor-pointer">
                <input type="checkbox" checked={tableView} onChange={e => setTableView(e.target.checked)} className="rounded border-slate-300" />
                Table view
              </label>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="aesthetic-icons space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filteredActivity.length === 0 ? (
        <div className="text-center py-12 text-dark">
          No activity found matching your filters.
        </div>
      ) : expert && tableView ? (
        <div className="bg-[var(--color-sage)] rounded-[2rem] shadow border border-slate-200 overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="text-xs text-dark uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Srcâ†’Dst</th>
                <th className="px-4 py-3">Port</th>
                <th className="px-4 py-3">Confidence %</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivity.map((item: any) => (
                <tr key={item.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-2 whitespace-nowrap">{formatTime(item.timestamp)}</td>
                  <td className="px-4 py-2">{item.source}</td>
                  <td className="px-4 py-2">{translateThreat(item.type).friendly}</td>
                  <td className="px-4 py-2 font-mono text-xs">{item.src_ip} &rarr; {item.dst_ip || '-'}</td>
                  <td className="px-4 py-2">{item.dst_port || '-'}</td>
                  <td className="px-4 py-2">{item.confidence ? Math.round(item.confidence * 100) : '-'}</td>
                  <td className="px-4 py-2">{riskToWord(item.risk_score || 0)}</td>
                  <td className="px-4 py-2">{item.action || 'Logged'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="aesthetic-icons space-y-8">
          {Object.entries(groupedActivity).map(([group, items]) => (
            <div key={group} className="space-y-4">
              <h2 className="text-xl font-bold text-dark border-b pb-2">{group}</h2>
              <div className="aesthetic-icons space-y-3">
                {items.map((item: any) => (
                  <AlertCard key={item.id} alert={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
