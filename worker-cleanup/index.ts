import type { D1Database, R2Bucket, ScheduledController } from '@cloudflare/workers-types';

interface Env {
	DB: D1Database;
	BUCKET: R2Bucket;
}

interface Photo {
	id: string;
	r2_key: string;
}

async function getUnreviewedOldReportIds(db: D1Database): Promise<string[]> {
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

async function getPhotosByReports(db: D1Database, reportIds: string[]): Promise<Photo[]> {
	if (reportIds.length === 0) return [];
	const placeholders = reportIds.map(() => '?').join(',');
	const result = await db
		.prepare(`SELECT id, r2_key FROM photos WHERE report_id IN (${placeholders})`)
		.bind(...reportIds)
		.all<Photo>();
	return result.results;
}

async function deletePhotoRows(db: D1Database, reportIds: string[]): Promise<void> {
	if (reportIds.length === 0) return;
	const placeholders = reportIds.map(() => '?').join(',');
	await db
		.prepare(`DELETE FROM photos WHERE report_id IN (${placeholders})`)
		.bind(...reportIds)
		.run();
}

export default {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async scheduled(_controller: ScheduledController, env: Env, _ctx: unknown): Promise<void> {
		console.log('[cleanup] Starting 90-day purge');

		const reportIds = await getUnreviewedOldReportIds(env.DB);
		if (reportIds.length === 0) {
			console.log('[cleanup] No reports to purge');
			return;
		}

		console.log(`[cleanup] Found ${reportIds.length} old unreviewed reports with photos`);

		const photos = await getPhotosByReports(env.DB, reportIds);
		console.log(`[cleanup] Deleting ${photos.length} R2 objects`);

		await Promise.all(photos.map((p) => env.BUCKET.delete(p.r2_key)));
		await deletePhotoRows(env.DB, reportIds);

		console.log('[cleanup] Done');
	},
};
