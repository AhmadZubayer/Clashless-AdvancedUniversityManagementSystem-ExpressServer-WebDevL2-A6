/**
 * @openapi
 * components:
 *   schemas:
 *     TimeSlotInput:
 *       type: object
 *       properties:
 *         type: { type: string, enum: [THEORY, LAB] }
 *         startMinute: { type: integer, minimum: 0, maximum: 1439 }
 *         endMinute: { type: integer, minimum: 1, maximum: 1439 }
 *         isActive: { type: boolean, default: true }
 * /api/admin/time-slots:
 *   post:
 *     tags: [TimeSlot]
 *     summary: Create weekly slot with a generated HH:MM label; start precedes end; no active same-type overlap
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/TimeSlotInput'
 *               - type: object
 *                 required: [type, startMinute, endMinute]
 *     responses:
 *       201: { description: Time slot created }
 *       400: { description: Invalid type or time range }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       409: { description: Duplicate start time or overlapping same-type slot }
 * /api/time-slots:
 *   get:
 *     tags: [TimeSlot]
 *     summary: Weekly time slots sorted by startMinute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [THEORY, LAB] } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [startMinute], default: startMinute } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: asc } }
 *     responses:
 *       200: { description: Weekly grid and pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 * /api/admin/time-slots/{id}:
 *   patch:
 *     tags: [TimeSlot]
 *     summary: Update slot; cannot change times used by the current published routine; same-type overlaps rejected
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TimeSlotInput'
 *     responses:
 *       200: { description: Time slot updated and label rebuilt }
 *       400: { description: Invalid time range }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Time slot not found }
 *       409: { description: Overlap, duplicate start time or published routine uses slot }
 */
