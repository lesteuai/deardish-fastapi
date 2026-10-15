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

	it('links to the register and sign in pages', () => {
		const { getByRole } = render(Page);

		const register = getByRole('link', { name: 'Register' });
		expect(register.getAttribute('href')).toBe('/auth/register');

		const signIn = getByRole('link', { name: 'Sign in' });
		expect(signIn.getAttribute('href')).toBe('/auth/login');
	});
});
