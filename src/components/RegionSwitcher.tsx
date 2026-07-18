"use client";

import type { ChangeEvent } from 'react';
import { REGIONS, REGION_COOKIE } from '@/config/regions';

// Lets a visitor manually pick their region instead of relying on which
// domain they happened to land on (see proxy.ts for the full resolution
// order). Saves the choice in a cookie for a year and reloads so the
// server re-reads it on the next request.
export default function RegionSwitcher({ currentSlug }: { currentSlug: string }) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const slug = event.target.value;
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${REGION_COOKIE}=${slug}; path=/; max-age=${oneYear}`;
    window.location.reload();
  }

  return (
    <select
      value={currentSlug}
      onChange={handleChange}
      aria-label="Select region"
      className="text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-3 pr-7 py-1.5 text-gray-700 dark:text-gray-200 cursor-pointer"
    >
      {REGIONS.map((r) => (
        <option key={r.slug} value={r.slug}>
          {r.displayName}
        </option>
      ))}
    </select>
  );
}
