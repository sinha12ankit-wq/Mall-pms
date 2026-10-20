-- Ticket numbers for work orders raised in the app, e.g. WO0100001.
-- Starts above the imported history so numbers never collide with it.
CREATE SEQUENCE ops.work_order_number_seq START WITH 100001;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE ops.work_order_number_seq TO mallpms_app;
