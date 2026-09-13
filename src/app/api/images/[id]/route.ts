import { NextRequest, NextResponse } from "next/server";
import { safeGetMediaById, safeUpdateMedia, safeRemoveMedia } from "@/lib/services/images.fallback";
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from "@/lib/api/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser(_request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'banque-images:view')) {
    return unauthorizedResponse();
  }

  const item = await safeGetMediaById(params.id);
  if (!item) {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'banque-images:*')) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const item = await safeUpdateMedia(params.id, body);
    if (!item) {
      return NextResponse.json({ message: "Image not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("Invalid data:", error);
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser(_request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'banque-images:delete')) {
    return unauthorizedResponse();
  }

  const success = await safeRemoveMedia(params.id);
  if (!success) {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}