import { NextResponse } from "next/server";
import { getFeed } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 20);

  const feed = getFeed(limit);

  return NextResponse.json({
    feed,
    count: feed.length,
  });
}
