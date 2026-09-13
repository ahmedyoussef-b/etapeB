import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-guard";
import { procedureVersionService } from "@/lib/procedures/services/procedure-version.service";

export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: { code: string } }
) => {
  try {
    const code = params.code;
    const versions = await procedureVersionService.listVersions(code);
    return NextResponse.json(versions, { status: 200 });
  } catch (error) {
    console.error("Failed to list procedure versions:", error);
    return NextResponse.json({ success: false, message: "Failed to list versions" }, { status: 500 });
  }
}, 'procedures:view');