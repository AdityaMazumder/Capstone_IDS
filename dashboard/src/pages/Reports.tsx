import React, { useState, useEffect, useContext } from 'react';
import { ExpertContext } from '../App';
import { generateReport, getReportDownloadUrl } from '../api/endpoints';
import { FileText, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReportRecord {
  filename: string;
  date: string;
}

export function Reports() {
  const { expert } = useContext(ExpertContext);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sentinel_reports');
    if (saved) {
      try {
        setReports(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse reports');
      }
    }
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateReport();
      const newReport: ReportRecord = {
        filename: result.filename,
        date: new Date().toISOString(),
      };
      
      const newReports = [newReport, ...reports];
      setReports(newReports);
      localStorage.setItem('sentinel_reports', JSON.stringify(newReports));
      toast.success('Report generated successfully');
    } catch (err) {
      console.error(err);
      setError('Failed to generate report. Please try again.');
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900  mb-2">Reports</h1>
        <p className="text-dark dark:text-dark">
          A one-page summary of everything SentinelAI saw and did. Good for keeping records or sharing with IT support.
        </p>
      </div>

      <div className="bg-[var(--color-sage)] rounded-[2rem] p-8 text-center">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <FileText className="w-6 h-6" />
          )}
          Create a security report (PDF)
        </button>
        {error && (
          <p className="mt-4 text-red-500 text-sm font-medium">{error}</p>
        )}
      </div>

      {reports.length > 0 && (
        <div className="bg-[var(--color-sage)] rounded-[2rem] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 border-transparent bg-gray-50 /50">
            <h2 className="text-lg font-medium text-gray-900 ">Past Reports</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {reports.map((r, idx) => (
              <div key={idx} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 ">Security Report</h3>
                    <p className="text-sm text-dark dark:text-dark">
                      {new Date(r.date).toLocaleString()}
                    </p>
                    {expert && (
                      <p className="text-xs text-dark dark:text-dark mt-1 font-mono">
                        {r.filename}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href={getReportDownloadUrl(r.filename)}
                  download={r.filename}
                  className="flex items-center gap-2 px-4 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
