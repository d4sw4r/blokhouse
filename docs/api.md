# API Documentation

## Overview

Blokhouse provides a RESTful API for programmatic access to all resources. The API supports both session-based authentication (for web UI) and bearer token authentication (for integrations).

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

To get the raw OpenAPI JSON spec:

```bash
curl https://your-blokhouse-instance/api/docs
```

## Authentication

Every API endpoint requires authentication, except `/api/health`, `/api/docs`
and the NextAuth endpoints under `/api/auth`.

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

## Core Endpoints

### Configuration Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/configuration-items` | List all configuration items |
| POST | `/api/configuration-items` | Create a new item |
| GET | `/api/configuration-items/:id` | Get a specific item |
| PUT | `/api/configuration-items/:id` | Update an item |
| DELETE | `/api/configuration-items/:id` | Delete an item |

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://blokhouse.example.com/api/configuration-items
```

### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create a tag |
| GET | `/api/tags/:id` | Get tag details |
| PUT | `/api/tags/:id` | Update a tag |
| DELETE | `/api/tags/:id` | Delete a tag |

### Item Types

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/types` | List all item types |
| POST | `/api/types` | Create a type |
| GET | `/api/types/:id` | Get type details |
| PUT | `/api/types/:id` | Update a type |
| DELETE | `/api/types/:id` | Delete a type |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users (admin only) |
| POST | `/api/users` | Create a user |
| GET | `/api/users/:id` | Get user details |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit-logs` | Query audit logs |
| GET | `/api/audit-logs/:id` | Get specific log entry |

Query parameters for filtering:
- `userId` - Filter by user
- `itemId` - Filter by configuration item
- `action` - Filter by action type (CREATE, UPDATE, DELETE)
- `from`, `to` - Date range

## Response Format

All responses are JSON. Successful responses include:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Rate Limiting

API requests are limited to 100 requests per minute per token. Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```
