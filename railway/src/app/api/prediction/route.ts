import { NextResponse } from "next/server";
import { getLastResult } from "@/agents/pipeline";
import { readJSON } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  // Try in-memory first, then file system
  let result = getLastResult();
  if (!result) {
    result = readJSON("latest.json", null);
  }

  if (!result) {
    return NextResponse.json(
      { error: "No predictions yet. Pipeline may not have run." },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
