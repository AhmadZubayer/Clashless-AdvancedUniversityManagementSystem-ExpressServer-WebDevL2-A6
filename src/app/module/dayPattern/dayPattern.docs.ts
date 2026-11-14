/**
 * @openapi
 * /api/admin/day-patterns:
 *   post:
 *     tags: [DayPattern]
 *     summary: Create unique code; THEORY has two distinct days and LAB has one day
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, type, days]
 *             properties:
 *               code: { type: string, minLength: 1 }
 *               type: { type: string, enum: [THEORY, LAB] }
 *               days:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 2
 *                 uniqueItems: true
 *                 items: { type: string, enum: [SAT, SUN, MON, TUE, WED, THU, FRI] }
 *     responses:
 *       201: { description: Day pattern created }
 *       400: { description: Invalid number of days, duplicate days or unknown day }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       409: { description: Day pattern code already exists }
 * /api/day-patterns:
 *   get:
 *     tags: [DayPattern]
 *     summary: List weekly day patterns with optional type and code search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [THEORY, LAB] } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, code], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Day patterns with pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 */
