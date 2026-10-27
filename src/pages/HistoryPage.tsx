import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api.js';
import { VideoJob } from '../types.js';
import { Film, Download, Trash2, Search, ArrowRight, Play, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface HistoryPageProps {
  onOpenOptimizer: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onOpenOptimizer }) => {
  const { user, openAuthModal } = useAuth();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<VideoJob | null>(null);

  const fetchJobs = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getUserJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job and associated files?')) return;
    try {
      await api.deleteJob(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (selectedJob?.id === jobId) setSelectedJob(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filteredJobs = jobs.filter((j) =>
    j.originalFilename.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-800">
          <Film className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Sign in to view job history</h2>
        <p className="text-xs text-neutral-500">
          All your processed videos, technical audits, and download files are stored safely in your private account.
        </p>
        <button
          onClick={() => openAuthModal('login')}
          className="px-5 py-2.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            Optimization History
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Browse and download all your past TikTok encoded clips with audited metrics.
          </p>
        </div>

        <button
          onClick={onOpenOptimizer}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-2"
        >
          <span>New Optimization</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 max-w-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by clip title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-neutral-500 font-mono">
          Loading optimization records...
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-12 text-center space-y-4">
          <div className="w-10 h-10 rounded-lg bg-neutral-200 flex items-center justify-center mx-auto text-neutral-600">
            <Film className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-neutral-900">No optimization jobs found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {search ? 'No jobs match your search keyword.' : 'You have not processed any video clips yet.'}
          </p>
          <button
            onClick={onOpenOptimizer}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors"
          >
            Start First Optimization
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-5">Video Title</th>
                  <th className="py-3 px-5">Tier & Cost</th>
                  <th className="py-3 px-5">Original Size</th>
                  <th className="py-3 px-5">Optimized Size</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {filteredJobs.map((job) => {
                  const origBytes = job.originalMeta?.sizeBytes || 1;
                  const optBytes = job.optimizedMeta?.sizeBytes || 0;
                  const pct = Math.round(((optBytes - origBytes) / origBytes) * 100);

                  return (
                    <tr key={job.id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-neutral-900 truncate max-w-xs">
                          {job.originalFilename}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {job.originalMeta?.width}×{job.originalMeta?.height} · {job.originalMeta?.durationSeconds}s
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <span className="font-semibold capitalize text-neutral-900">
                          {job.optimizationLevel}
                        </span>
                        <span className="text-neutral-500 ml-1 font-mono">
                          ({job.pointCost.toFixed(1)} pts)
                        </span>
                      </td>

                      <td className="py-3.5 px-5 font-mono tabular-nums text-neutral-600">
                        {job.originalMeta?.sizeFormatted || '—'}
                      </td>

                      <td className="py-3.5 px-5">
                        {job.status === 'completed' && job.optimizedMeta ? (
                          <div>
                            <span className="font-mono tabular-nums font-semibold text-neutral-900">
                              {job.optimizedMeta.sizeFormatted}
                            </span>
                            <span className={`text-[11px] font-mono ml-1.5 ${pct < 0 ? 'text-emerald-700' : 'text-neutral-500'}`}>
                              ({pct < 0 ? `${pct}%` : `+${pct}%`})
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        {job.status === 'completed' ? (
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </span>
                        ) : job.status === 'processing' || job.status === 'queued' ? (
                          <span className="text-neutral-900 font-medium flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>{job.progressPercent}%</span>
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="capitalize">{job.status}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 font-mono text-neutral-500 tabular-nums">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-5 text-right space-x-2">
                        {job.status === 'completed' && (
                          <a
                            href={`/api/video/download/${job.id}`}
                            download
                            className="inline-flex p-1.5 text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 rounded transition-colors"
                            title="Download Optimized MP4"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          onClick={() => handleDelete(job.id)}
                          className="inline-flex p-1.5 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded transition-colors"
                          title="Delete Job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
