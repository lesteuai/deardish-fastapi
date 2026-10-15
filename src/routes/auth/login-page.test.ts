import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import LoginPage from './login/+page.svelte';

describe('login page', () => {
	it('renders field errors and the form fields from the form prop', () => {
		const form = {
			errors: {
				form: 'Invalid email or password',
				email: 'Enter your email',
				password: 'Enter your password'
			},
			values: { email: 'typed@example.com' }
		};

		const { getByText, getByLabelText } = render(LoginPage, { props: { form } as never });

		expect(getByText('Invalid email or password')).toBeTruthy();
		expect(getByText('Enter your email')).toBeTruthy();
		expect(getByText('Enter your password')).toBeTruthy();

		const email = getByLabelText('Email') as HTMLInputElement;
		expect(email.value).toBe('typed@example.com');
		expect(getByLabelText('Password')).toBeTruthy();
	});

	it('renders an empty form with a link to register when there are no errors', () => {
		const { getByRole, queryByText } = render(LoginPage, { props: { form: undefined } as never });

		expect(getByRole('heading', { name: 'Sign in' })).toBeTruthy();
		expect(getByRole('button', { name: 'Sign in' })).toBeTruthy();

		const register = getByRole('link', { name: 'Create an account' });
		expect(register.getAttribute('href')).toBe('/auth/register');

		expect(queryByText('Invalid email or password')).toBeNull();
	});

	it('renders the sign in section inside a card container', () => {
		const { getByRole } = render(LoginPage, { props: { form: undefined } as never });

		const heading = getByRole('heading', { name: 'Sign in' });
		expect(heading.closest('.card')).not.toBeNull();
	});
});
