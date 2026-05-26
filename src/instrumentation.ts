import { startCronWorker } from './lib/cron-init';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    startCronWorker();
  }
}
