import { NextRequest, NextResponse } from 'next/server';

export function createNextRequest(url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }): NextRequest {
  const request = new Request(url, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: options?.body
  }) as NextRequest;
  
  const urlObj = new URL(url);
  (request as any).nextUrl = {
    searchParams: urlObj.searchParams,
  };
  
  return request;
}
