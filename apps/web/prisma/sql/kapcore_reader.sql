-- kapcore_reader.sql
-- Run ONCE on the Neon database (SQL editor), by the database owner.
-- Safe to re-run: views are replaced, the role is created only if missing.
--
-- KAP Core (the staff platform) reads exactly four objects from this database
-- through postgres_fdw, in the shape its migration 002 imports:
--
--   students             id, roll_number, full_name, batch_id, is_active
--   batches              id, name, centre_name, is_active
--   daily_attendance     student_roll, batch_id, attendance_date, present
--   test_publish_status  test_id, name, type, test_date, batch_ids,
--                        conducted_at, published_at, admin_url
--
-- Prisma's own tables ("Student", "Batch", ...) have different names and
-- columns, so without these views KAP Core's link finds nothing. They are
-- read-only views over the live tables: nothing is copied and Prisma
-- migrations are not affected (Prisma ignores views it does not model).
--
-- After running, set a strong password on kapcore_reader (last statement)
-- and give it to KAP Core as KAPCONNECT_URL.

create or replace view public.batches as
  select b.id::text      as id,
         b.name          as name,
         b.center        as centre_name,
         true            as is_active
    from "Batch" b;

-- A student belongs to a batch by name + centre (Student.batch is the name).
-- roll_number is the enrolment number: the join key in both systems.
create or replace view public.students as
  select s.id::text                    as id,
         s."enrollmentNo"              as roll_number,
         coalesce(nullif(s.name, ''), s."enrollmentNo") as full_name,
         b.id::text                    as batch_id,
         true                          as is_active
    from "Student" s
    join "Batch" b on b.name = s.batch and b.center = s.center
   where s."enrollmentNo" <> '';

-- One row per student per WORKING DAY of their batch in the last 60 days.
-- A working day is one on which anyone in the batch scanned in; a student
-- with no PUNCH_IN that day is absent. Day-level only (Section 15.3).
create or replace view public.daily_attendance as
  with scans as (
    select a."studentId", a.date::date as attendance_date
      from "Attendance" a
     where a.type = 'PUNCH_IN'
       and a.date ~ '^\d{4}-\d{2}-\d{2}$'
       and a.date::date >= current_date - 60
     group by a."studentId", a.date::date
  ),
  working_days as (
    select distinct st.batch_id, sc.attendance_date
      from scans sc join public.students st on st.id = sc."studentId"
  )
  select st.roll_number                  as student_roll,
         st.batch_id                     as batch_id,
         wd.attendance_date              as attendance_date,
         (sc."studentId" is not null)    as present
    from public.students st
    join working_days wd on wd.batch_id = st.batch_id
    left join scans sc on sc."studentId" = st.id and sc.attendance_date = wd.attendance_date;

-- Status and link only. No marks, ranks or percentiles cross (Section 15.4).
-- A "test" here is one testName on one testDate; it is published when its
-- results were uploaded.
create or replace view public.test_publish_status as
  select md5(r."testName" || '|' || r."testDate")           as test_id,
         r."testName"                                       as name,
         null::text                                         as type,
         case when r."testDate" ~ '^\d{4}-\d{2}-\d{2}$' then r."testDate"::date end as test_date,
         array_agg(distinct st.batch_id) filter (where st.batch_id is not null) as batch_ids,
         null::timestamptz                                  as conducted_at,
         min(r."uploadedAt")                                as published_at,
         '/admin/results'                                   as admin_url
    from "TestResult" r
    left join public.students st on st.id = r."studentId"
   group by r."testName", r."testDate";

do $$ begin
  create role kapcore_reader login password 'CHANGE-ME-BEFORE-USE';
exception when duplicate_object then null; end $$;

revoke all on all tables in schema public from kapcore_reader;
grant usage on schema public to kapcore_reader;
grant select on public.students, public.batches, public.daily_attendance,
                public.test_publish_status to kapcore_reader;

-- alter role kapcore_reader password '<a long random password>';
