-- Anonymisation clears the reporter's name, which collided with a rule written
-- before anonymisation existed: a report not marked anonymous had to carry a
-- name. That is still right while a report is live, and wrong once it has been
-- stripped.
--
-- The database caught this, not the application: the in-memory store has no
-- constraints, so only the contract test running against real Postgres failed.

alter table reports drop constraint anonymous_reports_carry_no_name;

alter table reports add constraint anonymous_reports_carry_no_name check (
  -- A stripped row has no reporter at all, by design.
  anonymised_at is not null
  or (publish_anonymously and reporter_first_name is null)
  or (not publish_anonymously and reporter_first_name is not null)
);
