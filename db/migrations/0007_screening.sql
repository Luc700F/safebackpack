-- What the automated screening thought of a report.
--
-- The decision is never "reject": it is "publish" or "hold for a person to
-- look at". An automated judgement on a stranger's account of being robbed
-- should not be final, so a held report is invisible rather than deleted, and
-- the reasons are kept so whoever reviews it knows what to look at.

alter table reports
  add column screening_decision text
    check (screening_decision in ('publish', 'hold')),
  add column screening_reasons text[] not null default '{}';

-- The review queue reads this.
create index reports_held_idx on reports (created_at)
  where screening_decision = 'hold';
