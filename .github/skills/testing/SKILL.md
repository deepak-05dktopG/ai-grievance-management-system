
---
name: testing
description: Defines unit, integration, API, frontend, security and AI evaluation testing practices for the Creditfix prototype.
---

# Testing Skill

## Testing Objectives

Verify that the application works correctly from citizen submission to officer review and case management.

## Backend Testing

Use pytest and FastAPI TestClient.

Test:
- API request validation.
- Authentication.
- Role-based authorization.
- Grievance creation.
- Grievance retrieval.
- Case updates.
- Officer review.
- Department mapping.
- Audit event creation.
- MongoDB operations.
- Cloudinary integration failures.

## Frontend Testing

Test:
- Form validation.
- Navigation.
- API integration.
- Loading states.
- Error states.
- Dashboard rendering.
- Officer review interactions.
- Responsive layouts.

## AI Testing

Test:
- Correct category suggestions.
- Correct subcategory suggestions.
- Summary quality.
- Priority suggestions.
- Confidence score handling.
- Unsupported categories.
- Ambiguous complaints.
- Malformed JSON.
- Prompt injection.
- Gemini API failures.

Use a predefined set of synthetic grievances and expected outcomes.

## Security Testing

Test:
- Invalid JWT.
- Expired JWT.
- Unauthorized access.
- Citizen accessing another citizen's case.
- Officer accessing unauthorized departmental cases.
- Invalid file uploads.
- Unauthorized administrative operations.

## Integration Testing

Verify the complete workflow:

1. Citizen submits grievance.
2. Backend creates a case.
3. Documents upload to Cloudinary.
4. Gemini processes the grievance.
5. Department mapping runs.
6. Officer reviews the suggestion.
7. Officer updates the case.
8. Audit history records the action.
9. Dashboard reflects the updated case.

## Reporting

For every test, record:
- Test case.
- Input.
- Expected result.
- Actual result.
- Pass or fail.
- Identified issue.

## Rules

- Never claim tests passed without running them.
- Never replace failed tests with skipped tests to hide problems.
- Test important failure scenarios.
- Fix root causes rather than hiding errors.
