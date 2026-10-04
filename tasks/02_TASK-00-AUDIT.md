# TASK-00 — Audit Existing Module

## Goal

Hiểu repository thật trước khi sửa.

## Must inspect

- framework/frontend/backend;
- module Tạo Bài Tập Trắc Nghiệm;
- upload;
- Drive;
- current HTTP routes;
- persistence/storage;
- background jobs;
- PDF parser;
- OCR;
- Agnes;
- prompt;
- HTML/CSS;
- PDF renderer;
- answer generation;
- preview/download;
- progress/status;
- tests.

## Must not

- redesign UI;
- rewrite unrelated code;
- add AI pipeline yet.

## Outputs

Create:
- `docs/current-module-audit.md`
- `docs/current-data-flow.md`
- `docs/agent-handoff.md`

## Audit format

For every relevant component:
- path;
- class/function;
- role;
- input/output;
- dependency;
- reusable?;
- defect/gap;
- evidence.

## Special investigation

Determine whether current system:
- sends full PDF to Agnes;
- sends one question per call;
- batches;
- mixes extraction/normalization/rendering in one prompt;
- has schema validation;
- has QA loop.

## Acceptance

A developer can understand the current PDF module without opening every file.

Do not proceed to TASK-01 automatically.
