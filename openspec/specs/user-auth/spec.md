# user-auth

## Purpose

Defines account registration and login (email/password and Google OAuth), JWT issuance/verification, logout, and the current-user endpoint — additive only, so guest play never requires an account.

## Requirements

### Requirement: Email/Password Registration
The system SHALL allow a client to register a new account with a unique username, a unique email, and a password, and SHALL store only a bcrypt hash of the password, never the plaintext password.

#### Scenario: Successful registration
- **WHEN** a client submits registration with a username and email not already in use, and a password
- **THEN** the server creates a new user record with a bcrypt-hashed password, and returns a JWT access token and the created user's public profile (id, username, email)

#### Scenario: Duplicate username is rejected
- **WHEN** a client submits registration with a username that already belongs to an existing user
- **THEN** the server rejects the registration and returns an error indicating the username is already taken

#### Scenario: Duplicate email is rejected
- **WHEN** a client submits registration with an email that already belongs to an existing user
- **THEN** the server rejects the registration and returns an error indicating the email is already registered

### Requirement: Email/Password Login
The system SHALL allow a client with an existing email/password account to authenticate by submitting that email and password, verified against the stored bcrypt hash.

#### Scenario: Successful login
- **WHEN** a client submits an email and password matching an existing account's stored password hash
- **THEN** the server returns a JWT access token and the user's public profile

#### Scenario: Wrong password is rejected
- **WHEN** a client submits an email that matches an existing account but a password that does not match the stored hash
- **THEN** the server rejects the login and returns an error that does not reveal whether the email or the password was the incorrect part

#### Scenario: Login attempted on a Google-only account
- **WHEN** a client submits email/password login for an account that has no password hash set (a Google-only account)
- **THEN** the server rejects the login and returns an error indicating that account must sign in with Google

### Requirement: Google OAuth Login
The system SHALL allow a client to authenticate via Google OAuth, signing in the matching existing account (keyed by the Google account id) on a returning sign-in, or requiring a chosen username to complete account creation on a first-time sign-in.

#### Scenario: Returning Google sign-in reuses the existing account
- **WHEN** a client completes the Google OAuth flow with a Google account id that matches an existing user record
- **THEN** the server issues a JWT access token for that existing user without creating a duplicate account

#### Scenario: Google sign-in is attempted without Google OAuth configured
- **WHEN** a client requests the Google sign-in route while the server's Google OAuth credentials are still unset placeholder values
- **THEN** the server responds with a clear error indicating Google sign-in is not configured, instead of attempting or crashing during an OAuth redirect

### Requirement: Google Sign-Up Username Selection
The system SHALL NOT create a new account immediately when a first-time Google sign-in completes; instead it SHALL issue a short-lived pending token (carrying the Google account id, email, and a suggested username) and require the client to submit a chosen username before the account is created.

#### Scenario: First-time Google sign-in requires a username before account creation
- **WHEN** a client completes the Google OAuth flow with a Google account id that has no matching user record
- **THEN** the server does not create a user record yet; it returns a short-lived pending token and a suggested username derived from the Google profile, without exposing that suggestion as a final username

#### Scenario: Submitting a chosen username completes the account
- **WHEN** a client submits a valid, unclaimed username together with a still-valid pending token
- **THEN** the server creates the user record with that username, the Google account id, and no password hash, and issues a JWT access token

#### Scenario: Chosen username is already taken
- **WHEN** a client submits a username that already belongs to an existing user together with a valid pending token
- **THEN** the server rejects the submission and returns an error indicating the username is already taken, without creating an account

#### Scenario: Pending token has expired
- **WHEN** a client submits a username together with an expired or invalid pending token
- **THEN** the server rejects the submission and returns an error indicating the sign-up link expired, without creating an account

#### Scenario: Same Google sign-up is completed twice
- **WHEN** a client submits a username for a Google account id that was already turned into a user record by an earlier completion of the same pending token
- **THEN** the server returns that existing account's JWT access token instead of creating a duplicate or erroring

### Requirement: JWT Issuance and Verification
The system SHALL issue a signed JWT access token on successful registration, login, or Google OAuth callback, and SHALL verify that token's signature and expiry on any request to a route that requires authentication.

#### Scenario: Valid token is accepted
- **WHEN** a request includes a JWT access token that has a valid signature and has not expired
- **THEN** the server treats the request as authenticated as the user identified by that token

#### Scenario: Expired or invalid token is rejected
- **WHEN** a request includes a JWT access token that is expired, has an invalid signature, or is malformed
- **THEN** the server rejects the request as unauthenticated

### Requirement: Current User Lookup
The system SHALL provide an endpoint that returns the authenticated user's own profile based solely on their JWT access token.

#### Scenario: Authenticated client requests its own profile
- **WHEN** a client sends a request with a valid JWT access token to the current-user endpoint
- **THEN** the server returns that user's public profile (id, username, email)

#### Scenario: Unauthenticated client requests the current user
- **WHEN** a client sends a request to the current-user endpoint without a valid JWT access token
- **THEN** the server rejects the request as unauthenticated

### Requirement: Logout
The system SHALL provide a logout endpoint that a client can call to end its local authenticated session; since access tokens are not server-tracked, logout SHALL NOT be required for a token to eventually stop working (it expires on its own).

#### Scenario: Client logs out
- **WHEN** an authenticated client calls the logout endpoint
- **THEN** the server responds confirming logout, and the client discards its locally stored JWT access token

### Requirement: Guest Play Remains Unauthenticated
The system SHALL NOT require a JWT access token, a logged-in account, or any auth state to join a room, submit a display name, or participate in a match.

#### Scenario: Guest joins and plays without ever authenticating
- **WHEN** a client with no JWT access token joins a room using only a room code/invite link and a display name
- **THEN** the client joins and plays the match exactly as it could before this change, with no auth-related request required at any point

#### Scenario: Logged-in user plays as a guest by nickname
- **WHEN** a client holding a valid JWT access token joins a room using a display name, the same way a guest would
- **THEN** the room/lobby/match flow treats that client identically to a guest, independent of its login state
