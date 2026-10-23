import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

describe('landing page', () => {
	it('renders the DearDish mission text', () => {
		const { getByText } = render(Page);

		expect(
			getByText(
				'DearDish makes restaurant-style meals accessible to people facing health challenges.'
			)
		).toBeTruthy();
	});

	it('renders the DearDish brand heading', () => {
		const { getByRole } = render(Page);

		expect(getByRole('heading', { name: 'DearDish' })).toBeTruthy();
	});

	it('renders the DearDish brand image', () => {
		const { getByRole } = render(Page);

		const logo = getByRole('img', { name: 'DearDish logo' });
		expect(logo.getAttribute('src')).toBe('/deardish.jpg');
	});

	it('keeps the sign-in link and omits the removed register link', () => {
		const { getByRole, queryByRole } = render(Page);

		expect(queryByRole('link', { name: 'Register' })).toBeNull();
		expect(getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth/login');
	});
});
