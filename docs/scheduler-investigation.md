# Scheduled collection investigation

Superseded: automatic collection moved to Supabase Cron later on 15 November 2026. A real scheduled Supabase invocation succeeded at 10:46 UTC. GitHub Actions now remains a manual backup only; the observations below document its earlier scheduler investigation.

Checked on 15 November 2026, through 10:37 UTC (11:37 Europe/Berlin).

## Confirmed observations

- The repository is enabled, is not archived or a fork, and its default branch is `main`.
- Repository Actions permissions are enabled and allow all actions.
- Workflow `418997827` exists on `main` and reports `active`.
- The committed hourly schedule is `17 * * * *`, with no job condition that skips scheduled events.
- The workflow and diagnostic commits map to the active `Bartimaeus25` GitHub account.
- There were no queued or running jobs blocking the concurrency group.
- GitHub's response clock agrees with the local clock after converting UTC to Berlin time.
- [Manual run 43704111526](https://github.com/Bartimaeus25/CR-tracker/actions/runs/43704111526), created at 10:26:48 UTC, completed successfully. This verifies execution and collection, not scheduling.
- The workflow runs API returned zero runs with `event=schedule` throughout this investigation.

## Controlled recovery test

Added a temporary `*/5 * * * *` schedule at 10:28 UTC. No automatic run appeared after the 10:30 target. Disabled and re-enabled the workflow through the GitHub API at 10:31:52 UTC; both requests returned HTTP 204 and the workflow returned to `active`. No automatic run appeared after the next 10:35 target, checked through 10:37 UTC. Removed the temporary schedule and restored the original hourly setting.

The absence of a run means collection code was not invoked by these schedule events. These observations narrow the failure to event delivery or scheduling before job execution; GitHub does not expose a reason for these missing events through the workflow runs API. A delay, dropped event, or internal scheduler registration issue remains a possibility, not a confirmed root cause. No fix to automatic triggering has been verified.

## Follow-up verification

The next hourly target after this investigation is 11:17 UTC / 12:17 Berlin. Look for an actual run with `event=schedule`, then verify its collection step succeeds and both database collection timestamps advance. A successful manual run is insufficient evidence. If scheduled events remain absent, supply this report and the workflow ID to GitHub Support, or choose another scheduler for unattended collection. No support message was sent during this investigation.

GitHub documents delayed/dropped scheduled events and actor-related trigger issues in [Troubleshooting workflows](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows) and [Schedule events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
