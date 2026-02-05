"use client";

import { useApp } from "@/app/providers";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSidebar } from "./SidebarContext";
// @ts-ignore
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

interface NavItem {
  label: string;
  icon: string;
  href: string;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Home",
    items: [
      { label: "Dashboard", icon: "solar:widget-2-linear", href: "/dashboard" },
      { label: "Maps", icon: "solar:map-point-linear", href: "/dashboard/map" },
    ],
  },
  {
    title: "PROSPECT & ENRICH",
    items: [
      {
        label: "All Prospects",
        icon: "solar:users-group-rounded-linear",
        href: "/dashboard/prospect-enrich",
      },
      {
        label: "For Sale",
        icon: "solar:home-2-linear",
        href: "/dashboard/prospect-enrich?filter=fsbo",
      },
      {
        label: "For Rent",
        icon: "solar:home-2-linear",
        href: "/dashboard/prospect-enrich?filter=frbo",
      },
      {
        label: "Foreclosures",
        icon: "solar:home-2-linear",
        href: "/dashboard/prospect-enrich?filter=foreclosure",
      },
      {
        label: "Probate",
        icon: "solar:bill-list-linear",
        href: "/dashboard/prospect-enrich?filter=probate",
      },
      {
        label: "Expired Listings",
        icon: "solar:clock-circle-linear",
        href: "/dashboard/prospect-enrich?filter=expired",
      },
      {
        label: "Imports",
        icon: "solar:server-minimalistic-linear",
        href: "/dashboard/prospect-enrich?filter=imports",
      },
    ],
  },
  {
    title: "CUSTOMER RELATIONSHIP MANAGEMENT",
    items: [
      {
        label: "Lists",
        icon: "solar:user-circle-linear",
        href: "/dashboard/lists",
      },
      {
        label: "Deals",
        icon: "solar:case-linear",
        href: "/dashboard/crm/deals",
      },
      {
        label: "Calendar",
        icon: "solar:calendar-linear",
        href: "/dashboard/crm/calendar",
      },
    ],
  },
  {
    title: "EMAIL MARKETING",
    items: [
      {
        label: "Unibox",
        icon: "solar:letter-linear",
        href: "/dashboard/unibox",
      },
      {
        label: "Email Campaigns",
        icon: "solar:letter-linear",
        href: "/dashboard/email/campaigns",
      },
      {
        label: "Email Analytics",
        icon: "solar:chart-2-linear",
        href: "/dashboard/marketing/analytics",
      },
    ],
  },
  {
    title: "TOOLS & AUTOMATION",
    items: [
      {
        label: "Analytics",
        icon: "solar:chart-2-linear",
        href: "/dashboard/crm/analytics",
      },
    ],
  },
  {
    title: "ADMIN",
    items: [
      {
        label: "Admin Settings Panel",
        icon: "solar:settings-linear",
        href: "/admin",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, signOut } = useApp();
  const { isOpen, toggle } = useSidebar();
  const initials =
    profile?.name
      ?.split(" ")
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "U";

  // Collapsible sections: track which are expanded (default all true)
  const [expandedSections, setExpandedSections] = useState<
    Record<number, boolean>
  >({});
  const toggleSection = (sectionIdx: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionIdx]: !prev[sectionIdx],
    }));
  };
  const isSectionExpanded = (sectionIdx: number) =>
    expandedSections[sectionIdx] !== false;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/";
    }

    const hrefPath = href.split("?")[0];
    const hrefParams = new URLSearchParams(
      href.includes("?") ? href.split("?")[1] : ""
    );

    // Check if pathname matches
    if (!pathname.startsWith(hrefPath)) {
      return false;
    }

    // For prospect-enrich page, check filter parameter
    if (hrefPath === "/dashboard/prospect-enrich") {
      const currentFilter = searchParams.get("filter");
      const hrefFilter = hrefParams.get("filter");

      // If href has no filter param, it's "All Prospects" - only active when no filter is set
      if (!hrefFilter) {
        return !currentFilter;
      }

      // Otherwise, check if filters match exactly
      return currentFilter === hrefFilter;
    }

    // For other pages, just check pathname
    return true;
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[#e5e5e5] bg-white dark:bg-dark shadow-sm transition-[width] duration-200 ease-in group ${
        isOpen
          ? "w-[270px]"
          : "w-[75px] xl:hover:w-[270px] overflow-hidden xl:hover:overflow-visible"
      }`}
    >
      {/* Brand / collapse */}
      <div
        className={`flex min-h-[70px] items-center brand-logo overflow-hidden ${isOpen ? "px-6" : "px-5 xl:group-hover:px-6"}`}
      >
        {isOpen ? (
          <div className="flex w-full items-center gap-3">
            <Link
              href="/dashboard"
              className="group flex items-center gap-3 cursor-pointer"
            >
              <div className="relative w-9 h-9 flex items-center justify-center bg-primary rounded-xl text-white shadow-md shadow-blue-200/70 dark:shadow-none">
                <Icon icon="solar:home-2-linear" className="w-5 h-5" />
              </div>
              <span className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight">
                Next<span className="text-primary">Deal</span>
              </span>
            </Link>
          </div>
        ) : (
          <div className="flex w-full items-center justify-center">
            <Link
              href="/dashboard"
              className="group flex items-center justify-center rounded-md px-2 py-1.5 cursor-pointer transition-colors"
            >
              <div className="w-9 h-9 flex items-center justify-center bg-primary rounded-xl text-white shadow-md shadow-blue-200/70 dark:shadow-none">
                <Icon icon="solar:home-2-linear" className="w-5 h-5" />
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Navigation */}
      <SimpleBar className="h-[calc(100vh_-_180px)] sidebar-scroll px-0">
        <nav
          className={`sidebar-nav flex-1 pb-4 space-y-6 ${
            isOpen ? "px-4" : "px-2 xl:group-hover:px-4"
          }`}
        >
          {navSections.map((section, sectionIdx) => {
            const expanded = isSectionExpanded(sectionIdx);
            const hasTitle = !!section.title;
            return (
              <div key={sectionIdx} className="mb-1.5">
                {hasTitle && (
                  <button
                    type="button"
                    onClick={() => hasTitle && toggleSection(sectionIdx)}
                    className={`caption w-full text-left mb-1 focus:outline-none focus:ring-0 group ${
                      sectionIdx === 0 ? "mt-0" : "mt-6"
                    }`}
                  >
                    <h5 className="leading-[26px] flex items-center justify-between gap-2">
                      {isOpen ? (
                        <>
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                            {section.title}
                          </span>
                          <Icon
                            icon={
                              expanded
                                ? "solar:alt-arrow-up-linear"
                                : "solar:alt-arrow-down-linear"
                            }
                            className="flex-shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors"
                            height={14}
                            width={14}
                          />
                        </>
                      ) : (
                        <>
                          <span className="hidden xl:group-hover:inline leading-21">
                            {section.title}
                          </span>
                          <div className="flex justify-center xl:group-hover:hidden">
                            <Icon
                              icon="tabler:dots"
                              className="text-ld leading-6 dark:text-opacity-60"
                              height={18}
                            />
                          </div>
                        </>
                      )}
                    </h5>
                  </button>
                )}
                {(!hasTitle || expanded) && (
                  <div
                    className={
                      isOpen
                        ? "space-y-1"
                        : "flex flex-col items-center gap-2 xl:group-hover:items-start xl:group-hover:gap-0.5 xl:group-hover:space-y-0.5"
                    }
                  >
                    {section.items.map((item) => {
                      const active = isActive(item.href);

                      const handleClick = () => {
                        if (item.href === "/dashboard/prospect-enrich") {
                          router.push("/dashboard/prospect-enrich");
                        } else {
                          router.push(item.href);
                        }
                      };

                      if (isOpen) {
                        return (
                          <button
                            key={item.href}
                            onClick={handleClick}
                            className={`group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start truncate cursor-pointer leading-normal transition-all duration-200 ${
                              active
                                ? "bg-primary text-white shadow-[0_4px_6px_-1px_rgba(59,130,246,0.2),0_2px_4px_-1px_rgba(59,130,246,0.1)] font-semibold"
                                : "text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium"
                            }`}
                          >
                            <Icon
                              icon={item.icon}
                              className="flex-shrink-0"
                              height={21}
                              width={21}
                            />
                            <span className="truncate text-sm flex-1">
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      }

                      return (
                        <div key={item.href} className="group/item relative">
                          <button
                            onClick={handleClick}
                            className={`flex h-9 w-9 items-center justify-center rounded-md border transition-all duration-200 xl:group-hover:w-full xl:group-hover:justify-start xl:group-hover:gap-3 xl:group-hover:p-3 xl:group-hover:h-auto ${
                              active
                                ? "border-primary bg-primary text-white"
                                : "border-transparent text-link hover:bg-lightprimary hover:text-primary dark:text-darklink dark:hover:bg-lightprimary"
                            }`}
                            aria-label={item.label}
                          >
                            <Icon
                              icon={item.icon}
                              className="flex-shrink-0"
                              height={21}
                              width={21}
                            />
                            <span className="hidden xl:group-hover:block truncate text-sm ml-3 flex-1">
                              {item.label}
                            </span>
                          </button>
                          <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded-md bg-dark px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover/item:opacity-100 dark:bg-gray-800 xl:hidden">
                            {item.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </SimpleBar>

      {/* Upgrade CTA */}
      {profile && !profile.is_subscribed && isOpen && (
        <div className="border-t border-[#e5e5e5] px-4 pb-3 pt-2 dark:border-[#333f55]">
          <div className="rounded-md bg-lightsecondary p-4 text-xs text-white overflow-hidden">
            <p className="mb-2 text-base font-semibold text-link dark:text-darklink">
              Upgrade to unlock full NextDeal
            </p>
            <button
              onClick={() => router.push("/pricing")}
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary/90"
            >
              Upgrade plan
            </button>
          </div>
        </div>
      )}

      {/* User Section */}
      <div className={`my-4 ${isOpen ? "mx-4" : "mx-1.5 xl:group-hover:mx-4"}`}>
        <div
          className={`rounded-xl border border-[#e5e5e5] dark:border-[#333f55] bg-[#f8fafc]/60 dark:bg-[#0f172a]/60 overflow-hidden transition-all duration-200 ease-in ${
            isOpen ? "px-3 py-3" : "px-2 py-2 xl:group-hover:px-3 xl:group-hover:py-3"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800">
              {initials}
            </div>
            <div
              className={`min-w-0 flex-1 transition-all duration-200 ease-in ${
                isOpen ? "block" : "hidden xl:group-hover:block"
              }`}
            >
              <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {profile?.name || "User"}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {profile?.email || "Admin"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-auto text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon icon="solar:logout-2-linear" className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
