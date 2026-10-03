import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatTime(epochSeconds: number) {
  const date = dayjs(epochSeconds * 1000);
  const now = dayjs();
  if (now.diff(date, 'hour') < 24) {
    return date.fromNow();
  }
  return date.format('MMM D, h:mm A');
}

export function formatTimeExact(epochSeconds: number) {
  return dayjs(epochSeconds * 1000).format('MMM D, YYYY h:mm:ss A');
}
