export type AuthUser = { id: string; email: string };

export type HealthProfile = {
	conditions: string;
	allergies: string;
	dietaryPreferences: string;
	notes: string;
};

export type Dish = {
	name: string;
	cuisine: string;
	description: string;
	ingredients: string[];
	content?: string;
	id?: string;
	imageLocation?: string | null;
	lastUpdated?: string | Date;
	imageId?: string | null;
};

export type DishSummary = {
	id: string;
	name: string;
	cuisine: string;
	description: string;
	imageLocation: string | null;
};

export type Meal = {
	id: string;
	userId: string;
	title: string;
	content: string;
	sourceDishId: string | null;
	createdAt: string;
};
