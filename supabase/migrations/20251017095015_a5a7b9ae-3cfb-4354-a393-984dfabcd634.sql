-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('employee', 'operator', 'admin');

-- Create enum for menu item categories
CREATE TYPE public.menu_category AS ENUM ('main', 'dessert', 'drink', 'side');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT,
  birth_date DATE,
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category menu_category NOT NULL,
  image_url TEXT,
  active_from DATE NOT NULL,
  active_until DATE,
  allow_rating BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create menu_item_prices table (for price history)
CREATE TABLE public.menu_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_date DATE NOT NULL,
  order_time TIME NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ratings table
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  rating_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique index for ratings (one rating per user per item per day)
CREATE UNIQUE INDEX idx_ratings_unique ON public.ratings(user_id, menu_item_id, rating_date);

-- Create settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can do everything on profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for restaurants
CREATE POLICY "Anyone can view active restaurants" ON public.restaurants FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage restaurants" ON public.restaurants FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for menu_items
CREATE POLICY "Anyone can view active menu items" ON public.menu_items FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for menu_item_prices
CREATE POLICY "Anyone can view prices" ON public.menu_item_prices FOR SELECT USING (true);
CREATE POLICY "Admins can manage prices" ON public.menu_item_prices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for orders
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operator', 'admin'))
);
CREATE POLICY "Users and operators can create orders" ON public.orders FOR INSERT WITH CHECK (
  (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operator', 'admin')))
);
CREATE POLICY "Users can update own pending orders" ON public.orders FOR UPDATE USING (
  user_id = auth.uid() AND status = 'pending'
);
CREATE POLICY "Users can delete own pending orders" ON public.orders FOR DELETE USING (
  user_id = auth.uid() AND status = 'pending'
);

-- RLS Policies for order_items
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('operator', 'admin'))))
);
CREATE POLICY "Users can manage order items" ON public.order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid() AND status = 'pending')
);

-- RLS Policies for ratings
CREATE POLICY "Users can view all ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users can create own ratings" ON public.ratings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own ratings" ON public.ratings FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for settings
CREATE POLICY "Anyone can view settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- RLS Policies for activity_logs
CREATE POLICY "Admins can view logs" ON public.activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Anyone can create logs" ON public.activity_logs FOR INSERT WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_profiles_employee_code ON public.profiles(employee_code);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX idx_menu_items_dates ON public.menu_items(active_from, active_until);
CREATE INDEX idx_orders_user_date ON public.orders(user_id, order_date);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_ratings_menu_item ON public.ratings(menu_item_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, employee_code, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'employee_code', 'EMP' || SUBSTRING(NEW.id::text, 1, 8)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'::user_role)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
('order_deadline_time', '"10:00"', 'آخرین زمان ثبت سفارش (فرمت: HH:MM)'),
('max_orders_per_day', '1', 'حداکثر تعداد سفارش در روز برای هر کاربر'),
('max_items_per_category', '{"main": 2, "dessert": 1, "drink": 1, "side": 2}', 'حداکثر تعداد آیتم در هر دسته'),
('system_active', 'true', 'وضعیت فعال بودن سیستم'),
('holidays', '[]', 'لیست تاریخ‌های تعطیل (آرایه از تاریخ‌ها به فرمت YYYY-MM-DD)');