
---
name: api-development
description: Defines FastAPI REST API design, request validation, response contracts, authentication dependencies and error handling.
---

# API Development Skill

## Framework

Use FastAPI.

## API Modules

### Authentication
- POST /api/auth/login
- POST /api/auth/register (only if registration is required)
- GET /api/auth/me

### Grievances
- POST /api/grievances
- GET /api/grievances
- GET /api/grievances/{id}
- PATCH /api/grievances/{id}/status

### AI
- POST /api/ai/classify
- POST /api/grievances/{id}/analyze

### Officer Review
- POST /api/grievances/{id}/review
- POST /api/grievances/{id}/assign

### Documents
- POST /api/grievances/{id}/documents
- GET /api/grievances/{id}/documents

### Dashboard
- GET /api/dashboard/stats

### Audit
- GET /api/grievances/{id}/audit-logs

These endpoints are proposed contracts; adjust them to the final implementation without duplicating functionality.

## API Rules

- Use appropriate HTTP methods.
- Validate all incoming requests.
- Use Pydantic schemas.
- Return consistent JSON responses.
- Implement pagination where needed.
- Use meaningful HTTP status codes.
- Protect sensitive endpoints.
- Handle missing resources properly.
- Keep business logic in service modules.

## Authentication

- Use JWT.
- Verify token on protected routes.
- Enforce roles on the backend.
- Never trust frontend authorization checks alone.

## Error Handling

Handle:
- Invalid requests.
- Unauthorized requests.
- Forbidden actions.
- Missing records.
- Database failures.
- AI provider failures.
- Cloudinary upload failures.

## Documentation

Maintain accurate FastAPI OpenAPI documentation.
