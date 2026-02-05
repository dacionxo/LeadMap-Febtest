"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";

interface AppTile {
  href: string;
  label: string;
  icon: string;
  bgClass: string;
  iconClass: string;
}

const APP_TILES: AppTile[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "solar:widget-2-linear",
    bgClass: "bg-purple-100 dark:bg-purple-900/30",
    iconClass: "text-purple-600 dark:text-purple-400",
  },
  {
    href: "/dashboard/crm/calendar",
    label: "Calendar",
    icon: "solar:calendar-linear",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    iconClass: "text-green-600 dark:text-green-400",
  },
  {
    href: "/dashboard/unibox",
    label: "Unibox",
    icon: "solar:letter-linear",
    bgClass: "bg-orange-100 dark:bg-orange-900/30",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  {
    href: "/dashboard/map",
    label: "Map View",
    icon: "solar:map-point-linear",
    bgClass: "bg-red-100 dark:bg-red-900/30",
    iconClass: "text-red-600 dark:text-red-400",
  },
  {
    href: "/dashboard/crm/deals",
    label: "Deals",
    icon: "solar:card-linear",
    bgClass: "bg-purple-100 dark:bg-purple-900/30",
    iconClass: "text-purple-600 dark:text-purple-400",
  },
  {
    href: "/dashboard",
    label: "More",
    icon: "solar:add-circle-linear",
    bgClass: "bg-gray-100 dark:bg-gray-700/50",
    iconClass: "text-gray-600 dark:text-gray-400",
  },
];

export default function AppLinks() {
  return (
    <div className="dropdown-wrapper group">
      <button
        type="button"
        className="text-sm text-gray-900 dark:text-white hover:text-primary px-4 h-10 flex items-center justify-center xl:flex hidden transition-colors"
        aria-label="Open apps menu"
        aria-haspopup="true"
      >
        <span>Apps</span>
        <Icon
          icon="material-symbols:expand-more-rounded"
          height={20}
          className="shrink-0 ml-1"
        />
      </button>

      <span className="xl:hidden text-text-secondary-light dark:text-text-secondary-dark flex rounded-full p-2 justify-center items-center cursor-pointer hover:text-primary hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
        <Icon icon="material-symbols:apps-rounded" className="shrink-0 w-5 h-5" />
      </span>

      <div className="xl:invisible xl:group-hover:visible visible absolute top-[28px] right-0 xl:right-auto xl:left-0 z-[101] w-screen xl:w-auto xl:min-w-[320px] max-w-[400px] dropdown shadow-lg bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden dark:shadow-dark-md">
        <div className="xl:relative xl:translate-none xl:z-0 hidden xl:block">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Your Apps
            </h2>
            <Link
              href="/dashboard"
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              View All
            </Link>
          </div>

          {/* App grid - 2 rows x 3 cols */}
          <div className="grid grid-cols-3 gap-3 p-4">
            {APP_TILES.map((app, index) => (
              <Link
                key={index}
                href={app.href}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gray-50/50 dark:bg-slate-800/30 hover:bg-gray-100 dark:hover:bg-slate-800/60 border border-transparent hover:border-gray-200 dark:hover:border-slate-600 transition-all duration-200 group/tile"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${app.bgClass} ${app.iconClass} group-hover/tile:scale-105 transition-transform`}
                >
                  <Icon icon={app.icon} className="h-6 w-6" />
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center">
                  {app.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-800/50 px-4 py-3">
            <Link
              href="/dashboard/help"
              className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
            >
              <Icon
                icon="solar:question-circle-linear"
                className="h-5 w-5 shrink-0"
              />
              Frequently asked questions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
