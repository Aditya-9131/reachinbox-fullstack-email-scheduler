import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { StatsCards } from '../components/StatsCards';
import { SearchBar } from '../components/SearchBar';
import { ScheduledTable } from '../components/ScheduledTable';
import { SentTable } from '../components/SentTable';
import { ComposeModal } from '../components/ComposeModal';
import { SlackModal } from '../components/SlackModal';
import { emailApi, statsApi, slackApi } from '../lib/api';
import { DashboardStats, EmailJob, SlackConfig } from '../types';
import { RefreshCw, Activity, Filter, ShieldCheck } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'analytics'>('scheduled');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [slackConfig, setSlackConfig] = useState<SlackConfig | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSenderFilter, setSelectedSenderFilter] = useState('');

  // Modals state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch all dashboard data
  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      const [statsData, scheduledData, sentData, slackData] = await Promise.all([
        statsApi.getOverview(),
        emailApi.getScheduled({ sender: selectedSenderFilter || undefined }),
        emailApi.getSent({ sender: selectedSenderFilter || undefined }),
        slackApi.getStatus(),
      ]);

      setStats(statsData);
      setScheduledEmails(scheduledData.data || []);
      setSentEmails(sentData.data || []);
      setSlackConfig(slackData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSenderFilter]);

  // Handle Elasticsearch Search
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) {
        fetchData();
        return;
      }

      setIsSearching(true);
      try {
        const searchResult = await emailApi.search({
          q: query,
          status: activeTab === 'scheduled' ? 'SCHEDULED' : activeTab === 'sent' ? 'SENT' : undefined,
          sender: selectedSenderFilter || undefined,
        });

        if (activeTab === 'scheduled') {
          setScheduledEmails(searchResult.data.filter((e) => ['SCHEDULED', 'RATE_LIMITED_RESCHEDULED', 'PROCESSING'].includes(e.status)));
        } else if (activeTab === 'sent') {
          setSentEmails(searchResult.data.filter((e) => ['SENT', 'FAILED'].includes(e.status)));
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    },
    [activeTab, fetchData, selectedSenderFilter]
  );

  // Initial load and periodic polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (!searchQuery) {
        fetchData();
      }
    }, 4000); // Live poll every 4 seconds to observe queue progress

    return () => clearInterval(interval);
  }, [fetchData, searchQuery]);

  const handleCancelEmail = async (id: string) => {
    try {
      await emailApi.cancel(id);
      fetchData();
    } catch (err) {
      console.error('Failed to cancel email:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <Header
        slackConfig={slackConfig}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onOpenComposeModal={() => setIsComposeOpen(true)}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          scheduledCount={stats?.scheduledCount || 0}
          sentCount={stats?.sentCount || 0}
          onOpenComposeModal={() => setIsComposeOpen(true)}
        />

        {/* Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* Top Metric Cards */}
          <StatsCards stats={stats} />

          {/* Section Header & Search Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800/80 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-base font-bold text-white tracking-tight">
                {activeTab === 'scheduled' && 'Scheduled Emails Queue'}
                {activeTab === 'sent' && 'Sent & Delivered Emails'}
                {activeTab === 'analytics' && 'Queue Health & Quota Analytics'}
              </h2>
              {searchQuery && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                  Filtered by: "{searchQuery}"
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {/* Sender Filter */}
              {activeTab !== 'analytics' && (
                <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={selectedSenderFilter}
                    onChange={(e) => setSelectedSenderFilter(e.target.value)}
                    className="bg-transparent outline-none text-xs text-slate-200 cursor-pointer"
                  >
                    <option value="">All Senders</option>
                    <option value="growth@reachinbox.ai">growth@reachinbox.ai</option>
                    <option value="sales@outboxlabs.com">sales@outboxlabs.com</option>
                    <option value="partnerships@reachinbox.io">partnerships@reachinbox.io</option>
                  </select>
                </div>
              )}

              {/* Elasticsearch Search Bar */}
              {activeTab !== 'analytics' && (
                <SearchBar
                  value={searchQuery}
                  onChange={handleSearch}
                  isSearching={isSearching}
                  placeholder={`Search ${activeTab} emails...`}
                />
              )}

              {/* Refresh Button */}
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                title="Refresh queue status"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Main Table / View Views */}
          {activeTab === 'scheduled' && (
            <ScheduledTable
              emails={scheduledEmails}
              loading={loading}
              onCancel={handleCancelEmail}
              onOpenCompose={() => setIsComposeOpen(true)}
            />
          )}

          {activeTab === 'sent' && (
            <SentTable
              emails={sentEmails}
              loading={loading}
              onOpenCompose={() => setIsComposeOpen(true)}
            />
          )}

          {activeTab === 'analytics' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* BullMQ Real-time State */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span>BullMQ Queue Breakdown</span>
                    </h3>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-mono">
                      email-queue
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400">Delayed (Scheduled)</span>
                      <span className="font-semibold text-blue-400 font-mono">
                        {stats.queueCounts.delayed}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400">Active (Processing)</span>
                      <span className="font-semibold text-purple-400 font-mono">
                        {stats.queueCounts.active}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400">Waiting (Immediate)</span>
                      <span className="font-semibold text-amber-400 font-mono">
                        {stats.queueCounts.waiting}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400">Completed (Delivered)</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        {stats.queueCounts.completed}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rate Limit Rules */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Rate Limiting & Throttling</span>
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400">Hourly Limit / Sender</div>
                      <div className="text-sm font-bold text-amber-400 font-mono">
                        {stats.rateLimitInfo.hourlyLimitPerSender} emails/hour
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Tracks Redis sliding windows. Auto-reschedules excess emails into next hour window.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400">Inter-Email Throttle Delay</div>
                      <div className="text-sm font-bold text-blue-400 font-mono">
                        {stats.rateLimitInfo.delayBetweenSendsSeconds}s delay
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Mimics realistic provider throttling between individual sends.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Infrastructure Overview */}
                <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-semibold text-white">System Architecture</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Scheduler Engine</span>
                      <span className="text-emerald-400 font-medium">BullMQ + Redis (No Cron)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Worker Concurrency</span>
                      <span className="text-white font-mono">{stats.rateLimitInfo.workerConcurrency} workers</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">SMTP Provider</span>
                      <span className="text-blue-400 font-medium">Ethereal Fake SMTP</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Elasticsearch Index</span>
                      <span className="text-emerald-400 font-medium">
                        {stats.rateLimitInfo.elasticsearchHealthy ? 'Active & Ready' : 'DB Search Fallback'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Compose & Schedule Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          fetchData(true);
          setActiveTab('scheduled');
        }}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackConfig={slackConfig}
        onStatusChange={() => fetchData()}
      />
    </div>
  );
};
