'use client';

import { useApp } from '@/app/providers';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Sparkline SVG for metric cards
function Sparkline({ pathD, areaD, color = 'text-blue-500' }: { pathD: string; areaD: string; color?: string }) {
  return (
    <div className="h-10 w-full overflow-hidden">
      <svg className={`w-full h-full sparkline ${color}`} preserveAspectRatio="none" viewBox="0 0 120 40">
        <path d={pathD} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2} />
        <path d={areaD} fill="currentColor" fillOpacity={0.1} stroke="none" />
      </svg>
    </div>
  );
}

const NOTIFICATIONS = [
  { id: '1', title: 'New lead added', desc: 'Sarah Jenkins was assigned to you.', time: '10 min ago', dot: 'bg-blue-500' },
  { id: '2', title: 'Meeting confirmed', desc: 'Product demo with TechCorp.', time: '1 hour ago', dot: 'bg-green-500' },
  { id: '3', title: 'Task overdue', desc: 'Follow up with Mike regarding contract.', time: '2 hours ago', dot: 'bg-gray-300 dark:bg-slate-600' },
];

export default function DashboardOverviewAdminOS() {
  const { profile } = useApp();
  const router = useRouter();
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    savedProspects: 0,
    activeListings: 0,
    avgPropertyValue: 0,
    expiredListings: 0,
    pipelineValue: 0,
    conversionRate: 0,
    funnelStages: [] as { name: string; count: number; value: string; widthPct: number }[],
    stageDistribution: [] as { name: string; heightPct: number; bg: string; fill: string }[],
  });
  const [tasks, setTasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);

  const fetchData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: listings } = await supabase
        .from('listings')
        .select('listing_id, status, active, list_price')
        .order('created_at', { ascending: false });
      const total = listings?.length ?? 0;
      const active = listings?.filter((l) => l.active === true).length ?? 0;
      const expired =
        listings?.filter((l) =>
          l.status
            ? /expired|sold|off.?market/i.test(String(l.status))
            : false
        ).length ?? 0;
      const totalValue =
        listings?.reduce((sum, l) => sum + (typeof l.list_price === 'number' ? l.list_price : parseFloat(String(l.list_price || 0)) || 0), 0) ?? 0;
      const avgValue = total > 0 ? Math.round(totalValue / total) : 0;

      const { data: deals } = await supabase
        .from('deals')
        .select('id, stage, value')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      const pipelineValue = deals?.reduce((sum, d) => sum + (typeof d.value === 'number' ? d.value : parseFloat(String(d.value || 0)) || 0), 0) ?? 0;
      const closedWon = deals?.filter((d) => d.stage === 'closed_won').length ?? 0;
      const conversionRate = (deals?.length ?? 0) > 0 ? Math.round((closedWon / (deals?.length ?? 1)) * 100) : 0;

      const stages = [
        { name: 'Lead', key: 'new', value: 0 },
        { name: 'Contact', key: 'contacted', value: 0 },
        { name: 'Proposal', key: 'proposal', value: 0 },
        { name: 'Negotiation', key: 'negotiation', value: 0 },
      ];
      const dealList = deals ?? [];
      const funnelCounts = stages.map((s) => ({
        ...s,
        count: dealList.filter((d) => (d.stage || '').toLowerCase().includes(s.key)).length || (s.key === 'new' ? dealList.length : 0),
      }));
      const maxCount = Math.max(...funnelCounts.map((f) => f.count), 1);
      const funnelStages = funnelCounts.map((f, i) => ({
        name: `${f.name} (${f.count})`,
        count: f.count,
        value: `$${Math.round((pipelineValue * (f.count / (dealList.length || 1))) / 1000)}k`,
        widthPct: 100 - i * 15,
      }));

      const stageDist = [
        { name: 'New', heightPct: 65, bg: 'bg-blue-100 dark:bg-blue-900/30', fill: 'bg-blue-500' },
        { name: 'Qual', heightPct: 80, bg: 'bg-indigo-100 dark:bg-indigo-900/30', fill: 'bg-indigo-500' },
        { name: 'Prop', heightPct: 45, bg: 'bg-violet-100 dark:bg-violet-900/30', fill: 'bg-violet-500' },
        { name: 'Won', heightPct: 30, bg: 'bg-purple-100 dark:bg-purple-900/30', fill: 'bg-purple-500' },
      ];
      setMetrics({
        savedProspects: total,
        activeListings: active,
        avgPropertyValue: avgValue,
        expiredListings: expired,
        pipelineValue,
        conversionRate,
        funnelStages: funnelStages.length ? funnelStages : [
          { name: 'Lead (142)', count: 142, value: '$1.2M', widthPct: 100 },
          { name: 'Contact (84)', count: 84, value: '$980k', widthPct: 90 },
          { name: 'Proposal (45)', count: 45, value: '$1.8M', widthPct: 75 },
          { name: 'Negotiation (12)', count: 12, value: '$450k', widthPct: 50 },
        ],
        stageDistribution: stageDist,
      });

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('user_id', profile.id)
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5);
      setTasks(
        (tasksData ?? []).map((t) => ({
          id: t.id,
          title: t.title || 'Untitled',
          completed: t.status === 'completed',
        }))
      );
    } catch (e) {
      console.error('Dashboard overview fetch error:', e);
      setMetrics((m) => ({
        ...m,
        funnelStages: [
          { name: 'Lead (142)', count: 142, value: '$1.2M', widthPct: 100 },
          { name: 'Contact (84)', count: 84, value: '$980k', widthPct: 90 },
          { name: 'Proposal (45)', count: 45, value: '$1.8M', widthPct: 75 },
          { name: 'Negotiation (12)', count: 12, value: '$450k', widthPct: 50 },
        ],
      }));
    } finally {
      setLoading(false);
    }
  }, [profile?.id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}k`;
    return `$${n}`;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-40 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/5 via-secondary/5 to-white dark:from-primary/10 dark:via-secondary/10 dark:to-card-dark border border-primary/10 shadow-sm p-6 sm:p-10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary-light dark:text-white mb-2">
              Welcome Back, {profile?.name || 'User'}
            </h1>
            <p className="text-text-secondary-light dark:text-gray-400 max-w-xl">
              You have {metrics.activeListings} active listings and your portfolio metrics are updated below. Track prospects and deals in one place.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-text-primary-light dark:text-white px-4 py-2.5 rounded-xl border border-border-light dark:border-slate-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Icon icon="material-symbols:file-download-rounded" className="text-base w-4 h-4" />
              Export Report
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/prospect-enrich')}
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Icon icon="material-symbols:add-rounded" className="text-base w-4 h-4" />
              New Listing
            </button>
          </div>
        </div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-50"
          style={{
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoOTksIDEwMiwgMjQxLCAwLjAzKSIvPjwvc3ZnPg==")`,
          }}
        />
      </div>

      {/* Prospecting Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary-light dark:text-white flex items-center gap-2">
            <Icon icon="material-symbols:person-search-rounded" className="text-primary w-5 h-5" />
            Prospecting Overview
          </h2>
          <Link href="/dashboard/prospect-enrich" className="text-sm text-primary font-medium hover:underline">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                <Icon icon="material-symbols:bookmark-outline-rounded" className="text-xl w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                <Icon icon="material-symbols:trending-up-rounded" className="text-[14px] mr-0.5 w-4 h-4" /> 12%
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-text-primary-light dark:text-white">{metrics.savedProspects.toLocaleString()}</div>
            <p className="text-xs text-text-secondary-light dark:text-gray-400 mb-4">Saved Prospects</p>
            <Sparkline pathD="M0,35 Q10,32 20,25 T40,28 T60,20 T80,25 T100,10 T120,15" areaD="M0,40 L0,35 Q10,32 20,25 T40,28 T60,20 T80,25 T100,10 T120,15 L120,40 Z" color="text-blue-500" />
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl">
                <Icon icon="material-symbols:home-work-outline-rounded" className="text-xl w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                <Icon icon="material-symbols:trending-up-rounded" className="text-[14px] mr-0.5 w-4 h-4" /> 4%
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-text-primary-light dark:text-white">{metrics.activeListings}</div>
            <p className="text-xs text-text-secondary-light dark:text-gray-400 mb-4">Active Listings</p>
            <Sparkline pathD="M0,30 Q15,30 30,25 T60,20 T90,25 T120,15" areaD="M0,40 L0,30 Q15,30 30,25 T60,20 T90,25 T120,15 L120,40 Z" color="text-purple-500" />
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
                <Icon icon="material-symbols:payments-rounded" className="text-xl w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                <Icon icon="material-symbols:trending-up-rounded" className="text-[14px] mr-0.5 w-4 h-4" /> 2.1%
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-text-primary-light dark:text-white">{formatCurrency(metrics.avgPropertyValue)}</div>
            <p className="text-xs text-text-secondary-light dark:text-gray-400 mb-4">Avg Property Value</p>
            <Sparkline pathD="M0,25 Q20,35 40,25 T80,20 T120,5" areaD="M0,40 L0,25 Q20,35 40,25 T80,20 T120,5 L120,40 Z" color="text-green-500" />
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">
                <Icon icon="material-symbols:timer-off-rounded" className="text-xl w-5 h-5" />
              </div>
              <span className="flex items-center text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                <Icon icon="material-symbols:trending-down-rounded" className="text-[14px] mr-0.5 w-4 h-4" /> -18%
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-text-primary-light dark:text-white">{metrics.expiredListings}</div>
            <p className="text-xs text-text-secondary-light dark:text-gray-400 mb-4">Expired Listings</p>
            <Sparkline pathD="M0,10 Q30,15 60,25 T120,35" areaD="M0,40 L0,10 Q30,15 60,25 T120,35 L120,40 Z" color="text-red-500" />
          </div>
        </div>
      </div>

      {/* Deals Analytics */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-text-primary-light dark:text-white flex items-center gap-2">
          <Icon icon="material-symbols:pie-chart-rounded" className="text-primary w-5 h-5" />
          Deals Analytics
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-3 flex flex-col gap-5">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm flex-1 flex flex-col justify-center">
              <div className="text-sm text-text-secondary-light dark:text-gray-400 mb-1 font-medium">Pipeline Value</div>
              <div className="text-3xl font-bold text-text-primary-light dark:text-white tracking-tight">{formatCurrency(metrics.pipelineValue)}</div>
              <div className="text-xs text-green-600 mt-2 font-medium flex items-center">
                <Icon icon="material-symbols:arrow-upward-rounded" className="text-sm mr-1 w-4 h-4" />
                +$340k vs last month
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm flex-1 flex flex-col justify-center">
              <div className="text-sm text-text-secondary-light dark:text-gray-400 mb-1 font-medium">Conversion Rate</div>
              <div className="text-3xl font-bold text-text-primary-light dark:text-white tracking-tight">{metrics.conversionRate}%</div>
              <div className="text-xs text-text-secondary-light dark:text-gray-400 mt-2 font-medium">Top 15% of agents</div>
              <div className="w-full bg-gray-100 dark:bg-slate-700 h-1.5 mt-3 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(metrics.conversionRate, 100)}%` }} />
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-text-primary-light dark:text-white">Pipeline Funnel</h3>
              <button type="button" aria-label="More options" className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-text-secondary-light">
                <Icon icon="material-symbols:more-horiz-rounded" className="text-lg w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {metrics.funnelStages.map((stage, i) => (
                <div key={stage.name} className="relative w-full" style={{ width: i === 0 ? '100%' : `${stage.widthPct}%`, marginLeft: i > 0 ? 'auto' : undefined, marginRight: i > 0 ? 'auto' : undefined }}>
                  <div className="flex justify-between text-xs mb-1 font-medium text-text-secondary-light dark:text-gray-400">
                    <span>{stage.name}</span>
                    <span>{stage.value}</span>
                  </div>
                  <div className="w-full h-8 bg-indigo-50 dark:bg-slate-700/50 rounded-lg relative overflow-hidden group cursor-pointer">
                    <div className="absolute top-0 left-0 h-full bg-primary/80 rounded-lg transition-all duration-500 group-hover:bg-primary" style={{ width: '100%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-text-primary-light dark:text-white">Stage Distribution</h3>
              <span className="text-xs text-text-secondary-light border border-border-light dark:border-slate-600 px-2 py-1 rounded-md">This Week</span>
            </div>
            <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2">
              {metrics.stageDistribution.map((s) => (
                <div key={s.name} className="flex flex-col items-center gap-2 group w-1/5">
                  <div className={`w-full ${s.bg} rounded-t-md relative h-32 group-hover:opacity-90 transition-colors`}>
                    <div className={`absolute bottom-0 w-full ${s.fill} rounded-t-md transition-all duration-500`} style={{ height: `${s.heightPct}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-text-secondary-light dark:text-gray-400">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-text-primary-light dark:text-white flex items-center gap-2">
          <Icon icon="material-symbols:history-rounded" className="text-primary w-5 h-5" />
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm">
            <h3 className="font-semibold text-text-primary-light dark:text-white mb-4">Notifications</h3>
            <div className="space-y-4">
              {NOTIFICATIONS.map((n) => (
                <div key={n.id} className="flex gap-3 items-start">
                  <div className={`mt-0.5 h-2 w-2 rounded-full ${n.dot} flex-shrink-0`} />
                  <div>
                    <p className="text-sm text-text-primary-light dark:text-white font-medium leading-none">{n.title}</p>
                    <p className="text-xs text-text-secondary-light dark:text-gray-400 mt-1">{n.desc}</p>
                    <p className="text-[10px] text-text-secondary-light dark:text-gray-500 mt-1">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm flex flex-col min-h-[16rem] lg:min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary-light dark:text-white">Tasks</h3>
              <Link href="/dashboard/tasks" className="text-xs text-primary font-medium hover:underline">+ Add</Link>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {tasks.length === 0 ? (
                <p className="text-sm text-text-secondary-light dark:text-gray-400">No tasks yet.</p>
              ) : (
                tasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors group">
                    <input type="checkbox" defaultChecked={t.completed} className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary focus:ring-offset-0" />
                    <span className={`text-sm group-hover:text-primary transition-colors ${t.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-text-primary-light dark:text-white'}`}>
                      {t.title}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border-light dark:border-slate-700 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-text-primary-light dark:text-white">Email Activity</h3>
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                <Icon icon="material-symbols:arrow-upward-rounded" className="text-[12px] w-3 h-3" /> 14%
              </div>
            </div>
            <div className="flex-1 flex items-end justify-between gap-1">
              {[40, 65, 85, 55, 95, 25, 15].map((h, i) => (
                <div
                  key={i}
                  className="w-full bg-primary/10 rounded-sm hover:bg-primary/20 transition-colors relative group flex-1"
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-xs text-text-secondary-light dark:text-gray-400">
              <span>Sent: 245</span>
              <span>Open: 68%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
