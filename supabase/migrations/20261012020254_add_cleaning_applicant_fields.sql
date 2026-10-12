-- Run once in the mirembe-production Supabase SQL Editor after reviewing it.
-- Existing rows are preserved. New columns stay nullable so older applications
-- can be backfilled before a later migration adds NOT NULL constraints.
begin;

alter table public.cleaning_applicants
  add column first_name text,
  add column last_name text,
  add column city text,
  add column state text,
  add column has_personal_vehicle boolean,
  add column cleaning_experience text,
  add column languages text[],
  add column other_language text,
  add column travel_distance text,
  add column preferred_availability text;

alter table public.cleaning_applicants
  add constraint cleaning_applicants_first_name_valid
    check (first_name is null or length(btrim(first_name)) between 1 and 80),
  add constraint cleaning_applicants_last_name_valid
    check (last_name is null or length(btrim(last_name)) between 1 and 80),
  add constraint cleaning_applicants_city_valid
    check (city is null or length(btrim(city)) between 1 and 100),
  add constraint cleaning_applicants_state_valid
    check (state is null or state in ('CT', 'MA')),
  add constraint cleaning_applicants_experience_valid
    check (cleaning_experience is null or cleaning_experience in
      ('none', 'under_1_year', '1_to_3_years', '3_plus_years')),
  add constraint cleaning_applicants_languages_valid
    check (languages is null or (
      cardinality(languages) between 1 and 5
      and array_position(languages, null) is null
      and languages <@ array[
        'english', 'spanish', 'haitian_creole', 'portuguese', 'other'
      ]::text[]
    )),
  add constraint cleaning_applicants_other_language_valid
    check (
      (languages is null and other_language is null)
      or (languages is not null and (
        ('other' = any(languages) and coalesce(length(btrim(other_language)) between 1 and 80, false))
        or (not ('other' = any(languages)) and other_language is null)
      ))
    ),
  add constraint cleaning_applicants_travel_valid
    check (travel_distance is null or travel_distance in
      ('under_5_miles', '10_miles', '20_miles', 'over_25_miles')),
  add constraint cleaning_applicants_availability_valid
    check (preferred_availability is null or preferred_availability in
      ('full_time', 'part_time', 'both'));

commit;
