import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth-guard";
import { procedureVersionService } from "@/lib/procedures/services/procedure-version.service";
import { TProcedure } from "@/lib/procedures/services/validator.service";

export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: { code: string } }
) => {
  try {
    const code = params.code;
    const procedure: TProcedure = await request.json();

    const result = await procedureVersionService.saveWithVersion(code, procedure);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Failed to save procedure version:", error);
    return NextResponse.json({ success: false, message: "Failed to save procedure" }, { status: 500 });
  }
}, 'procedures:create');