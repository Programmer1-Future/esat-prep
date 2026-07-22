# Auth + cloud sync smoke checklist

Manual path: **SignIn** (password / OTP) → **AuthGate** (`SetPasswordScreen`) → **SessionContext** → **cloudSync** (`esat_user_state`).

Schema: `supabase/migrations/0001_esat_auth_roles_sync.sql`. Env: copy `.env.example` → `.env` and set real `VITE_SUPABASE_*` (never commit secrets). First-time signup is **magic-link OTP only** — there is no separate sign-up form.

## Preconditions

- [ ] `.env` has a real project URL and anon key (not `your-anon-public-key-here`).
- [ ] Migration `0001_esat_auth_roles_sync.sql` applied on that project.
- [ ] Supabase Auth → URL config allows this app origin (for OTP redirect).
- [ ] Dev server running (`npm run dev` or equivalent).

## 10-step checklist

1. **Cold load (signed out)**  
   Open the app in a private/incognito window. Expect the SignIn screen (password mode by default). No hang on “Loading…”.

2. **OTP first login**  
   Click **First time? Get a sign-in link**, enter a fresh email, submit. Expect “Sign-in link sent”. Open the email, click the link. App should land signed in (same origin).

3. **Set password gate**  
   Expect **Create your password** (`SetPasswordScreen`) because `user_metadata.has_password` is unset. Reject short / mismatched passwords; then set an 8+ character password and continue.

4. **Role + sync bootstrap**  
   Expect a brief “Syncing your learning record…”, then the main app. Profile row exists in `esat_profiles` (default `role = 'user'`). An `esat_user_state` row exists for the user (empty `{}` or claimed local keys).

5. **Local write → cloud push**  
   Change something in a synced key (e.g. exam date, habit, or practice event). Wait ≥2s (debounce). In Supabase, `esat_user_state.data` for that `user_id` should include the matching `esat_*` keys.

6. **Refresh persistence**  
   Hard-refresh the browser. Expect: still signed in, no password screen again, learning record intact (from localStorage and/or cloud pull).

7. **Sign out**  
   Use the header LogOut control. Expect SignIn again. Sync should stop; session cleared.

8. **Password re-login**  
   Sign in with email + the password from step 3. Expect sync overlay then app — **not** SetPassword again. Cloud pull should restore synced keys if local storage was cleared.

9. **Admin role path** (optional but recommended once)  
   Promote the user in SQL (no hardcoded admin email in app code):  
   `update public.esat_profiles set role = 'admin' where email = 'you@example.com';`  
   Sign out / in (or refresh after role is re-fetched on next session bootstrap). Expect **Admin** nav link. `/admin` shows Users + Content; a plain `user` must see “Not authorised”.

10. **Negative / guard checks**  
    Wrong password → friendly error, stay on SignIn. Missing/placeholder env → app fails fast with a clear Vite/env error (not a cryptic Supabase client crash). Last-admin demotion is blocked by DB trigger if you try it in Admin.

## Flow map (quick)

```
SignIn.signInWithOtp / signInWithPassword
  → AuthGate (getSession + onAuthStateChange)
    → needsPassword? SetPasswordScreen (updateUser + has_password)
    → pullState / startSync (esat_user_state)
    → SessionContext { user, role } → App (signOut, Admin if canManageContent)
```

## Notes

- Synced keys live in `src/lib/cloudSync.js` (`SYNC_KEYS`). Theme (`esat_theme`) is device-local and not synced.
- OTP creates the auth user; trigger `esat_on_auth_user_created` inserts `esat_profiles`. AuthGate self-heals a missing profile as `user`.
- Do not invent or commit anon keys; use Project Settings → API.
