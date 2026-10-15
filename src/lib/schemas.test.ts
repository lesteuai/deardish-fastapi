import { describe, it, expect } from 'vitest';
import {
	adaptRequestSchema,
	loginSchema,
	mealSchema,
	profileSchema,
	registerSchema
} from './schemas';

const validUuid = '123e4567-e89b-12d3-a456-426614174000';

describe('registerSchema', () => {
	it('accepts a valid email and trims then lowercases it', () => {
		const result = registerSchema.safeParse({
			email: '  User@Example.COM ',
			password: 'supersecret'
		});

		expect(result.success).toBe(true);
		expect(result.data?.email).toBe('user@example.com');
	});

	it('rejects an invalid email', () => {
		expect(registerSchema.safeParse({ email: 'not-an-email', password: 'supersecret' }).success).toBe(
			false
		);
	});

	it('rejects a password shorter than 8 characters', () => {
		expect(registerSchema.safeParse({ email: 'user@example.com', password: 'short' }).success).toBe(
			false
		);
	});

	it('accepts a password of exactly 8 characters', () => {
		const result = registerSchema.safeParse({ email: 'user@example.com', password: '12345678' });

		expect(result.success).toBe(true);
		expect(result.data?.password).toBe('12345678');
	});
});

describe('loginSchema', () => {
	it('requires a non-empty email and password', () => {
		expect(loginSchema.safeParse({ email: '', password: 'secret' }).success).toBe(false);
		expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
	});

	it('rejects whitespace-only credentials', () => {
		expect(loginSchema.safeParse({ email: '   ', password: 'secret' }).success).toBe(false);
	});

	it('accepts non-empty credentials and lowercases the email', () => {
		const result = loginSchema.safeParse({ email: ' User@Example.com ', password: 'x' });

		expect(result.success).toBe(true);
		expect(result.data?.email).toBe('user@example.com');
	});
});

describe('profileSchema', () => {
	it('defaults missing fields to empty strings', () => {
		const result = profileSchema.safeParse({});

		expect(result.success).toBe(true);
		expect(result.data).toEqual({
			conditions: '',
			allergies: '',
			dietaryPreferences: '',
			notes: ''
		});
	});

	it('trims string values', () => {
		const result = profileSchema.safeParse({
			conditions: '  diabetes  ',
			allergies: '  peanuts ',
			dietaryPreferences: ' vegetarian ',
			notes: '  keep it mild  '
		});

		expect(result.success).toBe(true);
		expect(result.data).toEqual({
			conditions: 'diabetes',
			allergies: 'peanuts',
			dietaryPreferences: 'vegetarian',
			notes: 'keep it mild'
		});
	});

	const shortFields = ['conditions', 'allergies', 'dietaryPreferences'] as const;

	it.each(shortFields)('accepts exactly 200 characters for %s', (field) => {
		const result = profileSchema.safeParse({ [field]: 'a'.repeat(200) });

		expect(result.success).toBe(true);
	});

	it.each(shortFields)('rejects 201 characters for %s', (field) => {
		const result = profileSchema.safeParse({ [field]: 'a'.repeat(201) });

		expect(result.success).toBe(false);
	});

	it('accepts exactly 2000 characters for notes', () => {
		const result = profileSchema.safeParse({ notes: 'a'.repeat(2000) });

		expect(result.success).toBe(true);
	});

	it('rejects 2001 characters for notes', () => {
		const result = profileSchema.safeParse({ notes: 'a'.repeat(2001) });

		expect(result.success).toBe(false);
	});
});

describe('adaptRequestSchema', () => {
	it('accepts a valid uuid dishId', () => {
		const result = adaptRequestSchema.safeParse({ dishId: validUuid });

		expect(result.success).toBe(true);
		expect(result.data?.dishId).toBe(validUuid);
	});

	it('rejects a non-uuid dishId', () => {
		expect(adaptRequestSchema.safeParse({ dishId: 'not-a-uuid' }).success).toBe(false);
	});

	it('rejects a missing dishId', () => {
		expect(adaptRequestSchema.safeParse({}).success).toBe(false);
	});
});

describe('mealSchema', () => {
	it('accepts a non-empty title and content', () => {
		const result = mealSchema.safeParse({ title: 'Adapted Curry', content: 'Full recipe text.' });

		expect(result.success).toBe(true);
	});

	it('trims the title', () => {
		const result = mealSchema.safeParse({ title: '  Adapted Curry  ', content: 'text' });

		expect(result.success).toBe(true);
		expect(result.data?.title).toBe('Adapted Curry');
	});

	it('accepts a title of exactly 200 characters', () => {
		const result = mealSchema.safeParse({ title: 'a'.repeat(200), content: 'text' });

		expect(result.success).toBe(true);
	});

	it('rejects a title of 201 characters', () => {
		const result = mealSchema.safeParse({ title: 'a'.repeat(201), content: 'text' });

		expect(result.success).toBe(false);
	});

	it('rejects an empty or whitespace-only title', () => {
		expect(mealSchema.safeParse({ title: '', content: 'text' }).success).toBe(false);
		expect(mealSchema.safeParse({ title: '   ', content: 'text' }).success).toBe(false);
	});

	it('rejects an empty content', () => {
		expect(mealSchema.safeParse({ title: 'Adapted Curry', content: '' }).success).toBe(false);
	});
});
