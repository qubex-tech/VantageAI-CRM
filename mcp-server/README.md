# MCP Verification Server

Generic MCP-compatible HTTP server that exposes **read-only** patient + insurance "verification bundle" data for agents (voice or chat) that support tool calling. No clearinghouse eligibility checks; focus on PHI minimization, masking, and auditing.

## Requirements

- Node.js 18+
- PostgreSQL (same DB as main CRM; run migrations from repo root)
- Env: `DATABASE_URL`, `MCP_API_KEYS`, optional `PORT`, `ALLOW_AGENT_UNMASKED`

## Setup

From repo root, run migrations (adds `mcp_access_audit_logs` if not already applied):

```bash
npx prisma migrate deploy
```

From `mcp-server` directory:

```bash
cd mcp-server
npm install   # runs prisma generate from mcp-server/prisma/schema.prisma
npm run build
```

The MCP server uses a minimal Prisma schema (`mcp-server/prisma/schema.prisma`) with only Patient, InsurancePolicy, McpAccessAuditLog (and Practice). Keep it in sync with the root schema for those models when they change.

## Configuration (env)

| Variable | Required | Default | Description |
|----------|----------|---------|--------------|
| `PORT` | No | 4010 | Server port |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (same as main app) |
| `MCP_API_KEYS` | Yes | - | Comma-separated API keys for `X-API-Key` |
| `ALLOW_AGENT_UNMASKED` | No | false | If "true", allows agents to receive unmasked member_id/group_number when `X-Allow-Unmasked: true` |

## Auth and headers

Every request to `/mcp/tools` and `/mcp/call` must include:

- **X-API-Key**: One of the keys in `MCP_API_KEYS`
- **X-Actor-Id**: String identifier for the caller
- **X-Actor-Type**: `agent` | `user` | `system`
- **X-Purpose**: Must be exactly `insurance_verification`
- **X-Request-Id**: UUID (for audit correlation)
- **X-Allow-Unmasked** (optional): `true` to return unmasked `member_id` / `group_number` (only if `actor_type` ≠ `agent` or `ALLOW_AGENT_UNMASKED=true`)

## Endpoints

- **GET /mcp/health** — No auth. Returns `{ "ok": true }`.
- **GET /mcp/tools** — Returns tool definitions (name, description, input_schema, output_schema).
- **POST /mcp/call** — Body: `{ "tool": "<name>", "input": { ... } }`. Returns `{ "output": {...}, "meta": { "request_id", "latency_ms" } }` or `{ "output": {}, "error": { "code", "message" } }`.

## Tools

1. **get_patient_identity** — `patient_id`, `include_address?`. Returns patient identity (and optionally address).
2. **list_insurance_policies** — `patient_id`. Returns list with payer, is_primary, member_id_masked, completeness.
3. **get_insurance_policy_details** — `policy_id`, `include_rx?`, `include_card_refs?`. Full policy details; member/group masked by default.
4. **get_verification_bundle** — `patient_id`, `policy_id?`, `include_address?`, `include_rx?`, `strict_minimum_necessary?`. Single bundle for verification; if `policy_id` omitted, uses primary policy.
5. **search_patient_by_demographics** — `first_name`, `last_name`, `dob`, `zip?`. Returns matches with masked display.

## Masking

- `member_id` and `group_number` are returned as `****<last4>` unless:
  - Header `X-Allow-Unmasked: true`, and
  - `X-Actor-Type` is not `agent`, or `ALLOW_AGENT_UNMASKED` is true.
- No SSN or full Tax ID is ever returned.

## Audit

Every tool call is written to `mcp_access_audit_logs`: `request_id`, `actor_id`, `actor_type`, `purpose`, `patient_id`, `policy_id`, `tool_name`, `fields_returned_json` (array of field paths, not values), `created_at`.

## curl examples

Health (no auth):

```bash
curl -s http://localhost:4010/mcp/health
# {"ok":true}
```

List tools:

```bash
curl -s -X GET http://localhost:4010/mcp/tools \
  -H "X-API-Key: YOUR_KEY" \
  -H "X-Actor-Id: agent-1" \
  -H "X-Actor-Type: agent" \
  -H "X-Purpose: insurance_verification" \
  -H "X-Request-Id: $(uuidgen)"
```

Call `get_verification_bundle`:

```bash
curl -s -X POST http://localhost:4010/mcp/call \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -H "X-Actor-Id: agent-1" \
  -H "X-Actor-Type: agent" \
  -H "X-Purpose: insurance_verification" \
  -H "X-Request-Id: $(uuidgen)" \
  -d '{"tool":"get_verification_bundle","input":{"patient_id":"<UUID>","include_address":true}}'
```

## Integrating with a tool-calling agent

1. **Discovery**: GET `/mcp/tools` to get tool names and input schemas.
2. **Invocation**: When the agent decides to call a tool, POST to `/mcp/call` with `tool` and `input`. Use the same headers (actor, purpose, request_id) for the session.
3. **Errors**: On validation or execution error, the response body includes `error: { code, message }`; do not log or expose the message to end users if it might contain PHI (current implementation avoids PHI in messages).
4. **Unmasking**: For voice/clearinghouse flows where the agent must read member ID, use `X-Actor-Type: user` or `system` and `X-Allow-Unmasked: true` if your policy allows it; otherwise keep agents masked.

## Production on Vercel

The **same Next.js app** exposes MCP endpoints when deployed to Vercel. No separate MCP server deploy is needed.

- **MCP URL:** Your Vercel app URL, e.g. `https://your-app.vercel.app`
- **Endpoints:** `GET /mcp/health`, `GET /mcp/tools`, `POST /mcp/call` (rewrites forward to `/api/mcp/*`)
- **Env (Vercel):** Set `MCP_API_KEYS` (comma-separated) and `DATABASE_URL` in the project’s Environment Variables.

Use `https://your-app.vercel.app` as the MCP URL in Retell AI (or any tool-calling client).

---

## Run standalone (optional)

From the repo root you can run the standalone server with tsx:

```bash
npx tsx mcp-server/src/index.ts
```

Or build and run from mcp-server:

```bash
cd mcp-server && npm run build && npm start
```

Ensure `DATABASE_URL` and `MCP_API_KEYS` are set (e.g. in `.env` in repo root or in `mcp-server/.env`).
