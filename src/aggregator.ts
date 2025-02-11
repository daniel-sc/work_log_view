// src/aggregator.ts

export interface CsvEntry {
  timestamp: Date;
  appName: string;
  title: string;
  value1: number;
  value2: number;
}

export interface AggregatedActivity {
  title: string;
  durationSec: number;
}

export interface AggregatedBlock {
  from: Date;
  to: Date;
  totalDurationSec: number;
  activities: AggregatedActivity[];
}

/**
 * Parses CSV text into an array of CsvEntry.
 * Skips invalid lines and sorts the result by timestamp.
 */
export function parseCsv(csvText: string): CsvEntry[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  const entries: CsvEntry[] = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 3) continue;
    try {
      const timestamp = new Date(parts[0].trim());
      if (isNaN(timestamp.getTime())) continue;
      const appName = parts[1].trim();
      const title = parts[2].trim();
      const value1 = parts.length > 3 ? Number(parts[3].trim()) : NaN;
      const value2 = parts.length > 4 ? Number(parts[4].trim()) : NaN;
      entries.push({ timestamp, appName, title, value1, value2 });
    } catch (err) {
      continue;
    }
  }
  entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return entries;
}

/**
 * Aggregates CSV entries into blocks.
 * A block ends when the gap between consecutive entries exceeds ignoreIdleTimeUpToSec.
 * Within a block, each activity (by title) has its duration (sum of gaps) computed.
 */
export function aggregateToBlocks(entries: CsvEntry[], ignoreIdleTimeUpToSec: number): AggregatedBlock[] {
  if (entries.length === 0) return [];

  const blocks: AggregatedBlock[] = [];
  let blockStart = entries[0].timestamp;
  let blockEnd = entries[0].timestamp;
  let activityMap: Record<string, number> = {};

  for (let i = 0; i < entries.length - 1; i++) {
    const current = entries[i];
    const next = entries[i + 1];
    const gapSec = (next.timestamp.getTime() - current.timestamp.getTime()) / 1000;
    if (gapSec <= ignoreIdleTimeUpToSec) {
      // Accumulate duration for the current activity.
      activityMap[current.title] = (activityMap[current.title] || 0) + gapSec;
      blockEnd = next.timestamp;
    } else {
      // End the current block.
      const totalDuration = Object.values(activityMap).reduce((sum, d) => sum + d, 0);
      blocks.push({
        from: blockStart,
        to: blockEnd,
        totalDurationSec: totalDuration,
        activities: Object.entries(activityMap).map(([title, durationSec]) => ({ title, durationSec }))
      });
      // Start a new block.
      blockStart = next.timestamp;
      blockEnd = next.timestamp;
      activityMap = {};
    }
  }
  // Add the final block.
  const totalDuration = Object.values(activityMap).reduce((sum, d) => sum + d, 0);
  blocks.push({
    from: blockStart,
    to: blockEnd,
    totalDurationSec: totalDuration,
    activities: Object.entries(activityMap).map(([title, durationSec]) => ({ title, durationSec }))
  });

  return blocks;
}

/**
 * Data structure for grouping blocks.
 */
export interface DayData {
  date: Date;
  blocks: AggregatedBlock[];
  totalDurationSec: number;
}

export interface WeekData {
  weekStart: Date; // Monday of the week
  days: DayData[];
  totalDurationSec: number;
}

/**
 * Utility: returns the Monday for the week that contains the given date.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Adjust if Sunday (0)
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

/**
 * Groups an array of AggregatedBlock into weeks (Monday to Sunday).
 */
export function groupBlocksByWeek(blocks: AggregatedBlock[]): WeekData[] {
  // First, group blocks by day.
  const dayMap = new Map<string, DayData>();
  for (const block of blocks) {
    // Use the date part of block.from.
    const d = new Date(block.from);
    d.setHours(0,0,0,0);
    const dayKey = d.toISOString();
    const dayData = dayMap.get(dayKey) || { date: new Date(d), blocks: [], totalDurationSec: 0 };
    dayData.blocks.push(block);
    dayData.totalDurationSec += block.totalDurationSec;
    dayMap.set(dayKey, dayData);
  }
  const days = Array.from(dayMap.values());

  // Then, group days by week.
  const weekMap = new Map<string, WeekData>();
  for (const day of days) {
    const monday = getMonday(day.date);
    const weekKey = monday.toISOString();
    const weekData = weekMap.get(weekKey) || { weekStart: monday, days: [], totalDurationSec: 0 };
    weekData.days.push(day);
    weekData.totalDurationSec += day.totalDurationSec;
    weekMap.set(weekKey, weekData);
  }
  // Return weeks sorted by weekStart.
  return Array.from(weekMap.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
}
