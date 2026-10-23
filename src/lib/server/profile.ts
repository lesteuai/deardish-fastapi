import { eq } from 'drizzle-orm';
import { db } from './db';
import { healthProfiles } from './db/schema';
import { profileSchema, zodFieldErrors } from '$lib/schemas';
import type { HealthProfile } from '$lib/types';

export type { HealthProfile } from '$lib/types';

export type SaveProfileResult =
	| { ok: true; profile: HealthProfile }
	| { ok: false; errors: Record<string, string> };

function toProfile(row: typeof healthProfiles.$inferSelect): HealthProfile {
	return {
		conditions: row.conditions ?? '',
		allergies: row.allergies ?? '',
		dietaryPreferences: row.dietaryPreferences ?? '',
		notes: row.notes ?? ''
	};
}

export async function getProfile(userId: string): Promise<HealthProfile> {
	const [row] = await db
		.select()
		.from(healthProfiles)
		.where(eq(healthProfiles.userId, userId))
		.limit(1);
	if (!row) {
		return { conditions: '', allergies: '', dietaryPreferences: '', notes: '' };
	}
	return toProfile(row);
}

export async function saveProfile(userId: string, input: unknown): Promise<SaveProfileResult> {
	const parsed = profileSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, errors: zodFieldErrors(parsed.error.issues) };
	}

	const values = parsed.data;
	const now = new Date();
	const [row] = await db
		.insert(healthProfiles)
		.values({ userId, ...values, updatedAt: now })
		.onConflictDoUpdate({
			target: healthProfiles.userId,
			set: { ...values, updatedAt: now }
		})
		.returning();

	return { ok: true, profile: toProfile(row) };
}
