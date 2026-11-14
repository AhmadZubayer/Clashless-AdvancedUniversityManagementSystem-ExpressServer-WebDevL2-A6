/**
 * @openapi
 * /api/admin/seat-plans:
 *   post:
 *     tags:
 *       - Seat plan
 *     summary: Start a seat plan for an exam slot
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [examSlotId]
 *             properties:
 *               examSlotId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: The DRAFT seat plan
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Exam slot not found
 *       409:
 *         description: Exam routine not published, no courses in the slot, or a plan already exists
 *   get:
 *     tags:
 *       - Seat plan
 *     summary: Seat plans overview (each exam slot with its plan status)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: semesterId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Slots with NONE, DRAFT or PUBLISHED status
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Semester not found
 */

/**
 * @openapi
 * /api/admin/seat-plans/rooms/last-used:
 *   get:
 *     tags:
 *       - Seat plan
 *     summary: Rooms of the most recently generated seat plan
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rooms to pre-fill the form
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/rooms:
 *   put:
 *     tags:
 *       - Seat plan
 *     summary: Enter the rooms for the slot (replaces rooms and deletes the seats)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rooms]
 *             properties:
 *               rooms:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [roomNo, totalSeats, seatsPerColumn]
 *                   properties:
 *                     roomNo:
 *                       type: string
 *                     totalSeats:
 *                       type: integer
 *                     seatsPerColumn:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Odd and even seat counts per room, and total seats against students
 *       400:
 *         description: Invalid or duplicate rooms
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat plan not found
 *       409:
 *         description: Not a draft
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/generate:
 *   post:
 *     tags:
 *       - Seat plan
 *     summary: Generate the seat plan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderBy:
 *                 type: string
 *                 enum: [STUDENT_ID, NAME]
 *     responses:
 *       200:
 *         description: The report and the validation result
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat plan not found
 *       409:
 *         description: NOT_ENOUGH_SEATS, no rooms, or not a draft
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}:
 *   get:
 *     tags:
 *       - Seat plan
 *     summary: Seat plan summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Per room and column course and ID range, empty seats, unused rooms, unseated students and validation
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat plan not found
 */

/**
 * @openapi
 * /api/seat-plans/{id}/rooms/{roomId}:
 *   get:
 *     tags:
 *       - Seat plan
 *     summary: One room's seat grid
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Column by seat grid with student and course
 *       401:
 *         description: Not logged in
 *       403:
 *         description: A teacher who does not invigilate this room
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/swap:
 *   post:
 *     tags:
 *       - Seat plan
 *     summary: Swap two students' seats
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [seatAId, seatBId]
 *             properties:
 *               seatAId:
 *                 type: string
 *                 format: uuid
 *               seatBId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Swapped (audit-logged; students emailed if published)
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat not found
 *       409:
 *         description: HARD_RULE_VIOLATION, the same course would sit side by side
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/students:
 *   post:
 *     tags:
 *       - Seat plan
 *     summary: Seat a late student in the first valid empty seat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [studentId]
 *             properties:
 *               studentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: The new seat
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat plan not found
 *       409:
 *         description: Student not enrolled in this slot, already seated, or NOT_ENOUGH_SEATS
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/publish:
 *   post:
 *     tags:
 *       - Seat plan
 *     summary: Publish the seat plan and email every seated student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Published
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat plan not found
 *       409:
 *         description: Not a draft, not generated, unseated students or a violation
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/export:
 *   get:
 *     tags:
 *       - Seat plan
 *     summary: Print PDFs (door sheet, full grid or attendance sheet)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [door, full, attendance]
 *     responses:
 *       200:
 *         description: application/pdf
 *       400:
 *         description: Invalid type
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat plan not found
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/invigilators/auto-assign:
 *   post:
 *     tags:
 *       - Seat plan
 *     summary: Assign invigilators automatically
 *     description: For each room max(2, ceil(students / 40)) teachers with the fewest duties, none in two rooms of the same slot. Replaces existing assignments.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Assignments per room
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Seat plan not found
 *       409:
 *         description: Not generated yet or not enough teachers
 */

/**
 * @openapi
 * /api/admin/seat-plans/{id}/rooms/{roomId}/invigilators:
 *   put:
 *     tags:
 *       - Seat plan
 *     summary: Set a room's invigilators by hand
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [facultyIds]
 *             properties:
 *               facultyIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Saved
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Room or teacher not found
 *       409:
 *         description: A teacher is already in another room of this slot
 */

/**
 * @openapi
 * /api/seat-plans/me:
 *   get:
 *     tags:
 *       - Seat plan
 *     summary: My seats from published seat plans
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Room, column and seat per exam
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not a student
 */
