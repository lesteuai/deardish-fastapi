import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { meals } from './db/schema';
import { mealSchema, zodFieldErrors } from '$lib/schemas';

export type Meal = {
	id: string;
	title: string;
	content: string;
	createdAt: Date;
};

export type SaveMealResult =
	| { ok: true; id: string }
	| { ok: false; errors: Record<string, string> };

export async function saveMeal(
	userId: string,
	input: unknown,
	sourceDishId?: string | null
): Promise<SaveMealResult> {
	const parsed = mealSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, errors: zodFieldErrors(parsed.error.issues) };
	}

	const [row] = await db
		.insert(meals)
		.values({
			userId,
			title: parsed.data.title,
			content: parsed.data.content,
			sourceDishId: sourceDishId ?? null
		})
		.returning({ id: meals.id });

	return { ok: true, id: row.id };
}

export async function listMeals(userId: string): Promise<Meal[]> {
	return db
		.select({
			id: meals.id,
			title: meals.title,
			content: meals.content,
			createdAt: meals.createdAt
		})
		.from(meals)
		.where(eq(meals.userId, userId))
		.orderBy(desc(meals.createdAt));
}

export async function getMeal(userId: string, id: string): Promise<Meal | null> {
	if (!z.uuid().safeParse(id).success) {
		return null;
	}

	const [row] = await db
		.select({
			id: meals.id,
			title: meals.title,
			content: meals.content,
			createdAt: meals.createdAt
		})
		.from(meals)
		.where(and(eq(meals.userId, userId), eq(meals.id, id)))
		.limit(1);

	return row ?? null;
}

export async function deleteMeal(userId: string, id: string): Promise<{ ok: boolean }> {
	if (!z.uuid().safeParse(id).success) {
		return { ok: false };
	}

	const deleted = await db
		.delete(meals)
		.where(and(eq(meals.userId, userId), eq(meals.id, id)))
		.returning({ id: meals.id });

	return { ok: deleted.length > 0 };
}
