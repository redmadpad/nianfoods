-- Update or insert profile for admin user
INSERT INTO public.profiles (id, employee_code, email, role, is_active)
VALUES (
  '6e8f03fc-6c62-4e44-b204-83807e89934e',
  '4010527',
  'sadeghimeisam@gmail.com',
  'admin',
  true
)
ON CONFLICT (id) 
DO UPDATE SET 
  employee_code = EXCLUDED.employee_code,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;