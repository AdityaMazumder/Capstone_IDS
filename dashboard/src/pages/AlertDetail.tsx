import { useParams } from 'react-router-dom';

export default function AlertDetail() {
  const { id, source } = useParams();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Alert Details</h1>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <p className="text-slate-500">Details for {source} incident {id} will appear here.</p>
      </div>
    </div>
  );
}
