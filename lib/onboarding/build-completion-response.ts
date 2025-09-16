import { NextResponse } from 'next/server';
import type { CompletionResponse } from './types';

interface BuildCompletionResponseOptions {
  setCompletionCookie?: boolean;
}

export function buildCompletionResponse(
  completedAt: string,
  options: BuildCompletionResponseOptions = {}
): NextResponse<CompletionResponse> {
  const redirectBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const response: CompletionResponse = {
    ok: true,
    redirect: `${redirectBase}/`,
    completed_at: completedAt,
  };

  const res = NextResponse.json(response);

  if (options.setCompletionCookie ?? true) {
    try {
      res.cookies.set('ifs_onb', '0', {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: true,
      });
    } catch {}
  }

  return res;
}
