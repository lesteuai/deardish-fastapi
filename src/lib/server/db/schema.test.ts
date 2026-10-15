import { describe, it, expect } from 'vitest';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import * as schema from './schema';

function inlineForeignKey(table: PgTable, columnName: string) {
	const { foreignKeys } = getTableConfig(table);
	return foreignKeys.find((fk) =>
		fk.reference().columns.some((column) => column.name === columnName)
	);
}

function foreignTableName(table: PgTable) {
	return getTableConfig(table).name;
}

describe('drizzle schema shape', () => {
	describe('users', () => {
		it('uses a uuid primary key with a default', () => {
			const id = schema.users.id;
			expect(id.primary).toBe(true);
			expect(id.columnType).toBe('PgUUID');
			expect(id.hasDefault).toBe(true);
		});

		it('has a non-null unique email column', () => {
			const email = schema.users.email;
			expect(email.name).toBe('email');
			expect(email.notNull).toBe(true);
			expect(email.isUnique).toBe(true);
		});

		it('has a non-null password_hash column', () => {
			const passwordHash = schema.users.passwordHash;
			expect(passwordHash.name).toBe('password_hash');
			expect(passwordHash.columnType).toBe('PgText');
			expect(passwordHash.notNull).toBe(true);
		});
	});

	describe('sessions', () => {
		it('uses token_hash as the primary key', () => {
			const tokenHash = schema.sessions.tokenHash;
			expect(tokenHash.name).toBe('token_hash');
			expect(tokenHash.primary).toBe(true);
			expect(tokenHash.columnType).toBe('PgText');
		});

		it('has a non-null user_id foreign key that cascades on delete', () => {
			const userId = schema.sessions.userId;
			expect(userId.name).toBe('user_id');
			expect(userId.notNull).toBe(true);

			const fk = inlineForeignKey(schema.sessions, 'user_id');
			expect(fk).toBeDefined();
			expect(foreignTableName(fk!.reference().foreignTable)).toBe('users');
			expect(fk!.onDelete).toBe('cascade');
		});
	});

	describe('health_profiles', () => {
		it('uses user_id as the primary key cascading on delete', () => {
			const userId = schema.healthProfiles.userId;
			expect(userId.name).toBe('user_id');
			expect(userId.primary).toBe(true);

			const fk = inlineForeignKey(schema.healthProfiles, 'user_id');
			expect(fk).toBeDefined();
			expect(foreignTableName(fk!.reference().foreignTable)).toBe('users');
			expect(fk!.onDelete).toBe('cascade');
		});

		it('has the four nullable profile text columns', () => {
			expect(schema.healthProfiles.conditions.name).toBe('conditions');
			expect(schema.healthProfiles.allergies.name).toBe('allergies');
			expect(schema.healthProfiles.dietaryPreferences.name).toBe('dietary_preferences');
			expect(schema.healthProfiles.notes.name).toBe('notes');

			expect(schema.healthProfiles.conditions.notNull).toBe(false);
			expect(schema.healthProfiles.allergies.notNull).toBe(false);
			expect(schema.healthProfiles.dietaryPreferences.notNull).toBe(false);
			expect(schema.healthProfiles.notes.notNull).toBe(false);
		});

		it('has a non-null updated_at timestamp with a default', () => {
			const updatedAt = schema.healthProfiles.updatedAt;
			expect(updatedAt.name).toBe('updated_at');
			expect(updatedAt.notNull).toBe(true);
			expect(updatedAt.hasDefault).toBe(true);
		});
	});

	describe('dishes', () => {
		it('has non-null name, cuisine, and description text columns', () => {
			for (const key of ['name', 'cuisine', 'description'] as const) {
				const column = schema.dishes[key];
				expect(column.notNull).toBe(true);
				expect(column.columnType).toBe('PgText');
			}
			expect(schema.dishes.name.name).toBe('name');
			expect(schema.dishes.cuisine.name).toBe('cuisine');
			expect(schema.dishes.description.name).toBe('description');
		});

		it('has a non-null jsonb ingredients column', () => {
			const ingredients = schema.dishes.ingredients;
			expect(ingredients.name).toBe('ingredients');
			expect(ingredients.columnType).toBe('PgJsonb');
			expect(ingredients.notNull).toBe(true);
		});
	});

	describe('meals', () => {
		it('has a non-null user_id foreign key cascading on delete', () => {
			const userId = schema.meals.userId;
			expect(userId.name).toBe('user_id');
			expect(userId.notNull).toBe(true);

			const fk = inlineForeignKey(schema.meals, 'user_id');
			expect(fk).toBeDefined();
			expect(foreignTableName(fk!.reference().foreignTable)).toBe('users');
			expect(fk!.onDelete).toBe('cascade');
		});

		it('has a nullable source_dish_id foreign key set null on delete', () => {
			const sourceDishId = schema.meals.sourceDishId;
			expect(sourceDishId.name).toBe('source_dish_id');
			expect(sourceDishId.notNull).toBe(false);

			const fk = inlineForeignKey(schema.meals, 'source_dish_id');
			expect(fk).toBeDefined();
			expect(foreignTableName(fk!.reference().foreignTable)).toBe('dishes');
			expect(fk!.onDelete).toBe('set null');
		});

		it('has non-null title and content text columns', () => {
			expect(schema.meals.title.name).toBe('title');
			expect(schema.meals.title.notNull).toBe(true);
			expect(schema.meals.content.name).toBe('content');
			expect(schema.meals.content.notNull).toBe(true);
		});
	});
});
