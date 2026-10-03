import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

/**
 * Format epoch seconds (backend) to relative time or date string.
 * Backend timestamps are epoch seconds — multiply by 1000 for JS Date.
 */
export function formatTime(epochSeconds: number): string {
  const date = dayjs(epochSeconds * 1000);
  const now = dayjs();
  if (now.diff(date, 'hour') < 24) {
    return date.fromNow(); // "5 minutes ago"
  }
  return date.format('MMM D, h:mm A'); // "Oct 1, 3:42 PM"
}

export function formatExactTime(epochSeconds: number): string {
  return dayjs(epochSeconds * 1000).format('MMM D, YYYY h:mm:ss A');
}

export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} minutes`;
  return m > 0 ? `${h}h ${m}m` : `${h} hours`;
}

export function epochToDate(epochSeconds: number): Date {
  return new Date(epochSeconds * 1000);
}

export function getHourBucket(epochSeconds: number): number {
  return dayjs(epochSeconds * 1000).hour();
}
