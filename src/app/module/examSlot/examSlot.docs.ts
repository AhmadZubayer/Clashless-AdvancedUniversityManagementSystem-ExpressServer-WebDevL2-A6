/**
 * @openapi
 * /api/admin/exam-slots:
 *   post:
 *     tags:
 *       - Exam slot
 *     summary: Create exam slots
 *     description: Dates must be inside the semester's exam period; slots on one date may not overlap.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [semesterId, slots]
 *             properties:
 *               semesterId:
 *                 type: string
 *                 format: uuid
 *               slots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [date, startMinute, endMinute]
 *                   properties:
 *                     date:
 *                       type: string
 *                       example: "2026-12-20"
 *                     startMinute:
 *                       type: integer
 *                       example: 540
 *                     endMinute:
 *                       type: integer
 *                       example: 660
 *     responses:
 *       201:
 *         description: The created slots
 *       400:
 *         description: Invalid input or a date outside the exam period
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Semester not found
 *       409:
 *         description: Overlapping slots or the exam period is not set
 */

/**
 * @openapi
 * /api/exam-slots:
 *   get:
 *     tags:
 *       - Exam slot
 *     summary: List exam slots of a semester
 *     description: Once the exam routine is published each slot lists its courses and student count.
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
 *         description: Exam slots in date and time order
 *       400:
 *         description: semesterId missing or invalid
 *       401:
 *         description: Not logged in
 */

/**
 * @openapi
 * /api/admin/exam-slots/{id}:
 *   delete:
 *     tags:
 *       - Exam slot
 *     summary: Remove an exam slot
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
 *         description: The slot was removed
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Exam slot not found
 *       409:
 *         description: Used by the published exam routine or a seat plan
 */
