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
	image: string | null;
};

export type DishDetail = DishSummary & {
	content: string;
	lastUpdated: string;
	ingredients: string[];
	imageId: string | null;
};

export type Meal = {
	id: string;
	title: string;
	content: string;
	createdAt: string;
};
