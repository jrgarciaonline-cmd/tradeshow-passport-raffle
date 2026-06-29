-- Plan 3 Phase D: Scheduled retention jobs via pg_cron.
-- Prerequisite: enable pg_cron in Supabase Dashboard → Database → Extensions.
--
-- Manual run (SQL Editor):
--   select public.archive_stale_events(90);
--   select public.purge_attendee_pii(30);

create extension if not exists pg_cron with schema pg_catalog;

-- Weekly: archive events older than 90 days
select cron.unschedule(jobid)
from cron.job
where jobname = 'passport-archive-stale-events';

select cron.schedule(
  'passport-archive-stale-events',
  '0 3 * * 0',
  $$select public.archive_stale_events(90);$$
);

-- Weekly: purge attendee PII 30 days after event archive
select cron.unschedule(jobid)
from cron.job
where jobname = 'passport-purge-attendee-pii';

select cron.schedule(
  'passport-purge-attendee-pii',
  '0 4 * * 0',
  $$select public.purge_attendee_pii(30);$$
);
