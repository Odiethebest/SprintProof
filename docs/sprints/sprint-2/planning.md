# Sprint 2 planning

**Dates:** Nov 5 – Nov 11, 2026 · **Milestone:** Sprint 2
**Planned by:** Ziqi Yang, Yunhong Huang · **Planning meeting:** 2026-11-__ <!-- fill in -->

## Sprint goal
GitHub activity flows into a live dashboard; retros with voting, private peer feedback, instructor view and export work end to end; the public API is documented; the full CI/CD pipeline runs on every PR.

## Action items carried over from the Sprint 1 retro
- [ ] <!-- copy from sprint-1/retro.md -->

## Capacity
| Member | Available hours | Notes |
| --- | --- | --- |
| Ziqi Yang | | |
| Yunhong Huang | | |

## Committed issues
<!-- Proposal: confirm or change together in the planning meeting. -->

| Issue | Title | Points | Owner | Depends on |
| --- | --- | --- | --- | --- |
| #11 | Receive and verify GitHub webhooks | 5 | Yunhong | #7 |
| #12 | Show live contribution dashboard | 5 | Ziqi | #9, #10, #11 |
| #13 | Run a retro with voting and action items | 5 | Ziqi | #8 |
| #14 | Collect private peer feedback for instructors | 3 | Yunhong | #13 |
| #15 | Add instructor view and Markdown export | 5 | Yunhong | #12, #14 |
| #16 | Publish public API v1 with tokens and OpenAPI docs | 5 | Ziqi | #10 |
| #17 | Add E2E suite, security scanning and environments | 5 | Yunhong | #4, #12 |
| | **Total** | **33** | Ziqi 15 · Yunhong 18 | |

## Risks
- #12 depends on #11; Yunhong starts #11 on day 1.
- Pusher on Vercel: verify the free tier limits early.
