import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';

const navigationMock = vi.hoisted(() => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$app/navigation', () => navigationMock);

const backendMock = vi.hoisted(() => ({
	backendJson: vi.fn(),
	throwBackendError: vi.fn((error: unknown): never => {
		throw error;
	})
}));
vi.mock('$lib/server/backend', () => backendMock);

import MealsPage from './+page.svelte';
import MealDetailPage from './[id]/+page.svelte';
import { load as loadMeals } from './+page.server';
import { load as loadMeal } from './[id]/+page.server';
import { invalidateAll } from '$app/navigation';

const meals = [
	{
		id: '22222222-2222-2222-2222-222222222222',
		title: 'Paneer Butter Masala',
		content: 'A creamy tomato curry adapted to be lower in salt.',
		createdAt: new Date('2026-01-02T10:00:00Z')
	},
	{
		id: '33333333-3333-3333-3333-333333333333',
		title: 'Grilled Salmon Bowl',
		content: 'Salmon with quinoa and steamed greens.',
		createdAt: new Date('2026-01-03T10:00:00Z')
	}
];

const user = { id: 'user-1', email: 'chef@example.com' };
const meal = {
	id: meals[0].id,
	title: meals[0].title,
	content: meals[0].content,
	createdAt: '2026-01-02T10:00:00Z'
};

const makeEvent = (id?: string, authenticated = true) => ({
	locals: { user: authenticated ? user : null },
	params: id === undefined ? {} : { id }
});

const runMealsLoad = (authenticated = true) =>
	(loadMeals as unknown as (event: ReturnType<typeof makeEvent>) => Promise<{ meals: typeof meals }>)(
		makeEvent(undefined, authenticated)
	);

const runMealLoad = (id: string, authenticated = true) =>
	(loadMeal as unknown as (event: ReturnType<typeof makeEvent>) => Promise<{ meal: typeof meal }>)(
		makeEvent(id, authenticated)
	);

async function catchLoad(loadRequest: () => Promise<unknown>): Promise<unknown> {
	try {
		await loadRequest();
		return undefined;
	} catch (error) {
		return error;
	}
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('meals page', () => {
	it('lists every meal title passed as a prop', () => {
		const { getByRole, getByText } = render(MealsPage, { props: { data: { meals } } as never });

		expect(getByRole('heading', { name: 'Paneer Butter Masala' })).toBeTruthy();
		expect(getByRole('heading', { name: 'Grilled Salmon Bowl' })).toBeTruthy();
		expect(getByText('A creamy tomato curry adapted to be lower in salt.')).toBeTruthy();
		expect(getByText('Salmon with quinoa and steamed greens.')).toBeTruthy();
	});

	it('renders a delete control for each meal', () => {
		const { getAllByRole } = render(MealsPage, { props: { data: { meals } } as never });

		expect(getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
	});

	it('renders the empty state with a link to the menu when there are no meals', () => {
		const { getByText, getByRole, queryByRole } = render(MealsPage, {
			props: { data: { meals: [] } } as never
		});

		expect(getByText('You have not saved any meals yet.')).toBeTruthy();

		const link = getByRole('link', { name: 'Browse the menu' });
		expect(link.getAttribute('href')).toBe('/menu');
		expect(queryByRole('button', { name: 'Delete' })).toBeNull();
	});

	it('renders each saved date inside a date-pill element', () => {
		const { container } = render(MealsPage, { props: { data: { meals } } as never });

		const pills = container.querySelectorAll('.date-pill');
		expect(pills).toHaveLength(meals.length);
		for (const pill of pills) {
			expect(pill.textContent).toContain('Saved');
		}
	});

	it('renders the empty state inside a card empty container', () => {
		const { container } = render(MealsPage, { props: { data: { meals: [] } } as never });

		const empty = container.querySelector('.card.empty');
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain('You have not saved any meals yet.');
	});

	it('renders the saved meal title and full recipe content', () => {
		const { getByRole, getByText } = render(MealDetailPage, { props: { data: { meal } } as never });

		expect(getByRole('heading', { name: meal.title })).toBeTruthy();
		expect(getByText('A creamy tomato curry adapted to be lower in salt.')).toBeTruthy();
	});

	it('deletes a meal after a 204 response and refreshes the list', async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);
		const { getAllByRole } = render(MealsPage, { props: { data: { meals } } as never });

		getAllByRole('button', { name: 'Delete' })[0].click();

		await waitFor(() => expect(invalidateAll).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith(`/api/meals/${meals[0].id}`, { method: 'DELETE' });
	});

	it('shows a delete failure when the backend reports a missing or unowned meal', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Meal not found' }, { status: 404 })));
		const { getAllByRole, findByText } = render(MealsPage, { props: { data: { meals } } as never });

		getAllByRole('button', { name: 'Delete' })[0].click();

		expect(await findByText('Could not delete this meal. Please try again.')).toBeTruthy();
	});
});

describe('meal page loaders', () => {
	it('loads the signed-in user meal list through the backend bridge', async () => {
		backendMock.backendJson.mockResolvedValueOnce({ meals });

		const result = await runMealsLoad();

		expect(result).toEqual({ meals });
		expect(backendMock.backendJson).toHaveBeenCalledWith(makeEvent(), '/api/meals');
	});

	it('redirects anonymous list and detail visits before backend requests', async () => {
		const listError = await catchLoad(() => runMealsLoad(false));
		const detailError = await catchLoad(() => runMealLoad(meal.id, false));

		expect(listError).toMatchObject({ status: 303, location: '/auth/login' });
		expect(detailError).toMatchObject({ status: 303, location: '/auth/login' });
		expect(backendMock.backendJson).not.toHaveBeenCalled();
	});

	it('returns the meal content on successful detail lookup', async () => {
		backendMock.backendJson.mockResolvedValueOnce({ meal });

		const result = await runMealLoad(meal.id);

		expect(result).toEqual({ meal });
		expect(backendMock.backendJson).toHaveBeenCalledWith(makeEvent(meal.id), `/api/meals/${meal.id}`);
	});

	it('translates an owner-scoped backend 404 for another user meal', async () => {
		const failure = { status: 404, message: 'Meal not found' };
		backendMock.backendJson.mockRejectedValueOnce(failure);

		const thrown = await catchLoad(() => runMealLoad(meal.id));

		expect(thrown).toBe(failure);
		expect(backendMock.throwBackendError).toHaveBeenCalledWith(failure);
	});

	it('passes through backend authentication failures for protected meal reads', async () => {
		const failure = { status: 401, message: 'Sign in required' };
		backendMock.backendJson.mockRejectedValueOnce(failure);

		const thrown = await catchLoad(() => runMealsLoad());

		expect(thrown).toBe(failure);
		expect(backendMock.throwBackendError).toHaveBeenCalledWith(failure);
	});
});
