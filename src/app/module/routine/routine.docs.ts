/**
 * @openapi
 * /api/admin/routines/{id}/entries/{entryId}:
 *   patch:
 *     tags: [Routine]
 *     summary: Move a draft entry and recompute its version's score
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: entryId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               roomId: { type: string, format: uuid }
 *               dayPatternId: { type: string, format: uuid }
 *               timeSlotId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Updated entry, new score and violations }
 *       400: { description: Invalid or empty input }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Routine or entry not found }
 *       409: { description: Not DRAFT or HARD_RULE_VIOLATION naming conflicts }
 */
/**
 * @openapi
 * /api/admin/routines/{id}/entries/swap:
 *   post:
 *     tags: [Routine]
 *     summary: Atomically swap two draft entries' rooms, patterns and times
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entryAId, entryBId]
 *             properties:
 *               entryAId: { type: string, format: uuid }
 *               entryBId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Both updated entries, score and violations }
 *       400: { description: Invalid IDs or same entry chosen twice }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Routine or entries not found }
 *       409: { description: Not DRAFT or HARD_RULE_VIOLATION; no partial changes }
 */
/**
 * @openapi
 * /api/admin/routines/{id}/entries/{entryId}/pin:
 *   patch:
 *     tags: [Routine]
 *     summary: Toggle a draft entry's pin for subsequent generation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: entryId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Entry with toggled isPinned }
 *       400: { description: Invalid ID }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Routine or entry not found }
 *       409: { description: Only DRAFT routines may be edited }
 */
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
