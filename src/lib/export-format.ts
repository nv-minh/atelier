// Pure export formatters (CSV + Anki TXT). No server-only import so these can be
// unit-smoke-tested with tsx and reused by the server module in export.ts.

export type ExportRow = {
  word: string;
  ipa: string;
  typeEn: string;
  definitionEn: string;
  definitionVi: string;
  example: string;
  exampleVi: string;
  cefr: string;
};

// CEFR levels available as an export scope. Lives here (pure module, no
// server-only) so both the server scope logic and the client scope select
// share one list.
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2"] as const;

// BOM (U+FEFF), written as an escape so a formatter/copy-paste can't silently
// drop the invisible character. Excel needs it to open UTF-8 (Vietnamese
// diacritics) without mojibake.
const BOM = "﻿";

const CSV_HEADER = [
  "Word",
  "IPA",
  "Type",
  "Definition",
  "DefinitionVi",
  "Example",
  "ExampleVi",
  "CEFR",
];

// RFC-4180: wrap a field in double quotes when it contains a quote, comma, or
// newline; escape embedded quotes by doubling them.
function csvField(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function csvLine(fields: string[]): string {
  return fields.map(csvField).join(",");
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [csvLine(CSV_HEADER)];
  for (const r of rows) {
    lines.push(
      csvLine([r.word, r.ipa, r.typeEn, r.definitionEn, r.definitionVi, r.example, r.exampleVi, r.cefr])
    );
  }
  // CRLF line endings per RFC-4180; BOM prefix for Excel.
  return BOM + lines.join("\r\n") + "\r\n";
}

// Anki ≥2.1.54 header-line format. Tab-separated; CEFR level rides in the tags
// column (declared via `#tags column`). Strip tabs/newlines from values so a
// stray character can't shift a field into the wrong column.
function ankiField(v: string): string {
  return v.replace(/[\t\r\n]+/g, " ");
}

export function toAnkiTxt(rows: ExportRow[]): string {
  const lines = [
    "#separator:tab",
    "#html:false",
    "#columns:Word\tIPA\tType\tDefinition\tDefinitionVi\tExample\tExampleVi\tTags",
    "#tags column:8",
  ];
  for (const r of rows) {
    lines.push(
      [r.word, r.ipa, r.typeEn, r.definitionEn, r.definitionVi, r.example, r.exampleVi, r.cefr]
        .map(ankiField)
        .join("\t")
    );
  }
  return lines.join("\n") + "\n";
}
