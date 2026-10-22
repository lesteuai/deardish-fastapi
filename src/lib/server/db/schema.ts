import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const images = pgTable('images', {
	id: uuid('id').primaryKey().defaultRandom(),
	location: text('location').notNull().unique(),
	type: text('type').notNull()
});

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
	tokenHash: text('token_hash').primaryKey(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

export const healthProfiles = pgTable('health_profiles', {
	userId: uuid('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	conditions: text('conditions'),
	allergies: text('allergies'),
	dietaryPreferences: text('dietary_preferences'),
	notes: text('notes'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const dishes = pgTable('dishes', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	cuisine: text('cuisine').notNull(),
	description: text('description').notNull(),
	content: text('content').notNull().default(''),
	lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
	ingredients: jsonb('ingredients').$type<string[]>().notNull(),
	imageId: uuid('image_id').references(() => images.id, { onDelete: 'set null' })
});

export const meals = pgTable('meals', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	content: text('content').notNull(),
	sourceDishId: uuid('source_dish_id').references(() => dishes.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
