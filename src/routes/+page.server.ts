import type { PageServerLoad } from './$types';
import { CITY } from '$lib/config/city';

export const load: PageServerLoad = async ({ platform }) => {
	return {
		city: CITY,
		turnstileSiteKey: platform?.env.TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA',
	};
};
