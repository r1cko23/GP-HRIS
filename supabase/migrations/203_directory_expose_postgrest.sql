-- Expose schema directory to PostgREST (same project as clock / leave).
-- Keep grants on service_role only so anon/authenticated cannot read the 201 file
-- through the Data API. Dashboard access goes through /api/directory/* with the
-- service role. Matches current exposed schemas plus directory.
--
-- If the Dashboard Data API settings later overwrite this, add `directory` to
-- Exposed schemas there as well.

ALTER DEFAULT PRIVILEGES IN SCHEMA directory
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA directory
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA directory
  GRANT EXECUTE ON ROUTINES TO service_role;

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, directory';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
