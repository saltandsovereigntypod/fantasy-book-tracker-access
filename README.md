# The Empyrean Tracker

A private, immersive reading and theory tracker hosted on GitHub Pages and synchronized through Supabase.

## Finish the Supabase setup

1. Open the Supabase project with reference `udxatwvbxpefbdhnsycf`.
2. Open **SQL Editor**, create a new query, paste the complete contents of `supabase-setup.sql`, and run it once.
3. Create a private invitation code by running:

```sql
insert into public.invite_codes (code, max_uses)
values ('REPLACE-WITH-YOUR-PRIVATE-CODE', 20);
```

4. Under **Authentication > URL Configuration**, set:
   - Site URL: `https://saltandsovereigntypod.github.io/the-empyrean-book-tracker/`
   - Redirect URL: `https://saltandsovereigntypod.github.io/the-empyrean-book-tracker/**`
5. Keep Email authentication and Confirm Email enabled.

## Included cloud features

- Email and password signup, login, logout, confirmation, and password reset
- Invitation-code-only account creation
- One private cloud archive per authenticated user
- Automatic cloud saves after tracker changes
- Import prompt for existing browser data on first login
- Row Level Security so users can only read and edit their own archive

## Important security note

The repository contains only the Supabase publishable key, which is intended for browser applications. Never add the service-role key or database password to GitHub.

## Email delivery

No service beyond GitHub and Supabase is required for the basic setup. Supabase's built-in email delivery can be rate-limited, so custom SMTP may be added later if confirmation or reset emails become unreliable.

## Private Visual Builder libraries

The Fabric.js card editor supports reusable, account-scoped images and fonts. Deploy
`migrations/202608030001_private_visual_libraries.sql` through the Supabase SQL
migration workflow before enabling uploads. It creates private `visual-assets` and
`custom-fonts` buckets plus owner-only metadata tables and RLS/storage policies.

- Images: PNG, JPEG, WebP; 8 MB maximum. SVG is deliberately rejected because this
  static app does not ship a vetted SVG sanitizer.
- Fonts: WOFF2, WOFF, TTF, OTF; 5 MB maximum. Uploaders must confirm they have a
  license or permission to use each font.
- Saved Fabric JSON stores stable `assetId`, `assetStoragePath`, `fontId`, and
  `fontFamilyKey` metadata. Signed URLs are generated at runtime and are removed
  before card JSON is persisted. Legacy URL-only objects remain supported.
- Guests can continue designing with built-in fields, fonts, and templates. Cloud
  upload controls explain that sign-in is required; guest files are not staged or
  silently discarded.

Manual verification: sign in, open **Design Card**, upload each supported image and
font format, insert an image twice, apply a custom font to selected text, save, close,
and reopen the card. Confirm transforms/layers survive and another account cannot
list or sign URLs for those records.

Rollback: revert the application commit first. Then, only after exporting any user
uploads, drop the two owner policies/tables and remove the two private buckets.
Do not delete storage objects before confirming that no saved card references them.

