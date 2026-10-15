import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock = vi.hoisted(() => {
	const insertReturning = vi.fn();
	const insertValues = vi.fn(() => ({ returning: insertReturning }));
	const insert = vi.fn(() => ({ values: insertValues }));

	const orderBy = vi.fn();
	const where = vi.fn(() => ({ orderBy }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));

	const deleteReturning = vi.fn();
	const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
	const del = vi.fn(() => ({ where: deleteWhere }));

	return {
		db: { insert, select, delete: del },
		insert,
		insertValues,
		insertReturning,
		select,
		from,
		where,
		orderBy,
		del,
		deleteWhere,
		deleteReturning
	};
});

vi.mock('./db', () => ({ db: dbMock.db }));

import { saveMeal, listMeals, deleteMeal } from './meals';

const userId = '11111111-1111-4111-8111-111111111111';
const dishId = '33333333-3333-4333-8333-333333333333';
const mealId = '22222222-2222-4222-8222-222222222222';

function sqlParams(condition: unknown): unknown[] {
	const params: unknown[] = [];
	const walk = (node: unknown) => {
		if (!node || typeof node !== 'object') return;
		const chunks = (node as { queryChunks?: unknown[] }).queryChunks;
		if (chunks) {
			for (const chunk of chunks) walk(chunk);
			return;
		}
		if ('value' in node) {
			const value = (node as { value: unknown }).value;
			if (Array.isArray(value)) params.push(...value);
			else params.push(value);
		}
	};
	walk(condition);
	return params;
}

beforeEach(() => {
	vi.clearAllMocks();
	dbMock.insertReturning.mockResolvedValue([]);
	dbMock.deleteReturning.mockResolvedValue([]);
	dbMock.orderBy.mockResolvedValue([]);
});

describe('saveMeal', () => {
	it('inserts a valid meal and returns its id with a trimmed title and the given source dish id', async () => {
		dbMock.insertReturning.mockResolvedValueOnce([{ id: mealId }]);

		const result = await saveMeal(
			userId,
			{ title: '  Paneer Butter Masala  ', content: 'A creamy curry.' },
			dishId
		);

		expect(result).toEqual({ ok: true, id: mealId });
		expect(dbMock.insert).toHaveBeenCalledTimes(1);
		expect(dbMock.insertValues).toHaveBeenCalledTimes(1);
		expect(dbMock.insertValues).toHaveBeenCalledWith({
			userId,
			title: 'Paneer Butter Masala',
			content: 'A creamy curry.',
			sourceDishId: dishId
		});
	});

	it('defaults sourceDishId to null when none is given', async () => {
		dbMock.insertReturning.mockResolvedValueOnce([{ id: mealId }]);

		await saveMeal(userId, { title: 'Toast', content: 'Bread.' });

		expect(dbMock.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ sourceDishId: null })
		);
	});

	it('rejects an empty title without inserting', async () => {
		const result = await saveMeal(userId, { title: '', content: 'Some content.' });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.title).toBeTruthy();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it('rejects a whitespace-only title without inserting', async () => {
		const result = await saveMeal(userId, { title: '   ', content: 'Some content.' });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.title).toBeTruthy();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it('rejects a title over 200 characters without inserting', async () => {
		const result = await saveMeal(userId, { title: 'a'.repeat(201), content: 'Some content.' });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.title).toBeTruthy();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});

	it('rejects empty content without inserting', async () => {
		const result = await saveMeal(userId, { title: 'Valid title', content: '' });

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.content).toBeTruthy();
		expect(dbMock.insert).not.toHaveBeenCalled();
	});
});

describe('deleteMeal', () => {
	it('reports nothing deleted when the owner-scoped delete matches no rows', async () => {
		dbMock.deleteReturning.mockResolvedValueOnce([]);

		const result = await deleteMeal(userId, mealId);

		expect(result).toEqual({ ok: false });
		expect(dbMock.del).toHaveBeenCalledTimes(1);
		expect(dbMock.deleteWhere).toHaveBeenCalledTimes(1);
	});

	it('reports success when a matching row was deleted', async () => {
		dbMock.deleteReturning.mockResolvedValueOnce([{ id: mealId }]);

		const result = await deleteMeal(userId, mealId);

		expect(result).toEqual({ ok: true });
	});

	it('scopes the delete to the owner so another user\u2019s meal is untouched', async () => {
		dbMock.deleteReturning.mockResolvedValueOnce([]);

		await deleteMeal(userId, mealId);

		const params = sqlParams((dbMock.deleteWhere.mock.calls[0] as unknown[])[0]);
		expect(params).toContain(userId);
		expect(params).toContain(mealId);
	});

	it('rejects a non-uuid id without touching the database', async () => {
		const result = await deleteMeal(userId, 'not-a-uuid');

		expect(result).toEqual({ ok: false });
		expect(dbMock.del).not.toHaveBeenCalled();
	});
});

describe('listMeals', () => {
	it('queries the owner\u2019s meals newest first', async () => {
		const rows = [
			{ id: mealId, title: 'Paneer', content: 'Curry.', createdAt: new Date('2026-01-02') },
			{ id: dishId, title: 'Toast', content: 'Bread.', createdAt: new Date('2026-01-01') }
		];
		dbMock.orderBy.mockResolvedValueOnce(rows);

		const result = await listMeals(userId);

		expect(result).toEqual(rows);
		expect(dbMock.select).toHaveBeenCalledTimes(1);
		expect(dbMock.where).toHaveBeenCalledTimes(1);
		expect(dbMock.orderBy).toHaveBeenCalledTimes(1);

		const params = sqlParams((dbMock.where.mock.calls[0] as unknown[])[0]);
		expect(params).toContain(userId);
	});

	it('selects only the meal fields the page needs', async () => {
		await listMeals(userId);

		expect(dbMock.select).toHaveBeenCalledWith({
			id: expect.anything(),
			title: expect.anything(),
			content: expect.anything(),
			createdAt: expect.anything()
		});
	});
});
