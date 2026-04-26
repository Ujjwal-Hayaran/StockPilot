DROP POLICY IF EXISTS "Demo users can add products" ON public.products;
DROP POLICY IF EXISTS "Demo users can edit products" ON public.products;
DROP POLICY IF EXISTS "Demo users can remove products" ON public.products;
DROP POLICY IF EXISTS "Demo users can add stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Demo users can edit stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Demo users can remove stock movements" ON public.stock_movements;

CREATE POLICY "App requests can add products"
ON public.products FOR INSERT
WITH CHECK ((auth.role() = 'anon') OR (auth.role() = 'authenticated'));

CREATE POLICY "App requests can edit products"
ON public.products FOR UPDATE
USING ((auth.role() = 'anon') OR (auth.role() = 'authenticated'))
WITH CHECK ((auth.role() = 'anon') OR (auth.role() = 'authenticated'));

CREATE POLICY "App requests can remove products"
ON public.products FOR DELETE
USING ((auth.role() = 'anon') OR (auth.role() = 'authenticated'));

CREATE POLICY "App requests can add stock movements"
ON public.stock_movements FOR INSERT
WITH CHECK ((auth.role() = 'anon') OR (auth.role() = 'authenticated'));

CREATE POLICY "App requests can edit stock movements"
ON public.stock_movements FOR UPDATE
USING ((auth.role() = 'anon') OR (auth.role() = 'authenticated'))
WITH CHECK ((auth.role() = 'anon') OR (auth.role() = 'authenticated'));

CREATE POLICY "App requests can remove stock movements"
ON public.stock_movements FOR DELETE
USING ((auth.role() = 'anon') OR (auth.role() = 'authenticated'));