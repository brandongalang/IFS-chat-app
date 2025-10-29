import { NextResponse } from 'next/server';
import type { CompletionResponse, CompletionSummary } from './types';

interface BuildCompletionResponseOptions {
  setCompletionCookie?: boolean;
  summary?: CompletionSummary;
}

export function buildCompletionResponse(
  completedAt: string,
  options: BuildCompletionResponseOptions = {}
): NextResponse<CompletionResponse> {
  const redirectBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const isHttps = (() => {
    try {
      return new URL(redirectBase).protocol === 'https:';
    } catch {
      return process.env.NODE_ENV === 'production';
    }
  })();

  const response: CompletionResponse = {
    ok: true,
    redirect: `${redirectBase}/chat`,
    completed_at: completedAt,
  };

  if (options.summary) {
    response.summary = options.summary;
  }

  const res = NextResponse.json(response);

  if (options.setCompletionCookie ?? true) {
    try {
      res.cookies.set('ifs_onb', '1', {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: isHttps,
        maxAge: 60 * 60 * 6,
      });
    } catch {}
  }

  return res;
}
