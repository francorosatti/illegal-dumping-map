import type { LayoutServerLoad } from './$types';
import { CITY } from '$lib/config/city';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	return {
		city: CITY,
		isAdmin: !!locals.adminId,
		turnstileSiteKey: platform?.env.TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA',
	};
};
