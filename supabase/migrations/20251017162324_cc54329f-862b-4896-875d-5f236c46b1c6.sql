-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own pending orders" ON public.orders;

-- Create new UPDATE policy that allows status change from pending to confirmed
CREATE POLICY "Users can update own pending orders" 
ON public.orders 
FOR UPDATE 
USING (
  (user_id = auth.uid()) AND (status = 'pending'::order_status)
)
WITH CHECK (
  (user_id = auth.uid())
);