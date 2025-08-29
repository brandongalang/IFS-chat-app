# Tasks

## User Memory Follow-ups (MVP)

- [ ] Schedule daily memory update job
  - [ ] Add/verify scheduler that calls `POST /api/cron/memory-update` with header `x-cron-key: ${{CRON_SECRET}}`.
  - [ ] Store `APP_BASE_URL` and `CRON_SECRET` in CI/CD secrets.
  - [ ] Confirm the job runs and receives 200 responses.
- [ ] Update documentation to reference the memory system
  - [ ] Add docs describing the differential snapshot design, the cron endpoint, required env vars, and how to run locally.
  - [ ] Link the new doc from README.
