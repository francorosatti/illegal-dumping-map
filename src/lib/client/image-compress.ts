import imageCompression from 'browser-image-compression';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 1;
const MAX_WIDTH_PX = 1600;

export function isAllowedType(file: File): boolean {
	return ALLOWED_TYPES.includes(file.type);
}

export async function compressAndStrip(file: File): Promise<File> {
	// browser-image-compression handles resize + EXIF strip
	const compressed = await imageCompression(file, {
		maxSizeMB: MAX_SIZE_MB,
		maxWidthOrHeight: MAX_WIDTH_PX,
		useWebWorker: true,
		// Forces canvas re-encode which strips EXIF
		fileType: 'image/webp',
	});
	return compressed;
}
