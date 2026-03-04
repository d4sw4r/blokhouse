# Blokhouse Architecture

## Overview

Blokhouse is a modern Configuration Management Database (CMDB) and IT Asset Management system built with the latest web technologies.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework with App Router |
| React | 19 | UI library |
| TypeScript | - | Type-safe development |
| Prisma | - | Database ORM |
| SQLite | - | Database |
| NextAuth.js | - | Authentication |
| Tailwind CSS | - | Styling |

## Application Structure

```
/app              # Next.js App Router pages
/components       # Reusable React components
/lib              # Utility functions, helpers
/prisma           # Database schema and migrations
/public           # Static assets
```

## Authentication

Blokhouse uses **NextAuth.js** with the following configuration:

- **Provider**: Credentials Provider (username/password)
- **Session Strategy**: JWT-based sessions with cookies
- **API Authentication**: Bearer tokens for programmatic access

Users can generate API tokens in the Settings → API Tokens section for external integrations.

## Database Models

### User
System users with authentication credentials and role-based access control.

### ConfigurationItem
Core entity representing IT assets (servers, network devices, applications, etc.). Contains:
- Name, description, status
- Type classification
- Custom fields
- Tags
- Relationships to other items

### ItemType
Defines categories of configuration items (e.g., Server, Router, Database). Each type can have:
- Custom field definitions
- Icon representation

### Tag
Labels for organizing and filtering configuration items. Many-to-many relationship with ConfigurationItem.

### CustomField
Extensible schema for adding custom attributes to configuration items:
- Supports multiple data types (text, number, date, boolean)
- Linked to ItemType for type-specific fields
- Linked to ConfigurationItem for values

### AssetRelation
Defines relationships between configuration items (e.g., "depends on", "contains", "runs on"):
- Source and target item references
- Relation type
- Bidirectional tracking

### AuditLog
Tracks all changes to configuration items for compliance and history:
- User who made the change
- Timestamp
- Action type (create, update, delete)
- Before/after values

### MaintenanceSchedule
Planned maintenance windows for configuration items:
- Start/end times
- Description
- Affected items
- Status tracking

### Notification
User notifications for events like:
- Maintenance reminders
- Asset status changes
- System alerts

### ApiToken
Tokens for API authentication:
- Token hash
- User association
- Creation/expiration dates
- Last used timestamp

## Data Flow

1. **Web UI**: Next.js App Router handles server and client components
2. **API Layer**: RESTful endpoints under `/api/*`
3. **Database**: Prisma ORM manages SQLite queries
4. **Auth**: NextAuth middleware protects routes

## Security Considerations

- All API endpoints require authentication (session or bearer token)
- Passwords are hashed with bcrypt
- API tokens are hashed before storage
- Audit logging tracks all data modifications
