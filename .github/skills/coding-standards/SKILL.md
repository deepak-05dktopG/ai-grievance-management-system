
---
name: coding-standards
description: Establishes consistent coding conventions, modularity, naming, error handling and maintainability standards across the project.
---

# Coding Standards

## General
- Write clean, readable and maintainable code.
- Follow separation of concerns.
- Avoid duplicated logic.
- Use meaningful variable and function names.
- Keep functions focused.
- Avoid unnecessary abstractions.
- Comment complex business logic.

## Frontend
- JavaScript only; no TypeScript.
- Use functional React components.
- Use React hooks appropriately.
- Separate components, pages and services.
- Keep API calls outside presentation components where practical.
- Use consistent naming conventions.
- Avoid large monolithic components.

## Backend
- Follow Python conventions and PEP 8.
- Use type hints.
- Use Pydantic schemas for validation.
- Separate routes, services and database operations.
- Use dependency injection where appropriate.
- Handle exceptions explicitly.
- Avoid unnecessary global state.

## API Standards
- Use REST conventions.
- Use appropriate HTTP methods and status codes.
- Return consistent response structures.
- Validate request parameters.
- Avoid exposing internal error details.

## Environment
- Keep secrets in environment variables.
- Maintain .env.example.
- Never commit actual credentials.
- Use separate frontend and backend environment configurations.

## Documentation
- Document important modules.
- Document API endpoints.
- Update README when setup changes.
- Explain non-obvious technical decisions.
