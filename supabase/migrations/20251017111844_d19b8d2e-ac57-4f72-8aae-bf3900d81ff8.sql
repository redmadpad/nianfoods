-- Create weekly meal plan table
CREATE TABLE public.weekly_meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(week_start_date, day_of_week, menu_item_id)
);

-- Enable RLS
ALTER TABLE public.weekly_meal_plans ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view weekly meal plans"
ON public.weekly_meal_plans
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage weekly meal plans"
ON public.weekly_meal_plans
FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.role = 'admin'::user_role
));

-- Create trigger for updated_at
CREATE TRIGGER update_weekly_meal_plans_updated_at
BEFORE UPDATE ON public.weekly_meal_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();