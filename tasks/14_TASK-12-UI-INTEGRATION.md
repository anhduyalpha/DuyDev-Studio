# TASK-12 — Integrate Existing UI

## Goal

Connect current UI to backend only.

## Existing UI must remain

The supplied UI already includes:
- source upload / Google Drive;
- Smart Recognition box;
- extraction page fields;
- question count;
- starting question;
- filename;
- title;
- progress state;
- output cards;
- preview/download.

Do not redesign.

## Smart Recognition endpoint

Input:
```json
{
  "instruction": "Trang 11 từ câu 1 đến 30"
}
```

Output:
- extraction plan;
- warnings;
- confidence.

Frontend fills existing fields.

## Generate endpoint

Input:
- source/job;
- page range;
- question count;
- start question;
- filename prefix;
- title;
- style preset.

## Status

UI polls or subscribes using existing project's mechanism.

## Result

Map:
- question PDF URL;
- answer PDF URL;
- page counts;
- question count;
- image count;
- file sizes.

## Acceptance

User can:
1. upload/deliver Drive PDF;
2. Smart Analyze;
3. review plan;
4. Generate;
5. see progress;
6. preview/download both PDFs.

No Agnes secret reaches browser.
