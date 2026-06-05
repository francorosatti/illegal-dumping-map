export const es = {
	// App general
	appName: 'Mapa de Microbasurales',
	appDescription: 'Reportá basura ilegal en tu ciudad',

	// Report form (/)
	reportTitle: 'Reportar basura ilegal',
	reportSubtitle: 'Tu reporte es anónimo y aparecerá en el mapa de inmediato.',
	locationLabel: 'Ubicación',
	locationHelp: 'Usá tu ubicación o marcá en el mapa.',
	locationUseGps: 'Usar mi ubicación',
	locationPickMap: 'Elegir en el mapa',
	locationOutsideArea: (city: string) =>
		`La ubicación está fuera del área de ${city}. Elegí un punto dentro de la ciudad.`,
	locationGpsError: 'No se pudo obtener tu ubicación. Elegí el punto en el mapa.',
	locationRequired: 'Seleccioná una ubicación antes de enviar.',

	photosLabel: 'Fotos (mín. 1, máx. 5)',
	photosHelp: 'Las fotos son privadas hasta que un moderador las apruebe.',
	photosRequired: 'Agregá al menos una foto antes de enviar.',
	photosAdd: 'Agregar fotos',
	photosMaxReached: 'Máximo 5 fotos por reporte.',
	photosInvalidType: 'Solo se aceptan imágenes (JPEG, PNG, WebP).',
	photosCompressing: 'Comprimiendo...',

	descriptionLabel: 'Descripción (opcional)',
	descriptionPlaceholder: 'Describí el problema: tipo de basura, cantidad, etc.',
	descriptionHelp: 'La descripción es privada hasta que un moderador la apruebe.',

	turnstileLabel: 'Verificación anti-spam',
	submitButton: 'Enviar reporte',
	submitting: 'Enviando...',

	// Errors
	errorGeneric: 'Ocurrió un error. Intentá de nuevo.',
	errorOutsideArea: (city: string) =>
		`El punto está fuera del área de ${city}. Elegí una ubicación dentro de la ciudad.`,
	errorRateLimit: 'Demasiados reportes en poco tiempo. Esperá unos minutos.',
	errorTurnstile: 'Verificación anti-spam fallida. Recargá la página e intentá de nuevo.',
	errorMaxPhotos: 'No se pueden subir más de 5 fotos por reporte.',
	errorPhotoSize: 'La foto es demasiado grande.',
	errorPhotoType: 'Tipo de archivo no permitido.',

	// Confirmation page
	confirmTitle: '¡Reporte enviado!',
	confirmSubtitle:
		'Tu reporte ya aparece en el mapa. Las fotos y la descripción se mostrarán luego de la revisión.',
	confirmVisibleFor: 'Podés ver tus fotos durante las próximas 24 horas.',
	confirmViewMap: 'Ver el mapa',
	confirmNewReport: 'Nuevo reporte',

	// Map (/mapa)
	mapTitle: 'Mapa de microbasurales',
	mapLoading: 'Cargando mapa...',
	mapNoPins: 'No hay reportes en esta área.',
	mapReportButton: 'Reportar un basural',
	mapZoomIn: 'Acercar',
	mapZoomOut: 'Alejar',

	// Pin popup
	pinStatus: {
		reported: 'Reportado',
		confirmed: 'Confirmado',
		cleaned: 'Limpiado',
	},
	pinDate: (date: string) => `Reportado el ${date}`,
	pinPhotoCount: (n: number) => (n === 1 ? '1 foto' : `${n} fotos`),
	pinDescriptionHidden: 'Descripción pendiente de revisión.',
	pinPhotosHidden: 'Fotos pendientes de revisión.',

	// Admin
	adminTitle: 'Panel de moderación',
	adminLogin: 'Iniciar sesión',
	adminLogout: 'Cerrar sesión',
	adminEmail: 'Correo electrónico',
	adminPassword: 'Contraseña',
	adminLoginButton: 'Entrar',
	adminLoginError: 'Credenciales incorrectas.',
	adminQueue: 'Cola de revisión',
	adminAllReports: 'Todos los reportes',
	adminNoReports: 'No hay reportes pendientes.',
	adminExportCsv: 'Exportar CSV',

	// Admin actions
	adminApprove: 'Aprobar',
	adminReject: 'Rechazar',
	adminApproveDesc: 'Aprobar descripción',
	adminRejectDesc: 'Rechazar descripción',
	adminPhotoApproved: 'Aprobada',
	adminPhotoRejected: 'Rechazada',
	adminActionDone: 'Acción realizada.',
	adminAllDone: '¡Todo al día! No hay reportes pendientes.',
	adminPending: (n: number) => (n === 1 ? '1 pendiente' : `${n} pendientes`),

	// Cleaning report (map popup modal)
	cleaningButton: 'Reportar que fue limpiado',
	cleaningModalTitle: 'Reportar limpieza',
	cleaningModalSubtitle: 'Tu reporte es anónimo y será revisado por un moderador.',
	cleaningPhotoLabel: 'Foto del lugar limpio',
	cleaningPhotoRequired: 'La foto es obligatoria.',
	cleaningSubmitButton: 'Enviar',
	cleaningSuccess: '¡Gracias! Tu reporte fue enviado y será revisado.',
	cleaningAlreadyPending: 'Ya hay un reporte de limpieza pendiente para este basural.',
	errorCleaningNotAllowed: 'No se puede reportar limpieza para este reporte.',

	// Admin cleaning queue
	adminCleaningsTitle: 'Limpiezas reportadas',
	adminCleaningsLink: 'Revisar limpiezas',
	adminCleaningsAllDone: '¡Todo al día! No hay limpiezas pendientes.',
	adminCleaningOriginalReport: 'Reporte original',
	adminCleaningPhoto: 'Foto de limpieza',
	adminCleaningApprove: 'Confirmar limpieza',
	adminCleaningReject: 'Rechazar',

	// Status labels
	statusReported: 'Reportado',
	statusConfirmed: 'Confirmado',
	statusCleaned: 'Limpiado',

	// Dates
	dateFormat: (iso: string) => {
		const d = new Date(iso);
		return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
	},
} as const;

export type Es = typeof es;
