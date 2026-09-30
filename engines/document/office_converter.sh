#!/usr/bin/env bash
# DD Studio - Headless LibreOffice Document Converter
# Converts DOCX, PPTX, XLSX to PDF

set -e

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <inputFile> <outputDir>"
  exit 1
fi

INPUT_FILE="$1"
OUTPUT_DIR="$2"

if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Input file '$INPUT_FILE' does not exist." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

if command -v soffice >/dev/null 2>&1; then
  SOFFICE_BIN="soffice"
elif command -v libreoffice >/dev/null 2>&1; then
  SOFFICE_BIN="libreoffice"
else
  echo "Error: Neither soffice nor libreoffice is installed on this system." >&2
  exit 2
fi

echo "Converting '$INPUT_FILE' to PDF in '$OUTPUT_DIR' using $SOFFICE_BIN..."
"$SOFFICE_BIN" --headless --convert-to pdf --outdir "$OUTPUT_DIR" "$INPUT_FILE"

BASE_NAME=$(basename "$INPUT_FILE")
EXT="${BASE_NAME##*.}"
NAME_NO_EXT="${BASE_NAME%.*}"
EXPECTED_OUTPUT="$OUTPUT_DIR/$NAME_NO_EXT.pdf"

if [ -f "$EXPECTED_OUTPUT" ]; then
  echo "Conversion successful: $EXPECTED_OUTPUT"
  exit 0
else
  echo "Error: Expected output file '$EXPECTED_OUTPUT' was not created." >&2
  exit 3
fi
