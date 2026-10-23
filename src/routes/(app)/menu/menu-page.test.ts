import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

const backendMock = vi.hoisted(() => ({
	backendJson: vi.fn(),
	throwBackendError: vi.fn((error: unknown): never => {
		throw error;
	})
}));

vi.mock('$lib/server/backend', () => backendMock);

import MenuPage from './+page.svelte';
import { load } from './+page.server';

type Dish = { id: string; name: string; cuisine: string; description: string; image: string | null };

const dishes: Dish[] = [
	{
		id: '11111111-1111-1111-1111-111111111111',
		name: 'Paneer Butter Masala',
		cuisine: 'Indian',
		description: 'A creamy tomato curry with cubes of paneer.',
		image: '/assets/paneer.jpg'
	},
	{
		id: '22222222-2222-2222-2222-222222222222',
		name: 'Miso Ramen',
		cuisine: 'Japanese',
		description: 'A savory noodle bowl with miso broth and a soft egg.',
		image: 'https://images.example.com/ramen.jpg'
	},
	{
		id: '33333333-3333-3333-3333-333333333333',
		name: 'Tacos al Pastor',
		cuisine: 'Mexican',
		description: 'Marinated pork tacos with pineapple and cilantro.',
		image: null
	}
];

const user = { id: 'user-1', email: 'chef@example.com' };

const makeEvent = (authenticated = true) => ({
	locals: { user: authenticated ? user : null }
});

const runLoad = (authenticated = true) =>
	(load as unknown as (event: ReturnType<typeof makeEvent>) => Promise<{ dishes: Dish[] }>)(
		makeEvent(authenticated)
	);

async function catchLoad(authenticated = true): Promise<unknown> {
	try {
		await runLoad(authenticated);
		return undefined;
	} catch (error) {
		return error;
	}
}

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

	it('renders each dish image from its image location', () => {
		const { getAllByRole } = render(MenuPage, { props: { data: { dishes } } as never });

		expect(getAllByRole('img').map((image) => image.getAttribute('src'))).toEqual([
			'/assets/paneer.jpg',
			'https://images.example.com/ramen.jpg',
			''
		]);
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
	it('loads name-ordered dish data, including images, through the authenticated backend bridge', async () => {
		backendMock.backendJson.mockResolvedValueOnce({ dishes });

		const result = await runLoad();

		expect(result).toEqual({ dishes });
		expect(backendMock.backendJson).toHaveBeenCalledWith(makeEvent(), '/api/dishes');
		expect(result.dishes.map(({ name }) => name)).toEqual([
			'Paneer Butter Masala',
			'Miso Ramen',
			'Tacos al Pastor'
		]);
		expect(result.dishes[0].image).toBe('/assets/paneer.jpg');
		expect(result.dishes[2].image).toBeNull();
	});

	it('redirects anonymous requests to sign in before calling the backend', async () => {
		const thrown = await catchLoad(false);

		expect(thrown).toMatchObject({ status: 303, location: '/auth/login' });
		expect(backendMock.backendJson).not.toHaveBeenCalled();
	});

	it('translates backend service errors through the bridge error handler', async () => {
		const failure = { status: 502, message: 'DearDish services are temporarily unavailable.' };
		backendMock.backendJson.mockRejectedValueOnce(failure);

		await expect(runLoad()).rejects.toBe(failure);
		expect(backendMock.throwBackendError).toHaveBeenCalledWith(failure);
	});
});
