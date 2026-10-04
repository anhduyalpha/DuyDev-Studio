# TASK-02 — PDF Ingestion & Google Drive Fetch

## Goal

Convert upload/Drive source into a validated server-local PDF.

## Upload

Validate:
- size;
- extension;
- MIME;
- PDF magic bytes;
- readable/openable PDF.

Compute SHA-256.

## Drive

Implement safely using existing project conventions:
- accept valid Google Drive share URL;
- fetch file;
- timeout;
- content-type validation;
- size limit;
- reject unsupported redirects;
- cleanup partial downloads.

## Output

```json
{
  "source_id": "...",
  "sha256": "...",
  "page_count": 0,
  "local_path": "...",
  "source_type": "upload|google_drive"
}
```

## Acceptance

- valid upload works;
- valid Drive file works;
- broken PDF fails clearly;
- fetch errors have stable error codes;
- duplicate source can be cached by hash when possible.
