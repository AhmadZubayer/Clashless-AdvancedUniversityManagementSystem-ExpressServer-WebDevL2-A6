/**
 * @openapi
 * /api/grades/sections/{sectionId}:
 *   put:
 *     tags:
 *       - Grade
 *     summary: Submit or edit grades for a section
 *     description: Only the section's teacher, in EXAMS or GRADING, before the grade deadline and before results are published.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
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
 *             required: [grades]
 *             properties:
 *               grades:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [enrollmentId, grade]
 *                   properties:
 *                     enrollmentId:
 *                       type: string
 *                       format: uuid
 *                     grade:
 *                       type: string
 *                       enum: [A, A_MINUS, B_PLUS, B, B_MINUS, C_PLUS, C, C_MINUS, D_PLUS, D, F, W]
 *     responses:
 *       200:
 *         description: Number of grades saved
 *       400:
 *         description: An enrollment is not an ENROLLED row of this section
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not the section's teacher
 *       404:
 *         description: Section not found
 *       409:
 *         description: Wrong phase, deadline passed or grades already published
 *   get:
 *     tags:
 *       - Grade
 *     summary: A section's grade sheet
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Every ENROLLED student with their grade or null
 *       401:
 *         description: Not logged in
 *       403:
 *         description: A teacher who does not teach the section
 *       404:
 *         description: Section not found
 */

/**
 * @openapi
 * /api/admin/grades/status:
 *   get:
 *     tags:
 *       - Grade
 *     summary: Who has not submitted grades
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
 *         description: Per section submitted and missing counts
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Semester not found
 */

/**
 * @openapi
 * /api/admin/grades/publish:
 *   post:
 *     tags:
 *       - Grade
 *     summary: Publish results
 *     description: Phase GRADING; every ENROLLED enrollment needs a grade. Creates CourseResult rows and recomputes CGPA and earned credits.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [semesterId]
 *             properties:
 *               semesterId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Counts of results and students
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Semester not found
 *       409:
 *         description: Wrong phase, already published or sections missing grades (listed)
 */

/**
 * @openapi
 * /api/grades/me:
 *   get:
 *     tags:
 *       - Grade
 *     summary: My results
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CGPA, earned credits, GPA per semester and each course's grade
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not a student
 */
