/**
 * @openapi
 * /api/users/me:
 *   patch:
 *     tags: [User]
 *     summary: Update your profile contact information and optional photo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               data:
 *                 type: string
 *                 description: JSON with optional contactNumber and personalEmail
 *     responses:
 *       200:
 *         description: Profile updated, without password
 *       400:
 *         description: Invalid profile data
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Password change required
 */

/**
 * @openapi
 * /api/admin/users/admins:
 *   post:
 *     tags: [User]
 *     summary: Create an Admin or Super Admin; only Super Admin may create Super Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role, name, email, personalEmail]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *                 minLength: 1
 *               personalEmail:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [ADMIN, SUPER_ADMIN]
 *     responses:
 *       201:
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */

/**
 * @openapi
 * /api/admin/users/faculties:
 *   post:
 *     tags: [User]
 *     summary: Create faculty with temporary password emailed to personalEmail; department must exist
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, personalEmail, departmentId, designation]
 *             properties:
 *               maxCreditLoad:
 *                 type: number
 *                 default: 12
 *               name:
 *                 type: string
 *                 minLength: 1
 *               designation:
 *                 type: string
 *                 minLength: 1
 *               departmentId:
 *                 type: string
 *                 format: uuid
 *               personalEmail:
 *                 type: string
 *                 format: email
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */

/**
 * @openapi
 * /api/admin/users/students:
 *   post:
 *     tags: [User]
 *     summary: Create an unactivated student and send an activation invite; email and universityId must be unused
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, universityId, programId, batchId]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *               universityId:
 *                 type: string
 *                 minLength: 1
 *               personalEmail:
 *                 type: string
 *                 format: email
 *               programId:
 *                 type: string
 *                 format: uuid
 *               email:
 *                 type: string
 *                 format: email
 *               contactNumber:
 *                 type: string
 *                 minLength: 1
 *               batchId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */

/**
 * @openapi
 * /api/admin/users/import:
 *   post:
 *     tags: [User]
 *     summary: Import student or faculty CSV in chunks of 500; returns created and failed row/reason entries; queues account emails
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [student, faculty]
 *     responses:
 *       200:
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [User]
 *     summary: List non-deleted users with role profiles and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, name, email]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [SUPER_ADMIN, ADMIN, FACULTY, STUDENT]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, BLOCKED, DELETED]
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: programId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */

/**
 * @openapi
 * /api/admin/users/{id}:
 *   get:
 *     tags: [User]
 *     summary: Get user and role profile; student includes current semester registration
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
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */

/**
 * @openapi
 * /api/admin/users/{id}/status:
 *   patch:
 *     tags: [User]
 *     summary: Block or unblock a user; Admins may target faculty/students only; cannot target self; audited
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, BLOCKED]
 *     responses:
 *       200:
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */

/**
 * @openapi
 * /api/admin/users/{id}:
 *   delete:
 *     tags: [User]
 *     summary: Soft delete and revoke sessions; Admins may target faculty/students only; cannot target self; audited
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
 *         description: Success; user records never include password; list includes pagination meta
 *       400:
 *         description: Invalid body, query, params or CSV
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Role or self-management rule denied, or PASSWORD_CHANGE_REQUIRED
 *       404:
 *         description: User or referenced department/program/batch not found
 *       409:
 *         description: Duplicate account or concurrent account change
 */
