-- Drop the existing INSERT policy for orders
DROP POLICY IF EXISTS "Users and operators can create orders" ON public.orders;

-- Create new INSERT policy using security definer function
CREATE POLICY "Users and operators can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (
  (user_id = auth.uid()) OR 
  (get_user_role(auth.uid()) IN ('operator', 'admin'))
);