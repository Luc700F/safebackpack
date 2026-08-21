-- The map's "how recent" filter reads the day an incident happened.
--
-- Until now submission was the only date there was, so `published_at` answered
-- both "when did this happen" and "when did we hear about it". A reporter can
-- now date a report back, and the two come apart: a filter that kept reading
-- `published_at` would show last month's robbery under "past 24 hours" purely
-- because the paperwork arrived today.
--
-- Retention is deliberately not moved. A report lives 60 days from the day it
-- was published, whatever day it describes — see src/lib/reports/retention.ts.
-- Backdating says when something happened; it neither buys nor costs time on
-- the map, and `reports_expires_at_idx` still serves that.

create index reports_occurred_at_idx
  on reports (occurred_at desc)
  where status = 'published';
