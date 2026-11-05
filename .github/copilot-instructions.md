
# Creditfix Prototype - Global Instructions

## Project Overview
Build an AI-powered Grievance Management System for a hypothetical Indian District Administration.

The system allows citizens to submit grievances, uses Groq AI to classify and summarize complaints, recommends departments through deterministic mapping rules, and allows authorized officers to review and manage cases.

## Technology Stack

### Frontend
- React.js with Vite
- JavaScript (no TypeScript)
- Bootstrap 5
- Custom CSS
- Axios
- React Router

### Backend
- Python
- FastAPI
- Pydantic
- PyMongo or Motor (choose one consistent MongoDB access approach)

### Database and Storage
- MongoDB Atlas for application data.
- Cloudinary for uploaded documents.
- Store Cloudinary URLs, public IDs and file metadata in MongoDB.

### AI
- Groq API through its OpenAI-compatible Python SDK.
- Structured JSON responses.
- Server-side AI integration only.

## Core Functional Requirements

1. Citizen grievance submission.
2. Document attachment.
3. AI-based grievance classification.
4. AI-generated grievance summary.
5. AI priority suggestion.
6. AI confidence score and explanation.
7. Rules-based department recommendation.
8. Officer approval and correction.
9. Case tracking and status management.
10. Complete audit history.
11. Administrative dashboard.

## Important Business Rules

- AI suggestions must never automatically approve or reject grievances.
- Department assignment must use deterministic mapping rules.
- Officers retain authority over final decisions.
- Low-confidence or unmapped cases must go for manual review.
- Every important action must generate an audit event.
- Only authorized users can perform administrative actions.
- Use synthetic data for the prototype.
- Never claim integration with actual government systems.

## Engineering Standards

- Use modular and maintainable architecture.
- Keep frontend, backend, AI and database responsibilities separate.
- Follow REST API conventions.
- Validate all incoming data.
- Handle errors explicitly.
- Never expose API keys or secrets.
- Use environment variables.
- Avoid unnecessary dependencies and abstractions.
- Write reusable components and functions.
- Keep code readable and properly documented.

## Security

- Implement JWT-based authentication.
- Enforce role-based authorization on the backend.
- Validate uploaded file types and sizes.
- Protect sensitive environment variables.
- Validate all AI-generated structured outputs.
- Never trust client-provided roles or permissions.

## Development Rules

- Inspect existing code before modifying it.
- Do not overwrite working functionality unnecessarily.
- Do not invent requirements.
- Do not add features outside the agreed prototype scope.
- Do not create duplicate components or API endpoints.
- Explain significant architectural decisions.
- Test every important workflow.
- Update documentation when implementation changes.

## Definition of Done

A feature is complete only when:
1. Its frontend is implemented.
2. Its backend API works.
3. Required database operations work.
4. Validation and error handling exist.
5. Relevant tests pass.
6. Its behaviour matches the assessment requirements.


## This is the complete structure of this project:


creditfix_prototype/
│
├── .github/
│   ├── agents/
│   ├── skills/
│   └── copilot-instructions.md
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── pages/
│       │   ├── auth/
│       │   ├── citizen/
│       │   ├── officer/
│       │   └── admin/
│       ├── layouts/
│       ├── services/
│       ├── context/
│       ├── routes/
│       ├── utils/
│       ├── App.jsx
│       └── main.jsx
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── database/
│   │   ├── middleware/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
│
├── README.md
└── .gitignore
