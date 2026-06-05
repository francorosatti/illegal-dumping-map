import type { D1Database } from '@cloudflare/workers-types';

export type ReportStatus = 'reported' | 'confirmed' | 'cleaned';

export type Report = {
	id: string;
	lat: number;
	lng: number;
	description: string | null;
	description_approved: number;
	status: ReportStatus;
	hidden: number;
	reviewed_at: string | null;
	merged_into: string | null;
	created_at: string;
	updated_at: string;
};

export type Photo = {
	id: string;
	report_id: string;
	r2_key: string;
	is_public: number;
	width: number | null;
	height: number | null;
	bytes: number | null;
	created_at: string;
};

export type Admin = {
	id: string;
	email: string;
	password_hash: string;
	created_at: string;
};

export function getDb(platform: App.Platform): D1Database {
	return platform.env.DB;
}

export async function insertReport(
	db: D1Database,
	report: Omit<Report, 'updated_at'>
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO reports (id, lat, lng, description, description_approved, status, hidden, reviewed_at, merged_into, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			report.id,
			report.lat,
			report.lng,
			report.description,
			report.description_approved,
			report.status,
			report.hidden,
			report.reviewed_at,
			report.merged_into,
			report.created_at,
			report.created_at
		)
		.run();
}

export async function getReport(db: D1Database, id: string): Promise<Report | null> {
	return db.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first<Report>();
}

export async function getPublicPins(
	db: D1Database,
	minLat: number,
	minLng: number,
	maxLat: number,
	maxLng: number
): Promise<Pick<Report, 'id' | 'lat' | 'lng' | 'status' | 'created_at'>[]> {
	const result = await db
		.prepare(
			`SELECT id, lat, lng, status, created_at FROM reports
       WHERE hidden = 0 AND merged_into IS NULL AND status != 'cleaned'
         AND lat >= ? AND lat <= ? AND lng >= ? AND lng <= ?
       ORDER BY created_at DESC LIMIT 500`
		)
		.bind(minLat, maxLat, minLng, maxLng)
		.all<Pick<Report, 'id' | 'lat' | 'lng' | 'status' | 'created_at'>>();
	return result.results;
}

export async function getPublicReportDetail(
	db: D1Database,
	id: string
): Promise<Pick<Report, 'id' | 'lat' | 'lng' | 'status' | 'description' | 'description_approved' | 'created_at'> | null> {
	return db
		.prepare(
			'SELECT id, lat, lng, status, description, description_approved, created_at FROM reports WHERE id = ? AND hidden = 0'
		)
		.bind(id)
		.first();
}

export async function getPhotosByReport(db: D1Database, reportId: string): Promise<Photo[]> {
	const result = await db
		.prepare('SELECT * FROM photos WHERE report_id = ? ORDER BY created_at ASC')
		.bind(reportId)
		.all<Photo>();
	return result.results;
}

export async function countPhotosByReport(db: D1Database, reportId: string): Promise<number> {
	const row = await db
		.prepare('SELECT COUNT(*) as cnt FROM photos WHERE report_id = ?')
		.bind(reportId)
		.first<{ cnt: number }>();
	return row?.cnt ?? 0;
}

export async function insertPhoto(db: D1Database, photo: Photo): Promise<void> {
	await db
		.prepare(
			'INSERT INTO photos (id, report_id, r2_key, is_public, width, height, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(
			photo.id,
			photo.report_id,
			photo.r2_key,
			photo.is_public,
			photo.width,
			photo.height,
			photo.bytes,
			photo.created_at
		)
		.run();
}

export async function getPhoto(db: D1Database, id: string): Promise<Photo | null> {
	return db.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first<Photo>();
}

export async function setPhotoPublic(
	db: D1Database,
	id: string,
	isPublic: boolean
): Promise<void> {
	await db
		.prepare('UPDATE photos SET is_public = ? WHERE id = ?')
		.bind(isPublic ? 1 : 0, id)
		.run();
}

export async function deletePhoto(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM photos WHERE id = ?').bind(id).run();
}

export async function getAdminByEmail(db: D1Database, email: string): Promise<Admin | null> {
	return db.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first<Admin>();
}

export async function getAdminById(db: D1Database, id: string): Promise<Admin | null> {
	return db.prepare('SELECT * FROM admins WHERE id = ?').bind(id).first<Admin>();
}

// Admin moderation queries
export async function listReports(
	db: D1Database,
	opts: { unreviewed?: boolean; limit?: number; offset?: number }
): Promise<Report[]> {
	const limit = opts.limit ?? 50;
	const offset = opts.offset ?? 0;
	let query = 'SELECT * FROM reports WHERE merged_into IS NULL';
	if (opts.unreviewed) {
		query += ' AND reviewed_at IS NULL';
	}
	query += ' ORDER BY created_at ASC LIMIT ? OFFSET ?';
	const result = await db.prepare(query).bind(limit, offset).all<Report>();
	return result.results;
}

export async function updateReportStatus(
	db: D1Database,
	id: string,
	status: ReportStatus
): Promise<void> {
	await db
		.prepare(
			"UPDATE reports SET status = ?, reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
		)
		.bind(status, id)
		.run();
}

export async function approveDescription(db: D1Database, id: string, approved: boolean): Promise<void> {
	await db
		.prepare(
			"UPDATE reports SET description_approved = ?, reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
		)
		.bind(approved ? 1 : 0, id)
		.run();
}

export async function hideReport(db: D1Database, id: string): Promise<void> {
	await db
		.prepare(
			"UPDATE reports SET hidden = 1, reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
		)
		.bind(id)
		.run();
}

export async function mergeReports(
	db: D1Database,
	sourceId: string,
	targetId: string
): Promise<void> {
	await db
		.prepare('UPDATE photos SET report_id = ? WHERE report_id = ?')
		.bind(targetId, sourceId)
		.run();
	await db
		.prepare(
			"UPDATE reports SET merged_into = ?, hidden = 1, reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
		)
		.bind(targetId, sourceId)
		.run();
	// Touch target reviewed_at too
	await db
		.prepare(
			"UPDATE reports SET reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
		)
		.bind(targetId)
		.run();
}

// Cleanup: reports unreviewed older than 90 days that still have photos
export async function getUnreviewedOldReportIds(db: D1Database): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT DISTINCT r.id FROM reports r
       JOIN photos p ON p.report_id = r.id
       WHERE r.reviewed_at IS NULL
         AND r.created_at < datetime('now', '-90 days')`
		)
		.all<{ id: string }>();
	return result.results.map((r) => r.id);
}

export async function getPhotosByReports(db: D1Database, reportIds: string[]): Promise<Photo[]> {
	if (reportIds.length === 0) return [];
	const placeholders = reportIds.map(() => '?').join(',');
	const result = await db
		.prepare(`SELECT * FROM photos WHERE report_id IN (${placeholders})`)
		.bind(...reportIds)
		.all<Photo>();
	return result.results;
}

export async function deletePhotosByReports(db: D1Database, reportIds: string[]): Promise<void> {
	if (reportIds.length === 0) return;
	const placeholders = reportIds.map(() => '?').join(',');
	await db.prepare(`DELETE FROM photos WHERE report_id IN (${placeholders})`).bind(...reportIds).run();
}

export async function reviewReport(
	db: D1Database,
	id: string,
	approved: boolean,
	descriptionApproved: boolean,
	photoApprovals: Record<string, boolean>
): Promise<void> {
	if (approved) {
		await db
			.prepare(
				"UPDATE reports SET status = 'confirmed', description_approved = ?, reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
			)
			.bind(descriptionApproved ? 1 : 0, id)
			.run();
		const stmts = Object.entries(photoApprovals).map(([photoId, isPublic]) =>
			db.prepare('UPDATE photos SET is_public = ? WHERE id = ?').bind(isPublic ? 1 : 0, photoId)
		);
		if (stmts.length > 0) await db.batch(stmts);
	} else {
		await db
			.prepare(
				"UPDATE reports SET status = 'rejected', hidden = 1, reviewed_at = COALESCE(reviewed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
			)
			.bind(id)
			.run();
	}
}

export type CleaningReport = {
	id: string;
	report_id: string;
	r2_key: string;
	is_photo_public: number;
	reviewed_at: string | null;
	rejected: number;
	created_at: string;
};

export async function insertCleaningReport(
	db: D1Database,
	row: CleaningReport
): Promise<void> {
	await db
		.prepare(
			'INSERT INTO cleaning_reports (id, report_id, r2_key, is_photo_public, reviewed_at, rejected, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		)
		.bind(row.id, row.report_id, row.r2_key, row.is_photo_public, row.reviewed_at, row.rejected, row.created_at)
		.run();
}

export async function getPendingCleaningByReport(
	db: D1Database,
	reportId: string
): Promise<CleaningReport | null> {
	return db
		.prepare('SELECT * FROM cleaning_reports WHERE report_id = ? AND reviewed_at IS NULL LIMIT 1')
		.bind(reportId)
		.first<CleaningReport>();
}

export async function getCleaningReport(
	db: D1Database,
	id: string
): Promise<CleaningReport | null> {
	return db.prepare('SELECT * FROM cleaning_reports WHERE id = ?').bind(id).first<CleaningReport>();
}

export async function listPendingCleaningReports(
	db: D1Database
): Promise<(CleaningReport & { report: Report })[]> {
	const result = await db
		.prepare(
			`SELECT cr.*, r.id as r_id, r.lat, r.lng, r.description, r.description_approved,
              r.status, r.hidden, r.reviewed_at as r_reviewed_at, r.merged_into,
              r.created_at as r_created_at, r.updated_at
       FROM cleaning_reports cr
       JOIN reports r ON r.id = cr.report_id
       WHERE cr.reviewed_at IS NULL
       ORDER BY cr.created_at ASC
       LIMIT 50`
		)
		.all<
			CleaningReport & {
				r_id: string;
				lat: number;
				lng: number;
				description: string | null;
				description_approved: number;
				status: ReportStatus;
				hidden: number;
				r_reviewed_at: string | null;
				merged_into: string | null;
				r_created_at: string;
				updated_at: string;
			}
		>();
	return result.results.map((row) => ({
		id: row.id,
		report_id: row.report_id,
		r2_key: row.r2_key,
		is_photo_public: row.is_photo_public,
		reviewed_at: row.reviewed_at,
		rejected: row.rejected,
		created_at: row.created_at,
		report: {
			id: row.r_id,
			lat: row.lat,
			lng: row.lng,
			description: row.description,
			description_approved: row.description_approved,
			status: row.status,
			hidden: row.hidden,
			reviewed_at: row.r_reviewed_at,
			merged_into: row.merged_into,
			created_at: row.r_created_at,
			updated_at: row.updated_at,
		},
	}));
}

export async function reviewCleaningReport(
	db: D1Database,
	id: string,
	reportId: string,
	approved: boolean
): Promise<void> {
	const now = new Date().toISOString();
	if (approved) {
		await db.batch([
			db
				.prepare(
					"UPDATE cleaning_reports SET reviewed_at = ?, rejected = 0, is_photo_public = 1 WHERE id = ?"
				)
				.bind(now, id),
			db
				.prepare(
					"UPDATE reports SET status = 'cleaned', updated_at = ? WHERE id = ?"
				)
				.bind(now, reportId),
		]);
	} else {
		await db
			.prepare("UPDATE cleaning_reports SET reviewed_at = ?, rejected = 1 WHERE id = ?")
			.bind(now, id)
			.run();
	}
}

export async function exportAllReports(db: D1Database): Promise<
	(Pick<Report, 'id' | 'created_at' | 'lat' | 'lng' | 'description' | 'status' | 'description_approved' | 'reviewed_at'> & {
		photo_count: number;
	})[]
> {
	const result = await db
		.prepare(
			`SELECT r.id, r.created_at, r.lat, r.lng, r.description, r.status, r.description_approved, r.reviewed_at,
              COUNT(p.id) as photo_count
       FROM reports r
       LEFT JOIN photos p ON p.report_id = r.id
       WHERE r.hidden = 0
       GROUP BY r.id
       ORDER BY r.created_at DESC`
		)
		.all<
			Pick<
				Report,
				'id' | 'created_at' | 'lat' | 'lng' | 'description' | 'status' | 'description_approved' | 'reviewed_at'
			> & { photo_count: number }
		>();
	return result.results;
}
