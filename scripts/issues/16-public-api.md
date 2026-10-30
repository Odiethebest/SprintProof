## User story
As someone who builds my own tools, I want a documented API for our sprint data, so I can use it outside the app.

## Acceptance criteria
- [ ] Users can create and revoke personal API tokens in settings; the token is shown once; only a SHA-256 hash is stored
- [ ] Endpoints with `Authorization: Bearer <token>`:
  - `GET /api/v1/teams/{teamId}/sprints`
  - `GET /api/v1/teams/{teamId}/sprints/{sprintId}/summary`
  - `GET /api/v1/teams/{teamId}/sprints/{sprintId}/standups`
- [ ] 401 for missing or invalid token, 403 for teams the user isn't in
- [ ] Error responses use the shape in `AGENTS.md` §1; list endpoints use cursor pagination
- [ ] `docs/api/openapi.yaml` documents every endpoint, parameter, response and error
- [ ] Swagger UI served at `/api-docs`
- [ ] Integration tests for every endpoint, including auth failures

**Estimate:** 5 points
**PRD:** US-11
**Depends on:** #10
