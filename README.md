# Ekong Sampson Connect

## Run the project-team portal

The staff portal requires server-side credentials; entering a username and password in the browser does not configure the server.

1. Copy `.env.example` to `.env`.
2. Edit `.env` and choose either a username or email address for `STAFF_USERNAME`. Set a unique `STAFF_PASSWORD` of at least 6 characters. A longer password is recommended for better security. Do not reuse a password that has been shared or captured in a screenshot.
3. Run `npm start`.
4. Open `http://localhost:3000/admin` to sign in. The public site is at `http://localhost:3000`.

The `.env` file is excluded from source control. Keep it private and do not commit it.
