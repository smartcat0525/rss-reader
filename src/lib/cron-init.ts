import cron from 'node-cron';
import { fetchAllFeeds, fillMissingArticleContent } from './cron-worker';

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

  // Fill missing article content every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    console.log('[cron] Running content extraction for articles with missing content');
    const result = await fillMissingArticleContent();
    console.log(`[cron] Content extraction: filled=${result.filled}, skipped=${result.skipped}, errors=${result.errors}`);
  });
}
