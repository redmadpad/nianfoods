-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function to generate internal email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  emp_code text;
  internal_email text;
BEGIN
  -- Get employee code from metadata or generate one
  emp_code := COALESCE(NEW.raw_user_meta_data->>'employee_code', 'EMP' || SUBSTRING(NEW.id::text, 1, 8));
  
  -- Generate internal email format
  internal_email := emp_code || '@dailyfoods.local';
  
  INSERT INTO public.profiles (id, employee_code, email, role)
  VALUES (
    NEW.id,
    emp_code,
    internal_email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'::user_role)
  );
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing admin user with internal email format
UPDATE public.profiles 
SET email = employee_code || '@dailyfoods.local'
WHERE employee_code = '4010527';