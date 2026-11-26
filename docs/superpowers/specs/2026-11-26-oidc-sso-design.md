# Single sign-on with OIDC

Status: design for approval (2026-11-26)

## Intent

Companies that run Blokhouse want their people to sign in with the accounts
they already have, not with a password an admin set up for each person. The
target environments are **Keycloak** and **Microsoft Entra ID**; Active
Directory is reached through Entra (or ADFS) via OIDC. Access should be
managed where companies manage it today: in the directory, by groups or app
roles.

## Goals

- Sign in with one generic OIDC provider (Keycloak, Entra ID, and any other
  standards-compliant provider: Okta, Authentik, Google, ADFS).
- Roles can come from the directory (groups / app roles); without a mapping,
  roles are maintained in Blokhouse.
- Password login can be turned off for SSO-only installations.
- Configuration through environment variables, like the rest of Blokhouse.
- Tested end to end against a real Keycloak in CI.

## Non-goals

- LDAP / direct AD bind (decided: AD is reached via OIDC).
- More than one SSO provider at a time.
- Configuring SSO in the web UI.
- SAML.
- Single logout / RP-initiated logout at the IdP.
- SCIM provisioning or syncing users that never signed in.
- Finer permissions than the existing roles (that is the RBAC work that
  follows).

## Anti-goals (would make this a failure even if it works)

- A way to take over an existing account by sending a matching email claim
  (the "nOAuth" class of bugs with Entra).
- Locking the only admin out when password login is turned off.
- SSO users getting more access than the directory grants when a role mapping
  is configured.
- Granting the `API` role (service accounts) through SSO.

## Current state

- NextAuth v4 (4.24.15), `lib/authOptions.js`: Credentials provider only, JWT
  sessions, Prisma adapter; the `Account` table (provider, providerAccountId)
  already exists.
- Roles are fixed: ADMIN, USER, AUDIT, READONLY, API (`lib/auth.js`,
  `ROLE_SCOPES`). The `jwt` callback re-reads the role from the database on
  every session check, so role changes in the database take effect at once.
- `/api/auth/*` is public in `proxy.ts`. Signup is opt-in (`ALLOW_SIGNUP`).
- The seed creates the first admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Admin user management: `app/(admin)/admin/users`, `/api/users` (admin only,
  protects the last admin).

## Approaches considered

1. **NextAuth v4's generic OAuth/OIDC provider** (chosen). Issuer, client ID
   and secret are enough; endpoints come from
   `.well-known/openid-configuration`. Keeps sessions, the `Account` table and
   the per-request role check as they are.
2. Upgrade to Auth.js v5 first. Rejected: v5 is still beta and a migration of
   its own (proxy, sessions, tests); v4 is maintained.
3. Own implementation with `openid-client`. Rejected: more security-relevant
   code of our own (callback, state, PKCE, session) with no gain.

## Design

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `OIDC_ISSUER` | – | Issuer URL. SSO is enabled when issuer, client ID and secret are set. Entra: `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| `OIDC_CLIENT_ID` | – | |
| `OIDC_CLIENT_SECRET` | – | |
| `OIDC_NAME` | `Single sign-on` | Label of the sign-in button |
| `OIDC_SCOPES` | `openid email profile` | Extra scopes, e.g. for a groups scope |
| `OIDC_ROLE_CLAIM` | `groups` | Claim with groups or roles. Entra app roles: `roles` |
| `OIDC_ROLE_MAP` | – | `cmdb-admins=ADMIN,cmdb-users=USER,cmdb-audit=AUDIT,cmdb-read=READONLY` |
| `OIDC_DEFAULT_ROLE` | `READONLY` | Role for new SSO users when no role map is set |
| `OIDC_TRUST_EMAIL` | `false` | Treat the email claim as verified even without `email_verified` |
| `PASSWORD_LOGIN` | `true` | `false` hides and refuses email/password login and disables signup |
| `SESSION_MAX_AGE` | `2592000` (30 days) | Session lifetime in seconds, for all logins |
| `OIDC_TOKEN_MAX_DAYS` | `90` | Longest allowed lifetime of API tokens owned by SSO users |

The callback URL to register at the IdP is
`<NEXTAUTH_URL>/api/auth/callback/oidc`. Invalid configuration (unknown role
in the map, `API` in the map or as default role, issuer set without client
ID) fails at startup with a clear message instead of at the first login.

### Provider

- Provider id `oidc`, type `oauth`, `wellKnown` from the issuer, `idToken:
  true`, checks `pkce` and `state`.
- Claims read from the ID token (and userinfo where the provider puts them
  there): `sub`, `email`, `email_verified`, `name`, `preferred_username`, and
  the role claim.
- A user is identified by `Account(provider "oidc", providerAccountId = sub)`
  after the first login, never by email.

### First login and account linking

1. If an `Account` for the `sub` exists, that user signs in.
2. Otherwise the email is needed. If the token has no `email`, use
   `preferred_username` when it is an email address (Entra often sends only
   that), **but only to create a new user, never to link**; with neither,
   deny with "no email address in the token".
3. If a user with that email (taken from the `email` claim) exists:
   - **local admins are never linked:** if that user has role ADMIN and a
     password, deny ("this address belongs to a local administrator").
     This keeps the break-glass admin out of SSO's reach (decided);
   - link only if `email_verified === true` or `OIDC_TRUST_EMAIL=true`;
     otherwise deny with a message that an account with this email exists
     and an admin must allow linking (via `OIDC_TRUST_EMAIL`);
   - **linking removes the user's password** (decided as the builder-check
     follow-up): from then on the account signs in via SSO only. This closes
     two holes: an account pre-registered with someone else's address through
     signup cannot keep its password after the real owner signs in, and a user
     the directory no longer grants access cannot fall back to an old
     password.
   - existing API tokens of a linked user that have no expiry, or expire later
     than `OIDC_TOKEN_MAX_DAYS` from now, are capped to that date (my call,
     same reason as the token rule below).
4. Otherwise create the user (name, email, no password) with the role from
   the next section.
5. A user with role `API`, or a deactivated user, can never sign in via SSO.
6. NextAuth v4's adapter refuses OAuth sign-ins for an existing email
   (`OAuthAccountNotLinked`); the linking above replaces that behaviour.

Creating a user, linking an account and every role change made by SSO are
written to the audit log (actor: the user, via `sso`).

### Roles

- **With `OIDC_ROLE_MAP`:** on every SSO login the role is set from the role
  claim. Entries are checked in the order written; the **first entry whose
  group or role the user has wins**, so admins order the map from most to
  least privileged. (The roles are not a strict hierarchy, e.g. AUDIT vs USER,
  so a written order is clearer than a "strongest role" rule.) Group values
  match exactly, and Keycloak full paths match without the leading slash
  (`/cmdb-admins` matches `cmdb-admins`). No match: sign-in is denied
  ("you have no access to Blokhouse"), and an existing user's role is left as
  it was but they cannot sign in via SSO.
- **Without `OIDC_ROLE_MAP`:** new users get `OIDC_DEFAULT_ROLE`; existing
  users keep their role; admins change it in Blokhouse.
- The claim may be a string or an array; both are handled.
- If the role map is removed later, users keep their last role.
- With a role map, the role of a user who has an `oidc` account cannot be
  changed in Blokhouse: the admin UI shows it read-only with a hint, and
  `PUT /api/users/:id` rejects a role change with 409 and a clear message.
  Deactivating them stays possible (next section). Local users (no `oidc`
  account) are managed as today.
- The last-admin protection still applies to role changes through the UI/API.
  A role change through SSO may demote the last SSO admin; the seeded local
  admin remains for break-glass access (see below).

### Password login

- `PASSWORD_LOGIN=false`: the sign-in page shows only the SSO button, the
  Credentials provider refuses every login, and signup is off regardless of
  `ALLOW_SIGNUP`. Startup fails if `PASSWORD_LOGIN=false` and SSO is not
  configured.
- Break-glass: set `PASSWORD_LOGIN=true` temporarily and sign in with a
  local admin (one with a password; SSO never touches those). The docs
  recommend a dedicated local admin whose address is not in the directory,
  e.g. `admin@blokhouse.local`.
- With no role map, the first SSO users get `OIDC_DEFAULT_ROLE`; a local
  admin promotes the first SSO admin.
- API tokens are unaffected by all of this.

### Deactivating users (decided)

- New field `User.disabledAt DateTime?` (migration). A user is deactivated
  when it is set.
- Takes effect at once everywhere: the `jwt` callback treats a deactivated
  user like a deleted one (session ends on the next request), the
  Credentials provider and the SSO sign-in refuse them, and `lib/auth.js`
  refuses their API tokens.
- Admin → Users gets an activate/deactivate toggle, and `PUT /api/users/:id`
  accepts it; for SSO users with a role map this is the way to cut access in
  Blokhouse. Admins cannot deactivate themselves or the last active admin.
  Changes are audited. Deactivated users stay visible in the list, marked.
- Applies to all users, not only SSO users; the RBAC work builds on it.

### API tokens of SSO users (decided)

The directory cannot tell Blokhouse that someone left. So API tokens owned by
a user with an `oidc` account must have an expiry of at most
`OIDC_TOKEN_MAX_DAYS` (default 90): `POST /api/api-tokens` rejects a missing
or longer expiry for them with a clear message, and the token form offers
only allowed lifetimes. Long-running automation uses service accounts (role
API), which are unaffected.

### Sessions and deprovisioning

`SESSION_MAX_AGE` sets the NextAuth session lifetime. Someone disabled in the
directory keeps a running session until it expires; a role change in the
directory takes effect at the next sign-in. The docs recommend e.g. 8 hours
(`28800`) for SSO installations and say that deactivating a user in
Blokhouse ends access at once.

### UI

- Sign-in page: "Sign in with <OIDC_NAME>" button when SSO is configured;
  error messages for the denial cases above (NextAuth error codes mapped to
  readable text).
- Admin → Users: a "SSO" badge for users with an `oidc` account; role select
  disabled for them when a role map is set; activate/deactivate toggle.
- API token form: for SSO users, expiry required and limited.

### Tests

- Unit tests: config parsing and validation, role mapping (order, arrays,
  strings, Keycloak paths, no match, API refused), linking decision.
- Integration tests (PostgreSQL): the sign-in callback paths with fake
  profiles: new user, link verified (password removed, tokens capped),
  refuse unverified, refuse local admin, `preferred_username` creates but
  never links, role sync, deny, audit entries, 409 on role change;
  deactivation (session, password, tokens, SSO, last admin); token expiry
  rule for SSO users.
- End to end in the CI docker job: a Keycloak container (pinned version) with
  an imported test realm (client, groups `cmdb-admins` and `cmdb-read`, two
  users), Blokhouse configured against it, a Playwright browser test that
  signs in as both users and checks role and access, plus `PASSWORD_LOGIN=false`.

### Docs

- `docs/authentication.md` (new): set-up for Keycloak (client, groups mapper)
  and Entra ID (app registration, app roles, `roles` claim, `OIDC_TRUST_EMAIL`
  guidance, why app roles instead of groups), role mapping, break-glass,
  session lifetime.
- `docs/configuration.md`: the new variables. CHANGELOG entry.

## Left to the builder

- How the sign-in page learns whether password login is enabled (e.g. extend
  the existing `GET /api/auth/signup` or a small config endpoint); NextAuth's
  `getProviders()` covers the SSO button.
- Where config parsing lives (e.g. `lib/oidc.js`) and how it is wired into
  `authOptions`.
- Exact wording of error messages and the Keycloak realm fixture.
