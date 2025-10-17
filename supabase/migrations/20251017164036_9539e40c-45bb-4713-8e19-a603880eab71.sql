-- Create function to update order with new items
CREATE OR REPLACE FUNCTION public.update_order_with_items(
  _order_id uuid,
  _items jsonb,
  _total_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user owns the order
  IF NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE id = _order_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Set order to pending
  UPDATE orders 
  SET status = 'pending'::order_status
  WHERE id = _order_id;

  -- Delete old order items
  DELETE FROM order_items WHERE order_id = _order_id;

  -- Insert new order items
  INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal)
  SELECT 
    _order_id,
    (item->>'menu_item_id')::uuid,
    (item->>'quantity')::integer,
    (item->>'unit_price')::numeric,
    (item->>'subtotal')::numeric
  FROM jsonb_array_elements(_items) AS item;

  -- Update order total and confirm
  UPDATE orders 
  SET total_amount = _total_amount,
      status = 'confirmed'::order_status
  WHERE id = _order_id;
END;
$$;