# Authentication and single sign-on

Blokhouse signs users in with an email and password by default. You can add single sign-on (SSO)
with any OpenID Connect (OIDC) provider, for example Keycloak or Microsoft Entra ID. Roles can come
from the provider (groups or app roles), so access is managed in one place.

- One provider per instance, authorization code flow with PKCE.
- Password login stays available unless you turn it off with `PASSWORD_LOGIN=false`.
- API tokens, Ansible and Puppet integrations are not affected. They keep using [API tokens](api.md).

All variables are listed in [configuration.md](configuration.md#single-sign-on-oidc).

## Quick start

Create a confidential client at your provider with the redirect URI
`<NEXTAUTH_URL>/api/auth/callback/oidc`, then set:

```bash
OIDC_ISSUER=https://sso.example.com/realms/company
OIDC_CLIENT_ID=blokhouse
OIDC_CLIENT_SECRET=...
OIDC_NAME=Company SSO                      # label on the sign-in button
OIDC_ROLE_MAP=cmdb-admins=ADMIN,cmdb-users=USER,cmdb-read=READONLY
SESSION_MAX_AGE=28800                      # 8 hours, recommended with SSO
```

Restart Blokhouse. The sign-in page now shows a "Sign in with ..." button.

Blokhouse reads every claim it uses (`email`, `email_verified`, `name`, `preferred_username` and the
role claim) from the **ID token**. It does not call the userinfo endpoint. Make sure your provider puts
these claims into the ID token.

## Keycloak

1. In your realm create a client: **Clients -> Create client**, client type `OpenID Connect`,
   client ID `blokhouse`.
2. Turn **Client authentication** on (confidential client) and keep **Standard flow** on.
3. Set **Valid redirect URIs** to `https://blokhouse.example.com/api/auth/callback/oidc`
   (your `NEXTAUTH_URL` plus the path).
4. Copy the secret from the **Credentials** tab into `OIDC_CLIENT_SECRET`.
5. Create groups (for example `cmdb-admins`, `cmdb-users`, `cmdb-read`) and add users to them.
6. Add a groups mapper to the client's own dedicated scope:
   **Clients -> blokhouse -> Client scopes -> blokhouse-dedicated -> Add mapper -> By configuration
   -> Group Membership**.
   - Token claim name: `groups`
   - **Add to ID token**: on
   - **Full group path**: on or off. Both work, Blokhouse ignores a leading `/`, so `/cmdb-admins`
     and `cmdb-admins` match the same map entry.
7. Set the variables:

```bash
OIDC_ISSUER=https://keycloak.example.com/realms/company
OIDC_CLIENT_ID=blokhouse
OIDC_CLIENT_SECRET=...
OIDC_ROLE_MAP=cmdb-admins=ADMIN,cmdb-users=USER,cmdb-read=READONLY
```

`OIDC_ROLE_CLAIM` defaults to `groups`, so you do not need to set it.

Add the mapper to the dedicated scope of the client, **not** to a separate client scope that replaces
the default scopes. Otherwise the ID token may lose `email` and `email_verified` and sign-in fails
with `SsoNoEmail` or `SsoEmailNotVerified`.

## Microsoft Entra ID

1. **App registrations -> New registration**. Supported account type: **Single tenant**.
2. Under **Authentication -> Add a platform -> Web** set the redirect URI to
   `https://blokhouse.example.com/api/auth/callback/oidc`.
3. **Certificates & secrets -> New client secret**. Copy the secret **value** into `OIDC_CLIENT_SECRET`
   (it is shown only once). Note its expiry date, sign-in stops when the secret expires.
4. **App roles -> Create app role**: allowed member types "Users/Groups", value for example
   `cmdb-admins`. Create one app role per Blokhouse role you want to map.
5. In **Enterprise applications -> your app -> Users and groups** assign users or groups to the roles.
   Users without an assignment get no role and cannot sign in (`SsoNoAccess`). To enforce this at
   Entra as well, turn on **Assignment required** in the enterprise application's properties.
6. Set the variables. `<tenant-id>` is the Directory (tenant) ID from the app's overview:

```bash
OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_CLIENT_ID=<application (client) ID>
OIDC_CLIENT_SECRET=...
OIDC_NAME=Microsoft
OIDC_ROLE_CLAIM=roles
OIDC_ROLE_MAP=cmdb-admins=ADMIN,cmdb-users=USER,cmdb-read=READONLY
```

### Why app roles and not groups

Group claims contain object IDs, not names, and Entra leaves them out of the token when a user is in
more than about 200 groups (the "overage" case, the token then only points to the Graph API, which
Blokhouse does not call). App roles are short, readable values and are always included in the ID token.

### The email address and `OIDC_TRUST_EMAIL`

Entra usually does not send `email_verified`. Blokhouse only links an SSO login to an **existing**
local account when the provider says the email is verified, so without it existing accounts are not
linked and the user sees `SsoEmailNotVerified`. New users are created without any problem.

If you need to link existing accounts, set `OIDC_TRUST_EMAIL=true`. That tells Blokhouse to treat the
`email` claim as verified even without `email_verified`. This is only safe when your tenant controls
the email attribute of every user who can sign in:

- Never use it with **multi-tenant** apps.
- Never use it when **guest users** can sign in and set their own mail address.
- Never use it with any provider where users can change their own email.

Otherwise someone could claim another person's address and take over that account.

When there is no `email` claim at all, Blokhouse falls back to `preferred_username` (the UPN in Entra)
if it looks like an email address. This fallback is used only to **create** a new user, never to link
an existing one. If an account with that address already exists, the login is refused.

## Role mapping

`OIDC_ROLE_MAP` is a comma-separated list of `value=ROLE`. `value` is compared to the entries of the
claim named by `OIDC_ROLE_CLAIM` (a list or a single string; a leading `/` is ignored).

```bash
OIDC_ROLE_MAP=cmdb-admins=ADMIN,cmdb-users=USER,cmdb-read=READONLY
```

- **Order matters.** The first entry of the map that matches one of the user's values wins. Put the most
  powerful role first.
- **No match means no access.** When the map is set, a user without a matching value cannot sign in
  (`SsoNoAccess`), including users that signed in before.
- **The role is re-applied at every sign-in.** A change at the provider takes effect the next time the
  user signs in, and the change is written to the audit log. Blokhouse refuses to change the role of
  such a user by hand (see below).
- Allowed roles: `ADMIN`, `USER`, `AUDIT`, `READONLY`. `API` can never be mapped, and service accounts
  (role `API`) cannot sign in via SSO.
- **Without a map**, every user who can authenticate at the provider gets `OIDC_DEFAULT_ROLE`
  (default `READONLY`) when first created, and roles are managed in Blokhouse under Admin -> Users.
  Be careful: this lets everyone at the provider in. Prefer a map.

## How accounts are linked

An SSO identity is recognised by its provider subject (`sub`), never by email, after the first login.
On the first login:

| Situation | Result |
| --- | --- |
| No local user with that email | A new user is created (role from the map, or `OIDC_DEFAULT_ROLE`). |
| Local user, email verified (or `OIDC_TRUST_EMAIL=true`) | The account is linked. Its **password is removed**, its role is set from the map, and its API tokens are capped to `OIDC_TOKEN_MAX_DAYS`. |
| Local user, email not verified | Refused (`SsoEmailNotVerified`). |
| Local **admin with a password** | Refused (`SsoLocalAdmin`). Local admins are never linked or changed. |
| Local user already linked to another identity | Refused (`SsoAlreadyLinked`). |
| Deactivated user | Refused (`SsoDisabled`). |

Email matching ignores case. If two local users differ only in case, nobody is linked.

## Sign-in errors

Users are sent back to the sign-in page with a message. What it means for you as an administrator:

| Code | Meaning |
| --- | --- |
| `SsoNoAccess` | The user has no value in the role claim that appears in `OIDC_ROLE_MAP`. Add the user to the group or assign the app role. Also shown when the provider returned no usable identity. |
| `SsoLocalAdmin` | The email belongs to a local admin who has a password. Sign in with the password instead, or change that user's email. |
| `SsoEmailNotVerified` | A local account exists for this email but the provider did not mark it as verified (see `OIDC_TRUST_EMAIL`). Also shown when the only address is `preferred_username` and it already belongs to a user. |
| `SsoAlreadyLinked` | The account is linked to a different identity at the provider, or two local users match the email ignoring case. |
| `SsoDisabled` | The user was deactivated in Blokhouse. |
| `SsoServiceAccount` | The email belongs to a service account (role `API`). |
| `SsoNoEmail` | The ID token has neither `email` nor a `preferred_username` that looks like an email address. |
| `SsoError` | Unexpected error. Look in the server log for `OIDC sign-in error`. |
| `OAuthSignin`, `OAuthCallback`, `Configuration` | The provider is unreachable, rejected the request, or the client is misconfigured. Check issuer, client ID/secret and redirect URI. |

## Deactivating users

Under **Admin -> Users** an administrator can deactivate a user. Deactivation takes effect at once, also
for sessions that are already open (Blokhouse re-checks the user on every request), and it
blocks password login, SSO login and the user's API tokens. Because the provider cannot end a Blokhouse
session by itself, deactivate leavers here as well, or rely on a short `SESSION_MAX_AGE`.
You cannot deactivate yourself or the last administrator.

Removing a user from the group at the provider takes effect at the next sign-in. Deactivating in Blokhouse
is immediate.

## API tokens of SSO users

Blokhouse cannot see when the provider disables someone, so tokens of SSO users must expire:

- An expiry is required, and at most `OIDC_TOKEN_MAX_DAYS` days (default 90). The token form enforces this.
- When an existing account is linked, tokens without an expiry or with a longer one are capped.
- For automation, use a **service account**: a user with the role `API`, created under Admin -> Users.
  Service accounts do not sign in through SSO and are not subject to this limit.

## What cannot be changed in Blokhouse

For users who signed in via SSO the API answers `409`:

- changing the **role** when `OIDC_ROLE_MAP` is set (the provider manages it),
- setting a **password** (SSO users have none).

Name changes, deactivation and deletion still work. Deleting an SSO user removes the local record; if they
sign in again they are created anew.

## Break-glass access

If the provider is down or misconfigured you must still be able to get in:

- Keep `PASSWORD_LOGIN=true` (the default).
- Keep at least one **local admin with a password**, for example `admin@blokhouse.local`. SSO never links
  or changes such an account, whatever the provider sends. Store the password in your password manager.

Setting `PASSWORD_LOGIN=false` hides the password form, rejects password logins and disables public
signup. Only do that once SSO works, and think about how you recover without it (for example setting it back
to `true` and restarting).

## Session lifetime

Sessions last `SESSION_MAX_AGE` seconds (default 2592000, 30 days). With SSO we recommend `28800` (8 hours)
so people re-authenticate with the provider daily. Role and deactivation changes in Blokhouse apply
immediately regardless of this setting.

## Startup checks

Blokhouse refuses to start, and logs the reason, when the configuration is invalid:

- only some of `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` are set,
- `OIDC_ROLE_MAP` has an entry that is not `value=ROLE`, or a role other than `ADMIN`, `USER`, `AUDIT`, `READONLY`
  (`API` is not allowed, also not as `OIDC_DEFAULT_ROLE`),
- `OIDC_TOKEN_MAX_DAYS` or `SESSION_MAX_AGE` is not a positive integer,
- `PASSWORD_LOGIN=false` without a complete OIDC configuration.

## Testing

`scripts/e2e` holds the end-to-end test that runs in CI: a throwaway Keycloak with a ready-made realm
(`scripts/e2e/keycloak/realm-blokhouse.json`: client `blokhouse`, groups mapper, groups `cmdb-admins` and
`cmdb-read`) and the matching Blokhouse settings in `scripts/e2e/docker-compose.sso.yml`. It is a
working example configuration. Do not use its credentials outside of tests.
