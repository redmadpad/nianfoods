-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN email text;

-- Update the handle_new_user function to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, employee_code, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'employee_code', 'EMP' || SUBSTRING(NEW.id::text, 1, 8)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'::user_role)
  );
  RETURN NEW;
END;
$function$;