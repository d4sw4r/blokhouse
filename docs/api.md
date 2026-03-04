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

### Bearer Token (Recommended for integrations)

Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://your-blokhouse-instance/api/items
```

### Session Cookie

For browser-based requests, the session cookie is automatically sent when authenticated.

## Generating API Tokens

1. Log in to Blokhouse
2. Go to **Settings** → **API Tokens**
3. Click **Create Token**
4. Give it a descriptive name
5. Copy the token immediately (it won't be shown again)

## Core Endpoints

### Configuration Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | List all configuration items |
| POST | `/api/items` | Create a new item |
| GET | `/api/items/:id` | Get a specific item |
| PUT | `/api/items/:id` | Update an item |
| DELETE | `/api/items/:id` | Delete an item |

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://blokhouse.example.com/api/items
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
