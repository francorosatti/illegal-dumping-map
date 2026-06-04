import type { PageServerLoad } from './$types';
import { CITY } from '$lib/config/city';

export const load: PageServerLoad = async () => {
	return { city: CITY };
};
