
---
name: project-architecture
description: Defines the system architecture, modules, responsibilities and end-to-end data flow for the Creditfix grievance management prototype.
---

# Project Architecture Skill

## System Overview

The application consists of:

1. React frontend.
2. FastAPI backend.
3. MongoDB Atlas database.
4. Cloudinary document storage.
5. Gemini AI integration.

## Main Modules

### Citizen Portal
- Submit grievances.
- Enter personal and complaint details.
- Upload supporting documents.
- Receive a grievance reference ID.

### AI Processing
- Analyze complaint text.
- Classify grievance.
- Generate summary.
- Suggest priority.
- Return confidence and explanation.

### Department Routing
- Use predefined category-to-department mappings.
- Apply deterministic routing rules.
- Send unmapped or uncertain cases for manual review.

### Officer Portal
- Review AI suggestions.
- Approve or correct classifications.
- Manage assigned grievances.
- Update case status.

### Dashboard
- Total grievances.
- Pending grievances.
- Resolved grievances.
- Cases by category.
- Cases by department.
- Recent activities.

### Audit Module
- Record important actions.
- Record actor and timestamp.
- Record previous and updated values where appropriate.

## Main Workflow

Citizen Submission
→ Backend Validation
→ MongoDB Case Creation
→ Gemini Classification
→ Structured Output Validation
→ Department Mapping
→ Officer Review
→ Authorized Case Update
→ Audit Logging

## Architecture Principles

- Separate responsibilities.
- Keep AI processing isolated.
- Use backend-controlled business rules.
- Maintain one source of truth in MongoDB.
- Keep human approval mandatory.
- Avoid unnecessary distributed systems.
- Design for future integration without implementing it now.

## Important Boundary

This is a prototype using synthetic data, not a production government deployment.
