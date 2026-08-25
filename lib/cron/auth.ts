/**
 * Vercel Cron invokes with `Authorization: Bearer ${CRON_SECRET}`.
 * Every cron route verifies before doing anything.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // open in dev, never in prod
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
