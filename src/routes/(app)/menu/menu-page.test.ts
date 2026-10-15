import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

const dbMock = vi.hoisted(() => {
	const orderBy = vi.fn();
	const from = vi.fn(() => ({ orderBy }));
	const select = vi.fn(() => ({ from }));
	return { db: { select }, select, from, orderBy };
});

vi.mock('$lib/server/db', () => ({ db: dbMock.db }));

import MenuPage from './+page.svelte';
import { load } from './+page.server';

type Dish = { id: string; name: string; cuisine: string; description: string };

const dishes: Dish[] = [
	{
		id: '11111111-1111-1111-1111-111111111111',
		name: 'Paneer Butter Masala',
		cuisine: 'Indian',
		description: 'A creamy tomato curry with cubes of paneer.'
	},
	{
		id: '22222222-2222-2222-2222-222222222222',
		name: 'Miso Ramen',
		cuisine: 'Japanese',
		description: 'A savory noodle bowl with miso broth and a soft egg.'
	},
	{
		id: '33333333-3333-3333-3333-333333333333',
		name: 'Tacos al Pastor',
		cuisine: 'Mexican',
		description: 'Marinated pork tacos with pineapple and cilantro.'
	}
];

const runLoad = () => (load as unknown as () => Promise<{ dishes: Dish[] }>)();

beforeEach(() => {
	vi.clearAllMocks();
});

describe('menu list page', () => {
	it('renders each dish name, cuisine, and description', () => {
		const { getByText } = render(MenuPage, { props: { data: { dishes } } as never });

		for (const dish of dishes) {
			expect(getByText(dish.name)).toBeTruthy();
			expect(getByText(dish.cuisine)).toBeTruthy();
			expect(getByText(dish.description)).toBeTruthy();
		}
	});

	it('links each dish card to /menu/<id>', () => {
		const { getByRole } = render(MenuPage, { props: { data: { dishes } } as never });

		for (const dish of dishes) {
			const link = getByRole('link', { name: new RegExp(dish.name) });
			expect(link.getAttribute('href')).toBe(`/menu/${dish.id}`);
		}
	});

	it('renders each dish card with the dish-card class', () => {
		const { getByRole } = render(MenuPage, { props: { data: { dishes } } as never });

		for (const dish of dishes) {
			const card = getByRole('link', { name: new RegExp(dish.name) });
			expect(card.classList.contains('dish-card')).toBe(true);
		}
	});

	it('renders the heading and no dish cards when there are no dishes', () => {
		const { getByRole, queryAllByRole } = render(MenuPage, {
			props: { data: { dishes: [] } } as never
		});

		expect(getByRole('heading', { name: 'Menu' })).toBeTruthy();
		expect(queryAllByRole('link')).toHaveLength(0);
	});
});

describe('/menu load', () => {
	it('selects the dish projections ordered by name', async () => {
		dbMock.orderBy.mockResolvedValueOnce(dishes);

		const result = await runLoad();

		expect(result).toEqual({ dishes });
		expect(dbMock.select).toHaveBeenCalledTimes(1);
		const projected = (dbMock.select.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
		expect(Object.keys(projected).sort()).toEqual(['cuisine', 'description', 'id', 'name']);
		expect(dbMock.from).toHaveBeenCalledTimes(1);
		expect(dbMock.orderBy).toHaveBeenCalledTimes(1);
		expect(dbMock.orderBy.mock.calls[0][0]).toBeTruthy();
	});
});
