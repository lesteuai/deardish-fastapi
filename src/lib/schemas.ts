import { z } from 'zod';

const shortProfileText = z.string().trim().max(200).default('');

export const registerSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email()),
	password: z.string().min(8)
});

export const loginSchema = z.object({
	email: z.string().trim().toLowerCase().min(1),
	password: z.string().min(1)
});

export const profileSchema = z.object({
	conditions: shortProfileText,
	allergies: shortProfileText,
	dietaryPreferences: shortProfileText,
	notes: z.string().trim().max(2000).default('')
});

export const adaptRequestSchema = z.object({
	dishId: z.uuid()
});

export const mealSchema = z.object({
	title: z.string().trim().min(1).max(200),
	content: z.string().min(1)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type AdaptRequestInput = z.infer<typeof adaptRequestSchema>;
export type MealInput = z.infer<typeof mealSchema>;
