ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON public.stock_movements(user_id);

DROP POLICY IF EXISTS "Demo users can view products" ON public.products;
DROP POLICY IF EXISTS "Demo users can add products" ON public.products;
DROP POLICY IF EXISTS "Demo users can edit products" ON public.products;
DROP POLICY IF EXISTS "Demo users can remove products" ON public.products;
DROP POLICY IF EXISTS "App requests can add products" ON public.products;
DROP POLICY IF EXISTS "App requests can edit products" ON public.products;
DROP POLICY IF EXISTS "App requests can remove products" ON public.products;

DROP POLICY IF EXISTS "Demo users can view stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Demo users can add stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Demo users can edit stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Demo users can remove stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "App requests can add stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "App requests can edit stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "App requests can remove stock movements" ON public.stock_movements;

CREATE POLICY "Users can view own products"
ON public.products FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own products"
ON public.products FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit own products"
ON public.products FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own products"
ON public.products FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own stock movements"
ON public.stock_movements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own stock movements"
ON public.stock_movements FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = stock_movements.product_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can edit own stock movements"
ON public.stock_movements FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = stock_movements.product_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove own stock movements"
ON public.stock_movements FOR DELETE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  product_stock INTEGER;
  new_stock INTEGER;
BEGIN
  SELECT current_stock INTO product_stock
  FROM public.products
  WHERE id = NEW.product_id
    AND user_id = NEW.user_id;

  IF product_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found for this user';
  END IF;

  IF NEW.movement_type = 'stock_in' THEN
    UPDATE public.products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id
      AND user_id = NEW.user_id;
  ELSE
    new_stock := product_stock - NEW.quantity;

    IF new_stock < 0 THEN
      RAISE EXCEPTION 'Stock out quantity cannot be greater than current stock';
    END IF;

    UPDATE public.products
    SET current_stock = new_stock
    WHERE id = NEW.product_id
      AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
