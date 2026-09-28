import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () => {
	const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
	return json(
		{
			app: 'absensi-guru',
			api_base_url: apiBaseUrl
		},
		{ headers: { 'Cache-Control': 'no-cache' } }
	);
};
