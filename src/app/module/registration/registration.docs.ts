/**
 * @openapi
 * /api/registrations/seats/stream:
 *   get:
 *     tags: [Registration]
 *     summary: Stream current-semester seat changes to students and admins
 *     description: Redis pub/sub events carry sectionId, enrolledCount and capacity. Comment heartbeats are sent every 25 seconds; subscriptions close on disconnect.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Server-Sent Events stream
 *         content:
 *           text/event-stream: { schema: { type: string } }
 *       401: { description: Authentication required }
 *       403: { description: Student or admin access required }
 *       404: { description: No current semester }
 */
/**
 * @openapi
 * /api/registrations/me:
 *   get:
 *     tags: [Registration]
 *     summary: Current semester, own batch window, bill and enrolled sections
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Window isOpen/opensAt/closesAt/serverTime, registration or null, minimum payment, max credits and enrolled sections }
 *       401: { description: Authentication required }
 *       403: { description: Student access required }
 *       404: { description: Student or current semester not found }
 */
/**
 * @openapi
 * /api/registrations/offerings:
 *   get:
 *     tags: [Registration]
 *     summary: Cached catalog with live seats and per-student selection flags
 *     description: Metadata is cached for 30 seconds. Capacity, enrollment counts and section status are read live; flags are computed for the current student.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, code, title], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated offerings; sections include seatsLeft, clash, hasCourse, prerequisiteMissing and full }
 *       400: { description: Invalid query }
 *       401: { description: Authentication required }
 *       403: { description: Student access required }
 *       404: { description: Student or current semester not found }
 */
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
