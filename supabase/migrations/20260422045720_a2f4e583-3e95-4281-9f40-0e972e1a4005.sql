CREATE TYPE public.stock_movement_type AS ENUM ('stock_in', 'stock_out');

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  supplier_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type public.stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Demo users can view products"
ON public.products FOR SELECT
USING (true);

CREATE POLICY "Demo users can add products"
ON public.products FOR INSERT
WITH CHECK (true);

CREATE POLICY "Demo users can edit products"
ON public.products FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Demo users can remove products"
ON public.products FOR DELETE
USING (true);

CREATE POLICY "Demo users can view stock movements"
ON public.stock_movements FOR SELECT
USING (true);

CREATE POLICY "Demo users can add stock movements"
ON public.stock_movements FOR INSERT
WITH CHECK (true);

CREATE POLICY "Demo users can edit stock movements"
ON public.stock_movements FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Demo users can remove stock movements"
ON public.stock_movements FOR DELETE
USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  new_stock INTEGER;
BEGIN
  IF NEW.movement_type = 'stock_in' THEN
    UPDATE public.products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
  ELSE
    SELECT current_stock - NEW.quantity INTO new_stock
    FROM public.products
    WHERE id = NEW.product_id;

    IF new_stock < 0 THEN
      RAISE EXCEPTION 'Stock out quantity cannot be greater than current stock';
    END IF;

    UPDATE public.products
    SET current_stock = new_stock
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER apply_stock_movement_after_insert
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.apply_stock_movement();

CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_type_date ON public.stock_movements(movement_type, movement_date DESC);