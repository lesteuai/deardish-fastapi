import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));

import MealsPage from './+page.svelte';

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
});
