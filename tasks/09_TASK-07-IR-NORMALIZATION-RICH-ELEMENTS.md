# TASK-07 — Canonical Document IR, Normalization & Rich Elements

## Goal

Create the stable internal representation downstream renderers trust.

## IR

Include:
- schema_version;
- document metadata;
- source hash;
- sections;
- questions;
- options;
- question type;
- source references;
- normalized content;
- answer/evidence;
- rich elements;
- layout hints;
- confidence;
- warnings.

## Validation

Reject:
- missing fields;
- duplicate question IDs;
- invalid question type;
- invalid source references;
- invalid option cardinality;
- invalid confidence.

## Normalization

AI can normalize presentation while preserving semantics:
- chemical formulas;
- superscript/subscript;
- math notation;
- units;
- arrows;
- punctuation where explicitly allowed.

## Rich elements

Prefer deterministic processing:
1. extract/crop source image;
2. preserve provenance;
3. deterministic render if a known representation exists;
4. AI reconstruction only when necessary.

For chemistry:
- if deterministic chemistry renderer exists, semantic representation → renderer → SVG.
- do not ask Agnes to invent arbitrary long SVG when code can render it.

For tables/graphs:
- preserve source table/image if reconstruction confidence is low.

## Acceptance

Raw Agnes response is never consumed directly by renderer.
Only validated IR goes downstream.
