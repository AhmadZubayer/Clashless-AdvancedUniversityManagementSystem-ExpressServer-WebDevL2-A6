/**
 * @openapi
 * components:
 *   schemas:
 *     RoomInput:
 *       type: object
 *       properties:
 *         code: { type: string, minLength: 1 }
 *         building: { type: string, minLength: 1 }
 *         roomNo: { type: string, minLength: 1 }
 *         type: { type: string, enum: [CLASSROOM, LAB] }
 *         capacity: { type: integer, minimum: 1 }
 *         isActive: { type: boolean, default: true }
 * /api/admin/rooms:
 *   post:
 *     tags: [Room]
 *     summary: Create a room with unique code and positive capacity (admins only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RoomInput'
 *               - type: object
 *                 required: [code, building, roomNo, type, capacity]
 *     responses:
 *       201: { description: Room created }
 *       400: { description: Invalid room data }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       409: { description: Room code already exists }
 * /api/rooms:
 *   get:
 *     tags: [Room]
 *     summary: Paginated rooms for admins and faculty
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [CLASSROOM, LAB] } }
 *       - { in: query, name: building, schema: { type: string } }
 *       - { in: query, name: minCapacity, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, code, building, capacity], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Rooms with pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin or faculty role required }
 * /api/admin/rooms/{id}:
 *   patch:
 *     tags: [Room]
 *     summary: Update room; cannot deactivate one used by the current published routine
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoomInput'
 *     responses:
 *       200: { description: Room updated }
 *       400: { description: Invalid room data }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Room not found }
 *       409: { description: Duplicate code or published routine uses room }
 */
