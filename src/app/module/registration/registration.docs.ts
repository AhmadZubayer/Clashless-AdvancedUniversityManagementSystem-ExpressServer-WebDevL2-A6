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
