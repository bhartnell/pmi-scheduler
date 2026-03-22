# Migrations

## Baseline
`00000000_baseline.sql` — Complete schema as of March 21, 2026.
New installations should run this first.

## Active Migrations
Files in this directory are recent schema changes.
Run with: `node scripts/run-migration.js supabase/migrations/<filename>.sql`

## Archive
`archive/` contains all historical migrations.
These have already been applied to production and are kept for reference.
