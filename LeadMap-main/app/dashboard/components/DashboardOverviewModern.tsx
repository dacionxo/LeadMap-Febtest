"use client";

import { useApp } from "@/app/providers";
import {
  ArrowRight,
  ArrowUp,
  Bookmark,
  FileText,
  History,
  Home,
  MoreHorizontal,
  PieChart,
  Search,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

const sparklines = {
  up: "M0,35 Q10,32 20,25 T40,28 T60,20 T80,25 T100,10 T120,15",
  upArea: "M0,40 L0,35 Q10,32 20,25 T40,28 T60,20 T80,25 T100,10 T120,15 L120,40 Z",
  upMid: "M0,30 Q15,30 30,25 T60,20 T90,25 T120,15",
  upMidArea:
    "M0,40 L0,30 Q15,30 30,25 T60,20 T90,25 T120,15 L120,40 Z",
  downThenUp: "M0,25 Q20,35 40,25 T80,20 T120,5",
  downThenUpArea: "M0,40 L0,25 Q20,35 40,25 T80,20 T120,5 L120,40 Z",
  down: "M0,10 Q30,15 60,25 T120,35",
  downArea: "M0,40 L0,10 Q30,15 60,25 T120,35 L120,40 Z",
};

interface WidgetData {
  "total-prospects"?: { value: number; change?: string; trend?: "up" | "down" | "neutral" };
  "active-listings"?: { value: number; change?: string; trend?: "up" | "down" | "neutral" };
  "avg-property-value"?: { value: string; change?: string; trend?: "up" | "down" | "neutral" };
  "expired-listings"?: { value: number; change?: string; trend?: "up" | "down" | "neutral" };
  "pipeline-value"?: { value: string; change?: string; trend?: "up" | "down" | "neutral" };
  "conversion-rate"?: { value: string; change?: string; trend?: "up" | "down" | "neutral" };
  "pipeline-funnel"?: {
    stages: { name: string; value: number; percentage: number }[];
  };
  "deal-stage-distribution"?: {
    stages: { name: string; value: number; percentage: number }[];
  };
  "recent-activity"?: Array<{
    id: string;
    title: string;
    description?: string;
    time?: string;
    type?: string;
  }>;
  "upcoming-tasks"?: Array<{
    id: string;
    title: string;
    due?: string;
    priority?: string;
    completed?: boolean;
  }>;
}

interface DashboardOverviewModernProps {
  widgetData: Record<string, unknown>;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  lastUpdated?: Date | null;
}

export default function DashboardOverviewModern({
  widgetData,
  loading = false,
  error = null,
  onRefresh,
  lastUpdated,
}: DashboardOverviewModernProps) {
  const { profile } = useApp();
  const data = widgetData as WidgetData;

  const totalProspects = data["total-prospects"]?.value ?? 1482;
  const activeListings = data["active-listings"]?.value ?? 56;
  const avgPropertyValue = data["avg-property-value"]?.value ?? "$845k";
  const expiredListings = data["expired-listings"]?.value ?? 3;

  const totalProspectsTrend = data["total-prospects"]?.trend ?? "up";
  const totalProspectsChange = data["total-prospects"]?.change ?? "+12%";
  const activeListingsChange = data["active-listings"]?.change ?? "+4%";
  const avgValueChange = data["avg-property-value"]?.change ?? "+2.1%";
  const expiredChange = data["expired-listings"]?.change ?? "-18%";
  const expiredTrend = data["expired-listings"]?.trend ?? "down";

  const pipelineValue = data["pipeline-value"]?.value ?? "$4.2M";
  const pipelineChange = data["pipeline-value"]?.change ?? "+$340k vs last month";
  const conversionRate = data["conversion-rate"]?.value ?? "24%";

  const funnelStages = data["pipeline-funnel"]?.stages ?? [
    { name: "Lead", value: 142, percentage: 100 },
    { name: "Contact", value: 84, percentage: 59 },
    { name: "Proposal", value: 45, percentage: 32 },
    { name: "Negotiation", value: 12, percentage: 9 },
  ];

  const stageDist = data["deal-stage-distribution"]?.stages ?? [
    { name: "New", value: 1, percentage: 65 },
    { name: "Qual", value: 1, percentage: 80 },
    { name: "Prop", value: 1, percentage: 45 },
    { name: "Won", value: 1, percentage: 30 },
  ];

  const notifications = (data["recent-activity"] ?? []) as Array<{
    id: string;
    title: string;
    description?: string;
    time?: string;
  }>;
  const defaultNotifications = [
    { id: "1", title: "New lead added", description: "Sarah Jenkins was assigned to you.", time: "10 min ago" },
    { id: "2", title: "Meeting confirmed", description: "Product demo with TechCorp.", time: "1 hour ago" },
    { id: "3", title: "Task overdue", description: "Follow up with Mike regarding contract.", time: "2 hours ago" },
  ];
  const displayNotifications =
    notifications.length >= 3 ? notifications.slice(0, 3) : defaultNotifications;

  const tasks = (data["upcoming-tasks"] ?? []) as Array<{
    id: string;
    title: string;
    due?: string;
    completed?: boolean;
  }>;
  const defaultTasks = [
    { id: "t1", title: "Call John Doe", completed: false },
    { id: "t2", title: "Send contract draft", completed: true },
    { id: "t3", title: "Update listing photos", completed: false },
    { id: "t4", title: "Weekly team sync", completed: false },
  ];
  const displayTasks = tasks.length > 0 ? tasks : defaultTasks;

  const userName = profile?.name ?? "Alex Rivera";
  const activeListingsCount = activeListings;
  const prospectInteractions = totalProspects;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner - SaaS teal style (1:1 reference) */}
      <div className="dashboard-welcome-card relative overflow-hidden rounded-[2rem] border p-10 sm:p-14 lg:p-16 transition-all duration-500">
        <div className="organic-wave" aria-hidden="true" />
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-saas-teal/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-100/30 dark:bg-saas-teal/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-start gap-10">
          <div className="space-y-6 max-w-3xl">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#1E293B] dark:text-[#F8FAFC] tracking-tight leading-[1.1]">
              Welcome Back,{" "}
              <span className="text-saas-teal">{userName}</span>
            </h2>
            <p className="text-lg sm:text-xl text-[#64748B] dark:text-[#94A3B8] font-normal leading-relaxed">
              Here&apos;s what&apos;s happening with your projects today. You
              have{" "}
              <span className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] border-b-2 border-saas-teal/20">
                {activeListingsCount} Active Listings
              </span>
              ,{" "}
              <span className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] border-b-2 border-saas-teal/20">
                {prospectInteractions} prospect interactions
              </span>
              , and{" "}
              <span className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] border-b-2 border-saas-teal/20">
                {avgPropertyValue} in Average Deal Value
              </span>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard/prospect-enrich"
              className="group inline-flex items-center justify-center px-10 py-4 bg-saas-teal hover:bg-saas-teal-hover text-white text-base font-semibold rounded-full shadow-lg shadow-saas-teal/25 transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl focus:ring-4 focus:ring-saas-teal/20"
            >
              View Listings
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <div className="hidden sm:flex items-center px-4 py-2 bg-white/60 dark:bg-slate-800/50 backdrop-blur-sm rounded-full border border-[#E2E8F0] dark:border-[#334155] text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
              <span className="w-2 h-2 bg-saas-teal rounded-full mr-2 animate-pulse" />
              Live Update
            </div>
          </div>
        </div>
        <div
          className="absolute top-1/2 -right-4 translate-y-[-50%] opacity-[0.04] pointer-events-none select-none"
          aria-hidden="true"
        >
          <svg
            height="400"
            viewBox="0 0 200 200"
            width="400"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C86.9,14.5,81.2,29,72.4,41.9C63.6,54.8,51.7,66.1,38,72.9C24.3,79.7,8.7,82,-5.8,82.1C-20.3,82.2,-33.7,80.1,-46.8,73.1C-59.9,66.1,-72.7,54.3,-79.7,40.1C-86.7,25.9,-87.9,9.4,-85.4,-6.2C-82.9,-21.8,-76.6,-36.5,-67.1,-48.8C-57.5,-61.2,-44.6,-71.2,-31,-78.6C-17.4,-86,17.4,-83.6,44.7,-76.4Z"
              fill="#06B6D4"
              transform="translate(100 100)"
            />
          </svg>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Prospecting Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Prospecting Overview
          </h2>
          <Link
            href="/dashboard/prospect-enrich"
            className="text-sm text-primary font-medium hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <ProspectCard
            icon={<Bookmark className="w-5 h-5" />}
            iconBg="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
            value={totalProspects.toLocaleString()}
            label="Saved Prospects"
            change={totalProspectsChange}
            trend={totalProspectsTrend}
            sparklineColor="text-blue-500"
            path={sparklines.up}
            areaPath={sparklines.upArea}
          />
          <ProspectCard
            icon={<Home className="w-5 h-5" />}
            iconBg="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
            value={String(activeListings)}
            label="Active Listings"
            change={activeListingsChange}
            trend="up"
            sparklineColor="text-purple-500"
            path={sparklines.upMid}
            areaPath={sparklines.upMidArea}
          />
          <ProspectCard
            icon={<FileText className="w-5 h-5" />}
            iconBg="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
            value={avgPropertyValue}
            label="Avg Property Value"
            change={avgValueChange}
            trend="up"
            sparklineColor="text-green-500"
            path={sparklines.downThenUp}
            areaPath={sparklines.downThenUpArea}
          />
          <ProspectCard
            icon={<Timer className="w-5 h-5" />}
            iconBg="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
            value={String(expiredListings)}
            label="Expired Listings"
            change={expiredChange}
            trend={expiredTrend}
            sparklineColor="text-red-500"
            path={sparklines.down}
            areaPath={sparklines.downArea}
          />
        </div>
      </div>

      {/* Deals Analytics */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <PieChart className="w-5 h-5 text-primary" />
          Deals Analytics
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-3 flex flex-col gap-5">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex-1 flex flex-col justify-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-medium">
                Pipeline Value
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {pipelineValue}
              </div>
              <div className="text-xs text-green-600 mt-2 font-medium flex items-center">
                <ArrowUp className="w-3.5 h-3.5 mr-1" />
                {pipelineChange}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex-1 flex flex-col justify-center">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-medium">
                Conversion Rate
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {conversionRate}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium">
                Top 15% of agents
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 mt-3 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: conversionRate.replace("%", "") + "%" }}
                />
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Pipeline Funnel
              </h3>
              <button
                type="button"
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                aria-label="More options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {funnelStages.map((stage, i) => (
                <div
                  key={stage.name}
                  className="relative"
                  style={{
                    width: `${100 - i * 12}%`,
                    marginLeft: i === 0 ? 0 : "auto",
                    marginRight: i === 0 ? 0 : "auto",
                  }}
                >
                  <div className="flex justify-between text-xs mb-1 font-medium text-gray-500 dark:text-gray-400">
                    <span>
                      {stage.name} ({stage.value})
                    </span>
                  </div>
                  <div className="w-full h-8 bg-indigo-50 dark:bg-gray-700/50 rounded-lg relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-primary/80 rounded-lg transition-all duration-500"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Stage Distribution
              </h3>
              <span className="text-xs text-gray-500 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-md">
                This Week
              </span>
            </div>
            <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2">
              {stageDist.map((s, i) => (
                <div
                  key={s.name}
                  className="flex flex-col items-center gap-2 w-1/5"
                >
                  <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-md relative h-32">
                    <div
                      className="absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all duration-500"
                      style={{ height: Math.min(100, s.percentage || 30) + "%" }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    {s.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Notifications
            </h3>
            <div className="space-y-4">
              {displayNotifications.map((n, idx) => (
                <div key={n.id} className="flex gap-3 items-start">
                  <div
                    className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${
                      idx === 0
                        ? "bg-blue-500"
                        : idx === 1
                          ? "bg-green-500"
                          : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                  <div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium leading-none">
                      {n.title}
                    </p>
                    {n.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {n.description}
                      </p>
                    )}
                    {n.time && (
                      <p className="text-[10px] text-gray-500 mt-1">{n.time}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col min-h-[240px] lg:min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Tasks
              </h3>
              <Link
                href="/dashboard/tasks"
                className="text-xs text-primary font-medium hover:underline"
              >
                + Add
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto dashboard-overview-scrollbar pr-2 space-y-3">
              {displayTasks.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    defaultChecked={!!(t as { completed?: boolean }).completed}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span
                    className={
                      (t as { completed?: boolean }).completed
                        ? "text-sm text-gray-400 dark:text-gray-500 line-through"
                        : "text-sm text-gray-900 dark:text-white"
                    }
                  >
                    {t.title}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Email Activity
              </h3>
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                <ArrowUp className="w-3 h-3" /> 14%
              </div>
            </div>
            <div className="flex-1 flex items-end justify-between gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, i) => {
                  const heights = [40, 65, 85, 55, 95, 25, 15];
                  return (
                    <div
                      key={day}
                      className="w-full rounded-sm hover:opacity-80 transition-opacity relative group bg-primary/10 dark:bg-primary/20"
                      style={{ height: heights[i] + "%" }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {day}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
            <div className="mt-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Sent: 245</span>
              <span>Open: 68%</span>
            </div>
          </div>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function ProspectCard({
  icon,
  iconBg,
  value,
  label,
  change,
  trend,
  sparklineColor,
  path,
  areaPath,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  change: string;
  trend: "up" | "down" | "neutral";
  sparklineColor: string;
  path: string;
  areaPath: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-2.5 rounded-xl ${iconBg}`}
        >
          {icon}
        </div>
        <span
          className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${
            trend === "down"
              ? "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
              : "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
          }`}
        >
          {trend === "down" ? (
            <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
          )}{" "}
          {change}
        </span>
      </div>
      <div className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{label}</p>
      <div className="h-10 w-full overflow-hidden">
        <svg
          className={`w-full h-full sparkline ${sparklineColor}`}
          preserveAspectRatio="none"
          viewBox="0 0 120 40"
        >
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <path
            d={areaPath}
            fill="currentColor"
            fillOpacity="0.1"
            stroke="none"
          />
        </svg>
      </div>
    </div>
  );
}
