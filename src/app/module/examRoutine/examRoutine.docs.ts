/**
 * @openapi
 * /api/admin/exam-routines/generate:
 *   post:
 *     tags:
 *       - Exam routine
 *     summary: Generate the exam routine (background job)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [semesterId, maxStudentsPerSlot]
 *             properties:
 *               semesterId:
 *                 type: string
 *                 format: uuid
 *               maxStudentsPerSlot:
 *                 type: integer
 *                 description: Exam seats available per slot
 *     responses:
 *       202:
 *         description: Returns the jobId; poll GET /api/admin/jobs/{id}
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Semester not found
 *       409:
 *         description: PHASE_NOT_ALLOWED (needs CLASSES) or no exam slots
 */

/**
 * @openapi
 * /api/admin/exam-routines:
 *   get:
 *     tags:
 *       - Exam routine
 *     summary: List exam routine versions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: semesterId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated versions
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Semester not found
 */

/**
 * @openapi
 * /api/admin/exam-routines/{id}:
 *   get:
 *     tags:
 *       - Exam routine
 *     summary: View a version grouped by slot, with its report
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
 *         description: The version with slots, student counts and report
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Not found
 */

/**
 * @openapi
 * /api/admin/exam-routines/{id}/entries/{entryId}:
 *   patch:
 *     tags:
 *       - Exam routine
 *     summary: Move the exam of one course to another slot (DRAFT only)
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
 *         name: entryId
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
 *             required: [examSlotId]
 *             properties:
 *               examSlotId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: The updated version
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Version, entry or slot not found
 *       409:
 *         description: Not a draft, students clash (listed) or the slot is over its seat limit
 */

/**
 * @openapi
 * /api/admin/exam-routines/{id}/publish:
 *   post:
 *     tags:
 *       - Exam routine
 *     summary: Publish a draft exam routine
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
 *         description: Published; offerings receive their examSlotId and students are emailed
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Not found
 *       409:
 *         description: Not a draft, wrong phase, or a hard rule is broken
 */

/**
 * @openapi
 * /api/exam-routines/me:
 *   get:
 *     tags:
 *       - Exam routine
 *     summary: My exams
 *     description: Students get exams with date, time and, once published, room, column and seat. Teachers get exams of their courses and invigilation duties.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My exams
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not a student or teacher
 *       404:
 *         description: No current semester or profile
 */
