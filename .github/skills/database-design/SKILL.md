
---
name: database-design
description: Defines MongoDB collection design, document structures, indexing, relationships, Cloudinary metadata and data consistency practices.
---

# Database Design Skill

## Database

Use MongoDB Atlas.

Use one consistent database access library throughout the backend.

## Proposed Collections

### 1. users
Fields:
- _id
- name
- email
- password_hash
- role
- department_id
- is_active
- created_at
- updated_at

### 2. grievances
Fields:
- _id
- reference_id
- citizen_details
- complaint_text
- category
- subcategory
- ai_summary
- suggested_priority
- final_priority
- ai_confidence
- suggested_department_id
- assigned_department_id
- assigned_officer_id
- status
- review_status
- document_ids
- created_at
- updated_at
- resolved_at

### 3. departments
Fields:
- _id
- name
- code
- supported_categories
- is_active

### 4. documents
Fields:
- _id
- grievance_id
- original_filename
- cloudinary_public_id
- secure_url
- resource_type
- format
- size
- uploaded_at

### 5. audit_logs
Fields:
- _id
- grievance_id
- actor_id
- action
- previous_value
- new_value
- description
- created_at

## Database Rules

- Use appropriate indexes.
- Enforce unique grievance reference IDs.
- Use UTC timestamps.
- Validate IDs and references.
- Avoid unnecessary duplication.
- Use pagination for listing endpoints.
- Validate all data before database writes.
- Preserve historical audit records.

## Cloudinary Integration

- Upload files through the backend.
- Validate file type and size before uploading.
- Store files in Cloudinary.
- Save public_id and secure_url in MongoDB.
- Use unique and organized upload identifiers.
- Never expose Cloudinary API secrets.
- Support deletion of files when authorized and required.

## Data Integrity

- Do not trust frontend-supplied user roles.
- Validate relationships between cases, users and departments.
- Ensure case updates are authorized.
- Record important changes in audit_logs.
- Avoid permanently deleting case history.

## Important

Use MongoDB document references where appropriate. Do not force relational database patterns into every collection.
