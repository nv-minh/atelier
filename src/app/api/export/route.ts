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
  //
  // Defense in depth: parseFilter already validates topic against the topic
  // taxonomy (an unknown slug never reaches `filter`), but strip each part to
  // a safe charset here too, so a future caller that builds a filter by hand
  // cannot reopen the header-injection hole (a stray `"` could inject a
  // second `filename=` parameter, and CR/LF would throw a 500 from the header
  // validator).
  const parts = [filter.scope, filter.cefr, filter.topic]
    .filter(Boolean)
    .map((part) => String(part).replace(/[^A-Za-z0-9_-]/g, ""));
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
