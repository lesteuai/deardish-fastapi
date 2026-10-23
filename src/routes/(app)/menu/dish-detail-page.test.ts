import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';

const backendMock = vi.hoisted(() => ({
	backendJson: vi.fn(),
	throwBackendError: vi.fn((error: unknown): never => {
		throw error;
	})
}));

vi.mock('$lib/server/backend', () => backendMock);

import DishDetailPage from './[id]/+page.svelte';
import { load } from './[id]/+page.server';

type Dish = {
	id: string;
	name: string;
	cuisine: string;
	description: string;
	content: string;
	ingredients: string[];
	image: string | null;
	imageId: string | null;
	lastUpdated: string;
};

const dish: Dish = {
	id: '11111111-1111-4111-8111-111111111111',
	name: 'Paneer Butter Masala',
	cuisine: 'Indian',
	description: 'A creamy tomato curry with cubes of paneer.',
	content: '## Paneer Butter Masala Recipe\n\nCook the paneer in tomato sauce.',
	ingredients: ['paneer', 'tomatoes', 'cream', 'butter', 'garam masala'],
	image: '/assets/paneer.jpg',
	imageId: '22222222-2222-4222-8222-222222222222',
	lastUpdated: '2026-10-23T10:00:00Z'
};

const user = { id: 'user-1', email: 'chef@example.com' };

const makeEvent = (id: string, authenticated = true) => ({
	locals: { user: authenticated ? user : null },
	params: { id }
});

const runLoad = (id: string, authenticated = true) =>
	(load as unknown as (event: ReturnType<typeof makeEvent>) => Promise<{ dish: Dish }>)(
		makeEvent(id, authenticated)
	);

async function catchLoad(id: string, authenticated = true): Promise<unknown> {
	try {
		await runLoad(id, authenticated);
		return undefined;
	} catch (error) {
		return error;
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
	it('passes malformed identifiers to the backend and preserves its 400 response', async () => {
		const failure = { status: 400, message: 'Invalid dish identifier' };
		backendMock.backendJson.mockRejectedValueOnce(failure);

		const thrown = await catchLoad('not-a-uuid');

		expect(thrown).toBe(failure);
		expect(backendMock.backendJson).toHaveBeenCalledWith(
			makeEvent('not-a-uuid'),
			'/api/dishes/not-a-uuid'
		);
		expect(backendMock.throwBackendError).toHaveBeenCalledWith(failure);
	});

	it('preserves the backend 404 response for an unknown dish', async () => {
		const failure = { status: 404, message: 'Dish not found' };
		backendMock.backendJson.mockRejectedValueOnce(failure);

		const thrown = await catchLoad('44444444-4444-4444-8444-444444444444');

		expect(thrown).toBe(failure);
		expect(backendMock.throwBackendError).toHaveBeenCalledWith(failure);
	});

	it('returns dish details including original content and image', async () => {
		backendMock.backendJson.mockResolvedValueOnce({ dish });

		const result = await runLoad(dish.id);

		expect(result).toEqual({ dish });
		expect(backendMock.backendJson).toHaveBeenCalledWith(makeEvent(dish.id), `/api/dishes/${dish.id}`);
		expect(result.dish.content).toContain('Cook the paneer in tomato sauce.');
		expect(result.dish.image).toBe('/assets/paneer.jpg');
	});

	it('redirects anonymous requests before calling the backend', async () => {
		const thrown = await catchLoad(dish.id, false);

		expect(thrown).toMatchObject({ status: 303, location: '/auth/login' });
		expect(backendMock.backendJson).not.toHaveBeenCalled();
	});

	it('preserves a missing image as null while returning original recipe content', async () => {
		const dishWithoutImage = { ...dish, image: null, imageId: null };
		backendMock.backendJson.mockResolvedValueOnce({ dish: dishWithoutImage });

		const result = await runLoad(dish.id);

		expect(result.dish.image).toBeNull();
		expect(result.dish.content).toBe(dish.content);
	});
});
