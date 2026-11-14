/**
 * @openapi
 * /api/admin/routines/generate:
 *   post:
 *     tags: [Routine]
 *     summary: Queue deterministic class-routine generation during PLANNING
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [semesterId]
 *             properties:
 *               semesterId: { type: string, format: uuid }
 *               keepPinnedFrom: { type: string, format: uuid }
 *     responses:
 *       202: { description: Queued; data.jobId can be polled at /api/admin/jobs/{id} }
 *       400: { description: Invalid IDs }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Semester or pinned source not found }
 *       409: { description: PHASE_NOT_ALLOWED, missing teachers listed in errorDetails.sections, or invalid pinned entries }
 */
