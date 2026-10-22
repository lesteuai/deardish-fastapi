import { describe, it, expect, vi } from 'vitest';

const dbSpies = vi.hoisted(() => ({
	deleteMock: vi.fn(),
	insertMock: vi.fn()
}));

vi.mock('../../../../src/lib/server/db', () => ({
	db: { delete: dbSpies.deleteMock, insert: dbSpies.insertMock }
}));

vi.mock('../../../../src/lib/server/db/schema', () => ({
	dishes: { name: { name: 'name' } }
}));

import { seedDishes } from '../../../../scripts/ts/seed';

describe('seed dish fixtures', () => {
	it('exports exactly 6 dishes', () => {
		expect(seedDishes).toHaveLength(6);
	});

	it('importing the seed script does not run the seed routine', () => {
		expect(dbSpies.deleteMock).not.toHaveBeenCalled();
		expect(dbSpies.insertMock).not.toHaveBeenCalled();
	});

	it.each(seedDishes.map((dish, index) => [dish.name, index] as const))(
		'dish %s has a non-empty name, cuisine, and description',
		(_label, index) => {
			const dish = seedDishes[index];
			expect(typeof dish.name).toBe('string');
			expect(dish.name.trim().length).toBeGreaterThan(0);
			expect(typeof dish.cuisine).toBe('string');
			expect(dish.cuisine.trim().length).toBeGreaterThan(0);
			expect(typeof dish.description).toBe('string');
			expect(dish.description.trim().length).toBeGreaterThan(0);
		}
	);

	it.each(seedDishes.map((dish) => dish.name))(
		'dish %s lists 6 to 10 non-empty ingredient strings',
		(name) => {
			const dish = seedDishes.find((candidate) => candidate.name === name)!;
			expect(Array.isArray(dish.ingredients)).toBe(true);
			expect(dish.ingredients.length).toBeGreaterThanOrEqual(6);
			expect(dish.ingredients.length).toBeLessThanOrEqual(10);
			for (const ingredient of dish.ingredients) {
				expect(typeof ingredient).toBe('string');
				expect(ingredient.trim().length).toBeGreaterThan(0);
			}
		}
	);

	it('uses varied cuisines with at least 4 distinct values', () => {
		const distinctCuisines = new Set(seedDishes.map((dish) => dish.cuisine.trim()));
		expect(distinctCuisines.size).toBeGreaterThanOrEqual(4);
	});
});
