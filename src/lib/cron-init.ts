import cron from 'node-cron';
import { fetchAllFeeds } from './cron-worker';
import db from './db';

let started = false;

function intervalToCron(minutes: number): string {
  return `*/${minutes} * * * *`;
}

export function startCronWorker() {
  if (started) return;
  started = true;

  const intervalMinutes = parseInt(process.env.CRON_INTERVAL || '30', 10);
  const schedule = intervalToCron(intervalMinutes);

  console.log(`[cron] Starting RSS fetch scheduler (every ${intervalMinutes} minutes)`);

  cron.schedule(schedule, async () => {
    console.log('[cron] Running scheduled RSS fetch');
    const results = await fetchAllFeeds();
    for (const result of results) {
      if (result.error) {
        console.error(`[cron] Feed ${result.feedId} failed: ${result.error}`);
      } else {
        console.log(`[cron] Feed ${result.feedId}: fetched ${result.count} articles`);
      }
    }
  });

  // Initial fetch on startup
  fetchAllFeeds().then((results) => {
    console.log('[cron] Initial fetch completed');
  });
}
