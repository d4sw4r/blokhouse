/**
 * lib/swagger.js
 * OpenAPI/Swagger configuration and spec generation
 */

import { createSwaggerSpec } from "next-swagger-doc";

export const getApiDocs = async () => {
    const spec = createSwaggerSpec({
        apiFolder: "app/api",
        definition: {
            openapi: "3.0.0",
            info: {
                title: "Blokhouse CMDB API",
                version: "1.0.0",
                description: "Configuration Management Database API for infrastructure automation",
                contact: {
                    name: "Blokhouse",
                    url: "https://github.com/d4sw4r/blokhouse",
                },
            },
            servers: [
                {
                    url: "http://localhost:3000/api",
                    description: "Local development server",
                },
                {
                    url: "/api",
                    description: "Production server (relative)",
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                        description: "API Token authentication",
                    },
                    cookieAuth: {
                        type: "apiKey",
                        in: "cookie",
                        name: "next-auth.session-token",
                        description: "Session cookie authentication",
                    },
                },
                schemas: {
                    ConfigurationItem: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "Unique identifier" },
                            name: { type: "string", description: "Asset name" },
                            description: { type: "string", nullable: true },
                            ip: { type: "string", nullable: true, description: "IP address" },
                            mac: { type: "string", nullable: true, description: "MAC address" },
                            status: { 
                                type: "string", 
                                enum: ["ACTIVE", "DEPRECATED", "MAINTENANCE"],
                                default: "ACTIVE"
                            },
                            itemTypeId: { type: "string", nullable: true },
                            itemType: { 
                                type: "object", 
                                nullable: true,
                                properties: {
                                    id: { type: "string" },
                                    name: { type: "string" },
                                }
                            },
                            tags: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "string" },
                                        name: { type: "string" },
                                        color: { type: "string", nullable: true },
                                    }
                                }
                            },
                            createdAt: { type: "string", format: "date-time" },
                            updatedAt: { type: "string", format: "date-time" },
                        },
                        required: ["id", "name", "status", "createdAt", "updatedAt"],
                    },
                    ItemType: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            description: { type: "string", nullable: true },
                        },
                        required: ["id", "name"],
                    },
                    Tag: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            color: { type: "string", nullable: true },
                            description: { type: "string", nullable: true },
                            createdAt: { type: "string", format: "date-time" },
                            _count: {
                                type: "object",
                                properties: {
                                    configurationItems: { type: "integer" },
                                }
                            }
                        },
                        required: ["id", "name", "createdAt"],
                    },
                    ApiToken: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            token: { type: "string" },
                            createdAt: { type: "string", format: "date-time" },
                        },
                        required: ["id", "token", "createdAt"],
                    },
                    AuditLog: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            action: { 
                                type: "string",
                                enum: ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "API_TOKEN_CREATED", "API_TOKEN_DELETED"]
                            },
                            entityType: { type: "string" },
                            entityId: { type: "string", nullable: true },
                            userId: { type: "string", nullable: true },
                            user: {
                                type: "object",
                                nullable: true,
                                properties: {
                                    id: { type: "string" },
                                    name: { type: "string", nullable: true },
                                    email: { type: "string" },
                                }
                            },
                            description: { type: "string", nullable: true },
                            oldValues: { type: "object", nullable: true },
                            newValues: { type: "object", nullable: true },
                            ipAddress: { type: "string", nullable: true },
                            userAgent: { type: "string", nullable: true },
                            createdAt: { type: "string", format: "date-time" },
                        },
                        required: ["id", "action", "entityType", "createdAt"],
                    },
                    Error: {
                        type: "object",
                        properties: {
                            error: { type: "string" },
                        },
                        required: ["error"],
                    },
                    Pagination: {
                        type: "object",
                        properties: {
                            total: { type: "integer" },
                            page: { type: "integer" },
                            limit: { type: "integer" },
                            totalPages: { type: "integer" },
                        },
                        required: ["total", "page", "limit", "totalPages"],
                    },
                },
            },
            tags: [
                { name: "Configuration Items", description: "Asset management" },
                { name: "Item Types", description: "Asset categorization" },
                { name: "Tags", description: "Flexible asset labeling" },
                { name: "API Tokens", description: "Authentication tokens" },
                { name: "Audit Logs", description: "Change history" },
                { name: "Automation", description: "Ansible, Puppet, Chef integration" },
                { name: "Dashboard", description: "Overview statistics" },
            ],
        },
    });
    return spec;
};
