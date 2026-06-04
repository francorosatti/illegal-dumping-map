type ExportRow = {
	id: string;
	created_at: string;
	lat: number;
	lng: number;
	description: string | null;
	status: string;
	description_approved: number;
	reviewed_at: string | null;
	photo_count: number;
};

function escapeField(value: string | number | null): string {
	if (value === null || value === undefined) return '';
	const str = String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function rowsToCsv(rows: ExportRow[]): string {
	const headers = [
		'id',
		'created_at',
		'lat',
		'lng',
		'description',
		'status',
		'description_approved',
		'photo_count',
		'reviewed_at',
	];
	const lines = [headers.join(',')];
	for (const r of rows) {
		lines.push(
			[
				r.id,
				r.created_at,
				r.lat,
				r.lng,
				r.description,
				r.status,
				r.description_approved,
				r.photo_count,
				r.reviewed_at,
			]
				.map(escapeField)
				.join(',')
		);
	}
	return lines.join('\n');
}
