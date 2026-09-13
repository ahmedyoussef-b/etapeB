export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { ContextGeneratorService } from '@/lib/services/context-generator.service';
import { getAuthenticatedUser, hasPermission, unauthorizedResponse, unauthenticatedResponse } from '@/lib/api/auth-guard';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return unauthenticatedResponse();
  }
  if (!hasPermission(user.role, 'settings:*')) {
    return unauthorizedResponse();
  }

  try {
    const service = new ContextGeneratorService();
    const result = await service.generate();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: {
          lastUpdate: result.lastUpdate,
          version: result.version
        }
      });
    }

    return NextResponse.json(
      { success: false, message: result.message },
      { status: 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Erreur serveur : ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }
}
