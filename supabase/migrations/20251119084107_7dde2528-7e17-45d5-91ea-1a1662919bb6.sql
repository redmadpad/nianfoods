-- ============================================
-- FIX ERROR-LEVEL SECURITY ISSUES
-- ============================================

-- 1. Create dedicated user_roles table (prevents privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Make roles table read-only for everyone
CREATE POLICY "Anyone can view roles" ON public.user_roles
FOR SELECT USING (true);

-- 2. Create security definer function (breaks RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles;

-- 4. Update ALL RLS policies to use has_role()

-- Profiles table - FIX BOTH privilege escalation AND privacy exposure
DROP POLICY IF EXISTS "Admins can do everything on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can only view their own sensitive data
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Admins and operators can view all profiles (business need)
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operators can view all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'operator'));

-- Users can update their own profile (but not role - it's gone!)
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Admins can do everything
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Activity logs
DROP POLICY IF EXISTS "Admins can view logs" ON public.activity_logs;
CREATE POLICY "Admins can view logs" ON public.activity_logs
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Menu item prices
DROP POLICY IF EXISTS "Admins can manage prices" ON public.menu_item_prices;
CREATE POLICY "Admins can manage prices" ON public.menu_item_prices
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Menu items
DROP POLICY IF EXISTS "Admins can manage menu items" ON public.menu_items;
CREATE POLICY "Admins can manage menu items" ON public.menu_items
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active menu items" ON public.menu_items;
CREATE POLICY "Anyone can view active menu items" ON public.menu_items
FOR SELECT USING (
  is_active = true OR public.has_role(auth.uid(), 'admin')
);

-- Orders
DROP POLICY IF EXISTS "Users and operators can create orders" ON public.orders;
CREATE POLICY "Users and operators can create orders" ON public.orders
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR 
  public.has_role(auth.uid(), 'operator') OR 
  public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT USING (
  user_id = auth.uid() OR 
  public.has_role(auth.uid(), 'operator') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Order items
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND (
      orders.user_id = auth.uid() OR 
      public.has_role(auth.uid(), 'operator') OR 
      public.has_role(auth.uid(), 'admin')
    )
  )
);

-- Restaurants
DROP POLICY IF EXISTS "Admins can manage restaurants" ON public.restaurants;
CREATE POLICY "Admins can manage restaurants" ON public.restaurants
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view active restaurants" ON public.restaurants;
CREATE POLICY "Anyone can view active restaurants" ON public.restaurants
FOR SELECT USING (
  is_active = true OR public.has_role(auth.uid(), 'admin')
);

-- Settings
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings" ON public.settings
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Weekly meal plans
DROP POLICY IF EXISTS "Admins can manage weekly meal plans" ON public.weekly_meal_plans;
CREATE POLICY "Admins can manage weekly meal plans" ON public.weekly_meal_plans
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 5. Update trigger function to use user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_code text;
  internal_email text;
  user_role user_role;
BEGIN
  -- Get employee code and role from metadata
  emp_code := COALESCE(NEW.raw_user_meta_data->>'employee_code', 'EMP' || SUBSTRING(NEW.id::text, 1, 8));
  internal_email := emp_code || '@dailyfoods.local';
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'::user_role);
  
  -- Insert into profiles (without role)
  INSERT INTO public.profiles (id, employee_code, email)
  VALUES (NEW.id, emp_code, internal_email);
  
  -- Insert role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$;

-- 6. Drop the old vulnerable function
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- 7. Remove role column from profiles (no longer needed)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;