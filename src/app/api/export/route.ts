import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { getExportRows, parseScope, toAnkiTxt, toCsv } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  const scope = parseScope(searchParams.get("scope"));

  if (format !== "csv" && format !== "anki") {
    return NextResponse.json({ error: "invalid format" }, { status: 400 });
  }
  if (!scope) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  }

  const rows = await getExportRows(userId, scope);

  // `cefr:A1` → `cefr-A1` so the level survives in the download filename.
  const safeScope = scope.replace(/:/g, "-");
  const isCsv = format === "csv";
  const body = isCsv ? toCsv(rows) : toAnkiTxt(rows);
  const contentType = isCsv ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8";
  const filename = `vocab-${safeScope}.${isCsv ? "csv" : "txt"}`;

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
