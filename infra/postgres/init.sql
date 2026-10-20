-- Runs once when the local Postgres container is first created.
-- The schema owner (POSTGRES_USER) runs migrations; the API logs in as
-- mallpms_app, which is always subject to row-level security.
CREATE ROLE mallpms_app LOGIN PASSWORD 'mallpms_app';
