import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { db } from './db';
import { sessions, users } from './db/schema';

export type AuthUser = { id: string; email: string };

export const SESSION_COOKIE = 'deardish_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const expected = Buffer.from(hash, 'hex');
	const actual = scryptSync(password, salt, KEY_LENGTH);
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(expected, actual);
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export type RegisterResult = { user: AuthUser } | { conflict: true };

export async function registerUser(email: string, password: string): Promise<RegisterResult> {
	const passwordHash = hashPassword(password);
	try {
		const [user] = await db
			.insert(users)
			.values({ email, passwordHash })
			.returning({ id: users.id, email: users.email });
		return { user };
	} catch (error) {
		if (isUniqueViolation(error)) return { conflict: true };
		throw error;
	}
}

export async function authenticate(email: string, password: string): Promise<AuthUser | null> {
	const [user] = await db
		.select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	if (!user) return null;
	if (!verifyPassword(password, user.passwordHash)) return null;
	return { id: user.id, email: user.email };
}

export async function createSession(userId: string): Promise<string> {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
	await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
	return token;
}

export async function validateSession(token: string): Promise<AuthUser | null> {
	const [user] = await db
		.select({ id: users.id, email: users.email })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
		.limit(1);
	return user ?? null;
}

export async function destroySession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: SESSION_MAX_AGE
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === '23505'
	);
}
