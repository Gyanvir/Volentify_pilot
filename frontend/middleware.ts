import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/** Role-based route protection (PRD SEC-03). Session JWT is issued by the FastAPI auth routes. */

const DEV_SECRET = 'volentify-local-development-secret-change-me';
const RULES: { prefix: string; roles?: string[] }[] = [
  { prefix: '/admin', roles: ['INCIDENT_ADMIN'] },
  { prefix: '/agency', roles: ['INCIDENT_ADMIN', 'NGO_MEMBER'] },
  { prefix: '/dashboard' },
  { prefix: '/onboarding' },
];

interface Claims { sub: string; role: string; onboarded: boolean; verified: boolean }

const clean = (value?: string) => (value ?? '').trim().replace(/^"+|"+$/g, '');

async function signingKey(): Promise<string> {
  const explicit = clean(process.env.NEXTAUTH_SECRET) || clean(process.env.SESSION_SECRET);
  if (explicit) return explicit;
  // Same order as DATABASE_URL_VARS in api/_lib/core/config.py (static reads so the Edge runtime sees them).
  const dbUrl = [process.env.DATABASE_URL, process.env.DB_URL, process.env.POSTGRES_URL, process.env.DB_POSTGRES_URL,
    process.env.DATABASE_POSTGRES_URL, process.env.NEON_DATABASE_URL, process.env.DATABASE_URL_UNPOOLED,
    process.env.DB_URL_UNPOOLED].map(clean).find(Boolean);
  if (dbUrl) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`volentify-session-v1|${dbUrl}`));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return process.env.VERCEL_ENV ? '' : DEV_SECRET;
}

async function readSession(req: NextRequest): Promise<Claims | null> {
  const token = req.cookies.get('volentify_session')?.value;
  if (!token) return null;
  const secret = await signingKey();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return payload.typ === 'session' ? (payload as unknown as Claims) : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return NextResponse.next();

  const claims = await readSession(req);
  if (!claims) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  if (rule.prefix !== '/onboarding' && !claims.onboarded) {
    const url = new URL('/onboarding', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (rule.roles && (!rule.roles.includes(claims.role) || !claims.verified)) {
    const url = new URL('/dashboard', req.url);
    url.searchParams.set('denied', rule.prefix.slice(1));
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/agency/:path*', '/dashboard/:path*', '/onboarding/:path*'] };
