/**
 * @openapi
 * /api/admin/routines:
 *   get:
 *     tags: [Routine]
 *     summary: List semester versions with status, score and unplaced counts
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: semesterId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, version], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated versions and current unplaced counts }
 *       400: { description: Invalid query }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Semester not found }
 */
/**
 * @openapi
 * /api/admin/routines/{id}:
 *   get:
 *     tags: [Routine]
 *     summary: View version entries with course, teacher, room, days and times
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: view, schema: { type: string, enum: [section, faculty, room, program], default: section } }
 *       - { in: query, name: facultyId, schema: { type: string, format: uuid } }
 *       - { in: query, name: roomId, schema: { type: string, format: uuid } }
 *       - { in: query, name: programId, schema: { type: string, format: uuid } }
 *       - { in: query, name: term, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       200: { description: Filtered version; faculty/room views require their ID and program view requires programId plus term }
 *       400: { description: Invalid or missing view filter }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Routine not found }
 */
/**
 * @openapi
 * /api/admin/routines/{id}/report:
 *   get:
 *     tags: [Routine]
 *     summary: Recompute soft scores, unplaced reasons and all hard-rule violations
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Score, per-rule breakdown, unplaced sections and validation result }
 *       400: { description: Invalid routine ID }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Routine not found }
 */
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
