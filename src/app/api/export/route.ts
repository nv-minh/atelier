import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { getExportRows, toAnkiTxt, toCsv } from "@/lib/export";
import { parseFilter, EXPORT_SCOPES } from "@/lib/vault/scope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  if (format !== "csv" && format !== "anki") {
    return NextResponse.json({ error: "invalid format" }, { status: 400 });
  }

  const filter = parseFilter(
    {
      scope: searchParams.get("scope") ?? undefined,
      cefr: searchParams.get("cefr") ?? undefined,
      topic: searchParams.get("topic") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    },
    EXPORT_SCOPES
  );

  const rows = await getExportRows(userId, filter);

  // The filename describes what's actually inside, even when several filter
  // layers are stacked (scope + cefr + topic). It degrades gracefully: any
  // part left unset is simply omitted rather than leaving a stray "-".
  const parts = [filter.scope, filter.cefr, filter.topic].filter(Boolean);
  const isCsv = format === "csv";
  const body = isCsv ? toCsv(rows) : toAnkiTxt(rows);
  const contentType = isCsv ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8";
  const filename = `vocab-${parts.join("-")}.${isCsv ? "csv" : "txt"}`;

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
