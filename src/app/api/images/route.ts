import { NextRequest, NextResponse } from "next/server";
import { safeGetAllMedia, safeCreateMedia, safeGetCategories } from "@/lib/services/images.fallback";
import { withAuth } from "@/lib/api/auth-guard";

export const GET = withAuth(async () => {
  try {
    const [items, categories] = await Promise.all([safeGetAllMedia(), safeGetCategories()]);
    return NextResponse.json({ items, categories });
  } catch (error) {
    console.error("Failed to fetch images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}, 'banque-images:view');

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const item = await safeCreateMedia(body);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Invalid data:", error);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}, 'banque-images:upload');