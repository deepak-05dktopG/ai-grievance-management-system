
---
name: security
description: Defines security requirements for authentication, authorization, citizen data, document uploads, AI processing, API credentials and audit records.
---

# Security Skill

## Authentication
- Use JWT authentication.
- Hash passwords using a secure password hashing algorithm.
- Validate tokens on protected endpoints.
- Handle expired and invalid tokens.

## Authorization

Define roles:

### Citizen
- Submit grievances.
- View own grievances.
- Upload supporting documents.
- View permitted status information.

### Officer
- View authorized departmental cases.
- Review AI suggestions.
- Approve or correct classifications.
- Update permitted case statuses.

### Administrator
- Manage users and departments.
- View administrative dashboard.
- Access authorized case information.
- Review audit history.

Enforce all permissions on the backend.

## Data Protection

- Collect only necessary personal information.
- Never expose citizen details unnecessarily.
- Use HTTPS in production.
- Keep secrets in environment variables.
- Avoid logging passwords, tokens or sensitive documents.
- Define appropriate retention and deletion policies.

## File Upload Security

- Validate extensions and MIME types.
- Enforce file size limits.
- Generate safe storage identifiers.
- Use Cloudinary secure URLs.
- Never trust filenames supplied by users.
- Restrict access to sensitive documents.

## AI Security

- Treat citizen input as untrusted.
- Prevent prompt injection from triggering privileged actions.
- Validate AI-generated outputs.
- Never give AI direct database write authority.
- Never allow AI to approve or reject grievances.

## Audit Security

Record:
- Actor.
- Action.
- Timestamp.
- Relevant record ID.
- Previous and updated values where appropriate.

Do not allow ordinary users to modify audit history.

## General Rule

Security controls must be enforced by the backend, not merely hidden in the frontend.
