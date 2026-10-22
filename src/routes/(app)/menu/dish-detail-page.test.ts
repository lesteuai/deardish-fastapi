import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

const dbMock = vi.hoisted(() => {
	const limit = vi.fn();
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	return { db: { select }, select, from, where, limit };
});

vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

import DishDetailPage from './[id]/+page.svelte';
import { load } from './[id]/+page.server';

type Dish = {
	id: string;
	name: string;
	cuisine: string;
	description: string;
	content: string;
	ingredients: string[];
};

const dish: Dish = {
	id: '11111111-1111-4111-8111-111111111111',
	name: 'Paneer Butter Masala',
	cuisine: 'Indian',
	description: 'A creamy tomato curry with cubes of paneer.',
	content: '## Paneer Butter Masala Recipe\n\nCook the paneer in tomato sauce.',
	ingredients: ['paneer', 'tomatoes', 'cream', 'butter', 'garam masala']
};

type LoadError = { status?: number; body?: { message?: string } };

const runLoad = (id: string) =>
	(load as unknown as (event: { params: { id: string } }) => Promise<{ dish: Dish }>)({
		params: { id }
	});

async function catchLoad(id: string): Promise<LoadError | undefined> {
	try {
		await runLoad(id);
		return undefined;
	} catch (error) {
		return error as LoadError;
	}
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('dish detail page', () => {
	it('renders the dish name, cuisine, and description', () => {
		const { getByRole, getByText } = render(DishDetailPage, {
			props: { data: { dish } } as never
		});

		expect(getByRole('heading', { name: dish.name })).toBeTruthy();
		expect(getByText(dish.cuisine)).toBeTruthy();
		expect(getByText(dish.description)).toBeTruthy();
	});

	it('renders every ingredient', () => {
		const { getByText } = render(DishDetailPage, { props: { data: { dish } } as never });

		for (const ingredient of dish.ingredients) {
			expect(getByText(ingredient)).toBeTruthy();
		}
	});

	it('renders the original recipe beneath the dish description', () => {
		const { getByRole, getByText } = render(DishDetailPage, {
			props: { data: { dish } } as never
		});

		expect(getByRole('heading', { name: 'Original recipe' })).toBeTruthy();
		expect(getByText('Cook the paneer in tomato sauce.')).toBeTruthy();
	});

	it('renders the ingredients as a list carrying the ingredients class', () => {
		const { getByText } = render(DishDetailPage, { props: { data: { dish } } as never });

		const list = getByText(dish.ingredients[0]).parentElement;
		expect(list?.tagName).toBe('UL');
		expect(list?.classList.contains('ingredients')).toBe(true);
	});

	it('offers an "Adapt this dish" link to /adapt/<id>', () => {
		const { getByRole } = render(DishDetailPage, { props: { data: { dish } } as never });

		const link = getByRole('link', { name: 'Adapt this dish' });
		expect(link.getAttribute('href')).toBe(`/adapt/${dish.id}`);
	});
});

describe('/menu/[id] load', () => {
	it('rejects a non-uuid id with a 400 error before querying', async () => {
		const thrown = await catchLoad('not-a-uuid');

		expect(thrown?.status).toBe(400);
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it('throws a 404 "Dish not found" for an unknown id', async () => {
		dbMock.limit.mockResolvedValueOnce([]);

		const thrown = await catchLoad('44444444-4444-4444-8444-444444444444');

		expect(thrown?.body?.message).toBe('Dish not found');
		expect(thrown?.status).toBe(404);
	});

	it('returns the dish when found', async () => {
		dbMock.limit.mockResolvedValueOnce([dish]);

		const result = await runLoad(dish.id);

		expect(result).toEqual({ dish });
		expect(dbMock.select).toHaveBeenCalledTimes(1);
	});
});
