# API Documentation

## Overview

Blokhouse is automation-first: everything you can do in the UI you can do over HTTP. Integrations
should use the versioned **[API v1](#api-v1-recommended)**. The API supports bearer token
authentication (for integrations) and session cookies (for the web UI).

## API Documentation UI

Interactive API documentation is available at:

```
https://your-blokhouse-instance/docs
```

This Swagger UI allows you to:
- Browse all available endpoints
- View request/response schemas
- Test endpoints directly from the browser
- Download the OpenAPI specification

## Raw OpenAPI Specification

```bash
curl https://your-blokhouse-instance/api/v1/openapi.json   # API v1 (OpenAPI 3.1)
curl https://your-blokhouse-instance/api/docs              # legacy API
```

Point code generators (`openapi-generator`, `oapi-codegen`, …) at the v1 document.

## Authentication

Every API endpoint requires authentication, except `/api/health`, `/api/docs`,
`/api/v1`, `/api/v1/openapi.json` and the NextAuth endpoints under `/api/auth`.

### Bearer Token (recommended for integrations)

Send the token in the `Authorization` header. Tokens are never accepted in the URL.

```bash
curl -H "Authorization: Bearer bh_..." \
  https://your-blokhouse-instance/api/configuration-items
```

Check a token and see its effective permissions:

```bash
curl -H "Authorization: Bearer bh_..." https://your-blokhouse-instance/api/validate-token
# {"valid":true,"scopes":["read"],"user":{"email":"ci@example.com","role":"API"}}
```

### Session Cookie

For browser-based requests, the session cookie is automatically sent when authenticated.

## Permissions

Access is controlled by **scopes**:

| Scope   | Allows |
|---------|--------|
| `read`  | Read CMDB data: items, types, tags, inventories (Ansible/Puppet/Chef) |
| `write` | Create, update and delete CMDB data |
| `audit` | Read and export audit logs |
| `admin` | Manage users, list all API tokens, network discovery |

Each user role grants a fixed set of scopes:

| Role       | Scopes |
|------------|--------|
| `ADMIN`    | read, write, audit, admin |
| `USER`     | read, write |
| `API`      | read, write (service account, cannot log in to the UI) |
| `AUDIT`    | read, audit |
| `READONLY` | read |

An API token carries its own scopes, chosen when it is created. Its **effective**
scopes are the intersection of the token's scopes and its owner's role, so a
token can never do more than the user who created it. If the user is demoted,
their tokens are demoted immediately.

Missing authentication returns `401`, missing permission returns `403`.

## Generating API Tokens

1. Log in to Blokhouse
2. Go to **Admin** → **API Tokens**
3. Enter a name (e.g. `ansible-prod`), select scopes and an expiry
4. Click **Generate API Token**
5. Copy the token immediately — only a SHA-256 hash is stored, it cannot be shown again

Tokens can be revoked at any time on the same page. Tokens can only be created
and revoked from an interactive session, not with another token.

Best practice for automation: create a dedicated user with the `API` role and
issue tokens for it, using `read` only for inventory consumers (Ansible, Puppet, Chef).

## API v1 (recommended)

All new integrations should use the versioned API under `/api/v1`. It is stable within v1:
fields and endpoints are only added, never removed or changed in meaning.

- Entry point: `GET /api/v1` (public)
- OpenAPI 3.1: `GET /api/v1/openapi.json` (public) — generated from the same schemas that
  validate requests, so it always matches the implementation
- Interactive docs: `/docs` (API v1 tab)

### Conventions

**Responses** wrap data in `data`. Lists add `meta`:

```json
{
  "data": [{ "id": "…", "name": "web-01", "type": "Server", "tags": ["prod"], "customFields": { "os": "Debian 12" } }],
  "meta": { "page": 1, "per_page": 50, "total": 1, "total_pages": 1 }
}
```

**Errors** always have the same shape. `details` lists every invalid field:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request body is invalid",
    "details": [{ "path": "ip", "message": "Must be a valid IPv4 or IPv6 address" }]
  }
}
```

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | `validation_failed`, `invalid_json` | Fix the request |
| 401 | `unauthorized` | Missing or invalid token |
| 403 | `forbidden` | Token lacks the required scope |
| 404 | `not_found` | |
| 409 | `conflict` | Unique value taken, or a name matches several items |
| 413 | `payload_too_large` | Body over 5 MB (20 MB for bulk upsert) |

**References by name.** `type` and `tags` are names, not IDs; missing types and tags are
created. Custom fields are an object keyed by field name, e.g. `{"rack_unit": 14}`.
Values are validated against the field type (`NUMBER`, `BOOLEAN`, `DATE`, `URL`, `EMAIL`, `STRING`)
and `null` removes a value.

**Pagination:** `?page=1&per_page=50` (max 500).

### Configuration items

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/configuration-items` | read | List. Filters: `q` (search), `status`, `type`, `tag`, `source` |
| POST | `/api/v1/configuration-items` | write | Create |
| GET | `/api/v1/configuration-items/{id}` | read | Get |
| PATCH | `/api/v1/configuration-items/{id}` | write | Change only the fields sent |
| DELETE | `/api/v1/configuration-items/{id}` | write | Delete |

### Upsert for automation

Automation rarely knows Blokhouse IDs. These endpoints create an item if it does not exist and
otherwise update **only the fields sent**. They are idempotent, so running the same job twice
changes nothing, and they set `lastSeenAt` to now unless you send it.

| Method | Path | Identity |
|--------|------|----------|
| PUT | `/api/v1/configuration-items/by-name/{name}` | Item name (409 if several items share it) |
| PUT | `/api/v1/configuration-items/by-external-id/{source}/{externalId}` | `source` + `externalId`, unique |
| POST | `/api/v1/configuration-items/bulk-upsert` | Per item: `"match": "name"` or `"externalId"` |

Use **by-name** when hostnames are unique (e.g. Ansible's `inventory_hostname`). Use
**by-external-id** when another system owns the identity — a Puppet certname, a VMware UUID,
a cloud instance ID. It survives renames.

```bash
# Ansible / shell: report a host
curl -X PUT "$BLOKHOUSE_URL/api/v1/configuration-items/by-name/web-01" \
  -H "Authorization: Bearer $BLOKHOUSE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"ip": "10.0.0.15", "type": "Server", "tags": ["prod", "web"], "customFields": {"os": "Debian 12"}}'

# Puppet: identity is the certname
curl -X PUT "$BLOKHOUSE_URL/api/v1/configuration-items/by-external-id/puppet/web-01.example.com" \
  -H "Authorization: Bearer $BLOKHOUSE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name": "web-01", "ip": "10.0.0.15"}'
```

The response says what happened: `201 {"result": "created", "data": {…}}`,
`200 {"result": "updated", "data": {…}}` or `200 {"result": "unchanged", "data": {…}}`.
"unchanged" means the item already had these values: only `lastSeenAt` was refreshed and no
audit entry was written. Tools like Ansible use it to report `changed: false`.

**Bulk upsert** writes up to 1000 items in **one transaction** — if any item is invalid, nothing
is written and `details` points at the item (`items.3.ip`):

```bash
curl -X POST "$BLOKHOUSE_URL/api/v1/configuration-items/bulk-upsert" \
  -H "Authorization: Bearer $BLOKHOUSE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"items": [
        {"name": "web-01", "ip": "10.0.0.15"},
        {"match": "externalId", "source": "vmware", "externalId": "4211-8a7b", "name": "db-01"}
      ]}'
# {"data": [{"index": 0, "result": "updated", "id": "…"}, …], "meta": {"created": 1, "updated": 1, "unchanged": 0}}
```

### Types and tags

| Method | Path | Scope |
|--------|------|-------|
| GET / POST | `/api/v1/types` | read / write |
| GET / POST | `/api/v1/tags` | read / write |

Both list `itemCount`. Creating an existing name (case-insensitive) returns 409.

### Audit trail

Every write through v1 is recorded in the audit log, including whether it came from a session
or a token.

## Legacy API

The unversioned endpoints under `/api/…` (e.g. `/api/configuration-items`, `/api/tags`,
`/api/ansible`, `/api/puppet`, `/api/chef`) are used by the web UI and the existing
integrations. They keep working, but their request and response formats may change between
releases. Use API v1 for new integrations. Their reference is the **Legacy API** tab at `/docs`.

Rate limiting is not built in yet; put a reverse proxy in front of Blokhouse if you need it
(see [nginx guide](deployment/nginx.md)).
