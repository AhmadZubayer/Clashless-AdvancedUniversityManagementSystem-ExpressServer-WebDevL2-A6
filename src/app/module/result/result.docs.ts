/**
 * @openapi
 * /api/admin/results/import:
 *   post:
 *     tags: [Result]
 *     summary: Import historical results and atomically recompute best-attempt CGPA and earned credits; W is ignored
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV columns universityId, courseCode, grade; grades A, A_MINUS, B_PLUS, B, B_MINUS, C_PLUS, C, C_MINUS, D_PLUS, D, F or W
 *     responses:
 *       200:
 *         description: Created count and failed row/reason entries; good rows have semesterId null
 *       400: { description: Missing or malformed CSV }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       409: { description: Concurrent result change; retry the import }
 */
