/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Email/password login; inactive students must activate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh cookies; rejects revoked versions and inactive accounts
 *     security:
 *       - refreshCookie: []
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke every session and clear cookies
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: User without password plus role profile, student program, batch, CGPA and earned credits
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/activate/request-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send a 10-minute activation OTP to an eligible student; generic response, 3 sends per 15 minutes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/activate/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Activate an existing student; five wrong tries invalidate the OTP; issues cookies
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 pattern: '^[0-9]{6}$'
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Requires lowercase, uppercase, digit and special character
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Verify Google identity and link an existing university-domain student; never creates users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Send a 5-minute password reset OTP; generic response, same send limit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Consume OTP and replace password; revoke every existing session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 pattern: '^[0-9]{6}$'
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Requires lowercase, uppercase, digit and special character
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */

/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Check current password, clear first-login restriction, revoke old sessions and issue fresh cookies
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 minLength: 1
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Requires lowercase, uppercase, digit and special character
 *     responses:
 *       200:
 *         description: Success. Login returns accessToken, refreshToken and needPasswordChange; activation also returns the safe user.
 *         headers:
 *           Set-Cookie:
 *             description: Token flows set httpOnly accessToken and refreshToken cookies; logout clears them.
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or INVALID_OTP
 *       401:
 *         description: Invalid credentials, missing token, or revoked session
 *       403:
 *         description: Inactive account, ACCOUNT_NOT_ACTIVATED, PASSWORD_CHANGE_REQUIRED or disallowed Google identity
 *       429:
 *         description: RATE_LIMITED (OTP sends)
 */
