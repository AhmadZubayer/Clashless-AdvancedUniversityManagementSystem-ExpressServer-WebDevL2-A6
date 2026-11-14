/**
 * @openapi
 * /api/registrations/sections/{sectionId}:
 *   delete:
 *     tags: [Registration]
 *     summary: Unselect inside the batch window; retain any overpaid credit
 *     description: Student mutations share a limit of 10 requests per 10 seconds.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sectionId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Dropped enrollment and recalculated registration }
 *       400: { description: Invalid section ID }
 *       401: { description: Authentication required }
 *       403: { description: Student access, WINDOW_NOT_OPEN, WINDOW_CLOSED or REGISTRATION_DISCARDED }
 *       404: { description: Registration or enrolled section not found }
 *       409: { description: PHASE_NOT_ALLOWED or concurrent state conflict }
 *       429: { description: RATE_LIMITED }
 */
/**
 * @openapi
 * /api/registrations/switch:
 *   post:
 *     tags: [Registration]
 *     summary: Switch between sections of the same offering without losing the source seat on failure
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromSectionId, toSectionId]
 *             properties:
 *               fromSectionId: { type: string, format: uuid }
 *               toSectionId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Dropped source, enrolled target and unchanged registration }
 *       400: { description: Invalid IDs or identical source and target }
 *       401: { description: Authentication required }
 *       403: { description: Student access, WINDOW_NOT_OPEN, WINDOW_CLOSED or REGISTRATION_DISCARDED }
 *       404: { description: Source enrollment or same-offering scheduled target not found }
 *       409: { description: PHASE_NOT_ALLOWED, SECTION_CLOSED, TIME_CLASH or SECTION_FULL with rollback }
 *       429: { description: RATE_LIMITED }
 */
/**
 * @openapi
 * /api/registrations/sections/{sectionId}:
 *   post:
 *     tags: [Registration]
 *     summary: Select a scheduled section inside the student's batch window
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sectionId, required: true, schema: { type: string, format: uuid } }
 *       - { in: header, name: Idempotency-Key, schema: { type: string } }
 *     responses:
 *       201: { description: Enrollment and recalculated registration }
 *       200: { description: Already enrolled in the same section }
 *       400: { description: Invalid section ID }
 *       401: { description: Authentication required }
 *       403: { description: Student access, WINDOW_NOT_OPEN, WINDOW_CLOSED or REGISTRATION_DISCARDED }
 *       404: { description: Student, current semester or scheduled section not found }
 *       409: { description: PHASE_NOT_ALLOWED, SECTION_CLOSED, ALREADY_HAS_COURSE, TIME_CLASH, CREDIT_LIMIT, PREREQUISITE_MISSING or SECTION_FULL with alternatives }
 *       429: { description: RATE_LIMITED }
 */
