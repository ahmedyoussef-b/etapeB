import { NextRequest, NextResponse } from 'next/server';

export function createNextRequest(url: string): NextRequest {
  const request = new Request(url) as NextRequest;
  return request;
}
