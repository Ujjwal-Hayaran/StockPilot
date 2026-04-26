import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Boxes,
  Building2,
  ChevronRight,
  Bell,
  History,
  Loader2,
  LogOut,
  Mail,
  PackagePlus,
  Plus,
  Phone,
  Search,
  RefreshCw,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryChatbot } from "@/components/InventoryChatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Product = Tables<"products">;
type StockMovement = Tables<"stock_movements"> & { products?: Pick<Product, "name"> | null };
type Status = "Safe" | "Low" | "Critical" | "No history";
type TabKey = "dashboard" | "products" | "stock" | "reorder";

const LEAD_TIME_DAYS = 3;
const LOW_BUFFER_DAYS = 7;

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const statusStyles: Record<Status, string> = {
  Safe: "bg-success text-success-foreground border-success",
  Low: "bg-warning text-warning-foreground border-warning",
  Critical: "bg-critical text-critical-foreground border-critical",
  "No history": "bg-muted text-muted-foreground border-border",
};

const surfaceCardClass =
  "border-border/60 bg-card/85 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl";

const insetCardClass = "border-border/60 bg-panel/75 shadow-sm backdrop-blur";

const sidebarCardClass = "border-border/60 bg-card/80 shadow-lg shadow-black/5 backdrop-blur-xl";

const emptyProductForm = {
  name: "",
  category: "",
  price: "",
  current_stock: "",
  supplier_phone: "",
};

const emptyMovementForm = {
  product_id: "",
  movement_type: "stock_out" as "stock_in" | "stock_out",
  quantity: "",
  movement_date: new Date().toISOString().slice(0, 10),
  note: "",
};

type IndexProps = {
  userEmail?: string;
  userId?: string;
};

function getAverageDailyStockOut(productId: string, movements: StockMovement[]) {
  const stockOuts = movements.filter((item) => item.product_id === productId && item.movement_type === "stock_out");
  if (!stockOuts.length) return 0;

  const dates = stockOuts.map((item) => new Date(item.movement_date).getTime());
  const firstDay = Math.min(...dates);
  const today = new Date().setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.ceil((today - firstDay) / 86_400_000) + 1);
  const total = stockOuts.reduce((sum, item) => sum + item.quantity, 0);
  return total / days;
}

function getProductInsight(product: Product, movements: StockMovement[]) {
  const averageDailyStockOut = getAverageDailyStockOut(product.id, movements);
  const daysRemaining = averageDailyStockOut > 0 ? product.current_stock / averageDailyStockOut : Infinity;
  const suggestedReorder = averageDailyStockOut > 0 ? Math.max(0, Math.ceil(averageDailyStockOut * LOW_BUFFER_DAYS - product.current_stock)) : 0;

  let status: Status = "Safe";
  if (averageDailyStockOut === 0) status = product.current_stock === 0 ? "Critical" : "No history";
  else if (product.current_stock === 0 || daysRemaining <= LEAD_TIME_DAYS) status = "Critical";
  else if (daysRemaining <= LOW_BUFFER_DAYS) status = "Low";

  return { averageDailyStockOut, daysRemaining, suggestedReorder, status };
}

function cleanPhone(phone: string | null) {
  return phone?.replace(/[^0-9]/g, "") ?? "";
}

const Index = ({ userEmail, userId }: IndexProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!userId) {
      setProducts([]);
      setMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [productsResult, movementsResult] = await Promise.all([
      supabase.from("products").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase
        .from("stock_movements")
        .select("*, products(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (productsResult.error || movementsResult.error) {
      toast.error("Unable to load inventory data.");
    } else {
      setProducts(productsResult.data ?? []);
      setMovements((movementsResult.data ?? []) as StockMovement[]);
    }
    setLoading(false);
  };

  const openCsvPicker = () => {
    csvInputRef.current?.click();
  };

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!userId) {
      toast.error("No authenticated user found.");
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a CSV file.");
      event.target.value = "";
      return;
    }

    setImporting(true);
    try {
      const csvText = await file.text();
      const rows = csvText
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter((row) => row.length > 0);

      if (rows.length < 2) {
        toast.error("CSV is empty or has no data rows.");
        return;
      }

      const headers = rows[0].split(",").map((header) => header.trim().toLowerCase());
      const nameIdx = headers.indexOf("name");
      const categoryIdx = headers.indexOf("category");
      const priceIdx = headers.indexOf("price");
      const stockIdx = headers.indexOf("current_stock");
      const phoneIdx = headers.indexOf("supplier_phone");

      if (nameIdx < 0 || categoryIdx < 0 || priceIdx < 0 || stockIdx < 0) {
        toast.error("CSV must include: name, category, price, current_stock.");
        return;
      }

      const productsToInsert: TablesInsert<"products">[] = [];
      for (const row of rows.slice(1)) {
        const columns = row.split(",").map((column) => column.trim());
        const name = columns[nameIdx] ?? "";
        const category = columns[categoryIdx] ?? "";
        const price = Number(columns[priceIdx] ?? "");
        const currentStock = Number(columns[stockIdx] ?? "");
        const supplierPhone = phoneIdx >= 0 ? (columns[phoneIdx] || null) : null;

        if (!name || !category || !Number.isFinite(price) || !Number.isFinite(currentStock)) {
          continue;
        }

        productsToInsert.push({
          name,
          category,
          price,
          current_stock: currentStock,
          supplier_phone: supplierPhone,
          user_id: userId,
        });
      }

      if (productsToInsert.length === 0) {
        toast.error("No valid product rows found in CSV.");
        return;
      }

      const { error } = await supabase.from("products").insert(productsToInsert);
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(`Imported ${productsToInsert.length} products.`);
      await loadData();
    } catch {
      toast.error("Unable to import CSV file.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const insights = useMemo(
    () => products.map((product) => ({ product, ...getProductInsight(product, movements) })),
    [products, movements],
  );

  const searchTerm = searchQuery.trim().toLowerCase();

  const filteredInsights = useMemo(() => {
    if (!searchTerm) return insights;
    return insights.filter(({ product }) => {
      const haystack = [product.name, product.category, product.supplier_phone ?? ""].join(" ").toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [insights, searchTerm]);

  const filteredMovements = useMemo(() => {
    if (!searchTerm) return movements;
    return movements.filter((movement) => {
      const haystack = [movement.products?.name ?? "", movement.note ?? "", movement.movement_type, movement.movement_date]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [movements, searchTerm]);

  const filteredUrgent = useMemo(
    () => filteredInsights.filter((item) => item.status === "Critical" || item.status === "Low").slice(0, 5),
    [filteredInsights],
  );

  const topReorder = useMemo(
    () => [...filteredInsights].sort((a, b) => {
      const aScore = a.status === "Critical" ? 2 : a.status === "Low" ? 1 : 0;
      const bScore = b.status === "Critical" ? 2 : b.status === "Low" ? 1 : 0;
      if (bScore !== aScore) return bScore - aScore;
      return a.daysRemaining - b.daysRemaining;
    }).slice(0, 4),
    [filteredInsights],
  );

  const firstUrgent = filteredUrgent[0];

  const barDescriptions: Record<string, string> = {
    S: "Safe Items - Products with healthy stock levels",
    L: "Low Stock - Items that need attention soon",
    C: "Critical Stock - Urgent items running low",
    In: "Stock-ins - Number of incoming shipments",
    Out: "Stock-outs - Number of outgoing shipments",
    A: "Active Alerts - Urgent items requiring reorder",
    R: "Reorder Suggestions - Top priority items to reorder",
    T: "Total Products - Complete inventory count",
  };

  const activityBars = useMemo(() => {
    const safeCount = insights.filter((item) => item.status === "Safe" || item.status === "No history").length;
    const lowCount = insights.filter((item) => item.status === "Low").length;
    const criticalCount = insights.filter((item) => item.status === "Critical").length;
    const stockIns = filteredMovements.filter((movement) => movement.movement_type === "stock_in").length;
    const stockOuts = filteredMovements.filter((movement) => movement.movement_type === "stock_out").length;
    const values = [safeCount, lowCount, criticalCount, stockIns, stockOuts, filteredUrgent.length, topReorder.length, Math.max(1, products.length)];
    const maximum = Math.max(...values, 1);
    return values.map((value, index) => {
      const label = ["S", "L", "C", "In", "Out", "A", "R", "T"][index];
      return {
        value,
        label,
        description: barDescriptions[label],
        height: Math.max(24, Math.round((value / maximum) * 100)),
      };
    });
  }, [filteredMovements, filteredUrgent.length, insights, products.length, topReorder.length]);

  const summary = useMemo(
    () => ({
      total: products.length,
      safe: insights.filter((item) => item.status === "Safe" || item.status === "No history").length,
      low: insights.filter((item) => item.status === "Low").length,
      critical: insights.filter((item) => item.status === "Critical").length,
    }),
    [products.length, insights],
  );

  const handleAddProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      toast.error("No authenticated user found.");
      return;
    }

    setSavingProduct(true);

    const payload: TablesInsert<"products"> = {
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      price: Number(productForm.price),
      current_stock: Number(productForm.current_stock),
      supplier_phone: productForm.supplier_phone.trim() || null,
      user_id: userId,
    };

    const { error } = await supabase.from("products").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Product added.");
      setProductForm(emptyProductForm);
      await loadData();
    }
    setSavingProduct(false);
  };

  const handleAddMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      toast.error("No authenticated user found.");
      return;
    }

    setSavingMovement(true);

    const payload: TablesInsert<"stock_movements"> = {
      product_id: movementForm.product_id,
      movement_type: movementForm.movement_type,
      quantity: Number(movementForm.quantity),
      movement_date: movementForm.movement_date,
      note: movementForm.note.trim() || null,
      user_id: userId,
    };

    const { error } = await supabase.from("stock_movements").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success(movementForm.movement_type === "stock_in" ? "Stock in recorded." : "Stock out recorded.");
      setMovementForm({ ...emptyMovementForm, movement_type: movementForm.movement_type });
      await loadData();
    }
    setSavingMovement(false);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!userId) {
      toast.error("No authenticated user found.");
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", productId).eq("user_id", userId);
    if (error) toast.error(error.message);
    else {
      toast.success("Product deleted.");
      await loadData();
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else toast.success("Signed out successfully.");
  };

  const openWhatsApp = (product: Product, quantity: number) => {
    const phone = cleanPhone(product.supplier_phone);
    if (!phone) return;
    const message = encodeURIComponent(
      `Hello, I would like to order ${quantity} units of ${product.name}. Please confirm availability.`,
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const handleAddProductShortcut = () => setActiveTab("products");

  return (
    <TooltipProvider>
      <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.14),_transparent_34%),radial-gradient(circle_at_top_right,_hsl(var(--accent)/0.14),_transparent_28%),linear-gradient(to_bottom,_hsl(var(--background)),_hsl(var(--background)/0.92))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[linear-gradient(180deg,_hsl(var(--panel)/0.9),_transparent)]" />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)} className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
            <Card className={`${sidebarCardClass} h-full rounded-[28px]`}>
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center gap-3 border-b border-border/60 pb-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold leading-tight">StockPilot</p>
                    <p className="text-xs text-muted-foreground">Inventory command center</p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Menu</p>
                  <TabsList className="mt-3 grid h-auto w-full grid-cols-2 gap-2 rounded-[24px] bg-transparent p-0 lg:grid-cols-1">
                    <TabsTrigger value="dashboard" className="justify-start gap-3 rounded-2xl px-4 py-3">
                      <BarChart3 className="h-4 w-4" />Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="products" className="justify-start gap-3 rounded-2xl px-4 py-3">
                      <Boxes className="h-4 w-4" />Products
                    </TabsTrigger>
                    <TabsTrigger value="stock" className="justify-start gap-3 rounded-2xl px-4 py-3">
                      <History className="h-4 w-4" />Stock In / Out
                    </TabsTrigger>
                    <TabsTrigger value="reorder" className="justify-start gap-3 rounded-2xl px-4 py-3">
                      <ShoppingCart className="h-4 w-4" />Reorder
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="mt-auto rounded-[24px] bg-[linear-gradient(135deg,_hsl(var(--primary))_0%,_hsl(148_58%_16%)_100%)] p-4 text-primary-foreground shadow-lg shadow-primary/20">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/80">AI assistant</p>
                    <p className="text-lg font-semibold">Need a quick stock answer?</p>
                    <p className="text-sm text-primary-foreground/80">Use the floating AI helper for reorder, stock, and trend questions.</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-primary-foreground/80">Always on</span>
                    <Button size="sm" variant="secondary" className="rounded-full bg-white/90 text-foreground hover:bg-white" onClick={() => setActiveTab("dashboard")}>
                      View dashboard
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="min-w-0 space-y-6">
            <Card className="border border-border/60 bg-card/85 shadow-lg shadow-black/5 backdrop-blur-xl">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="relative max-w-2xl">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search products, categories, notes, or dates"
                        className="h-12 rounded-2xl border-border/70 bg-background/80 pl-11 pr-20"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        Ctrl F
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Showing {filteredInsights.length} matched products and {filteredMovements.length} matched movements.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleAddProductShortcut} className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
                      <Plus className="mr-2 h-4 w-4" />Add product
                    </Button>
                    <Button variant="outline" onClick={openCsvPicker} disabled={loading || importing} className="rounded-full border-border/70 bg-background/80 px-5">
                      {loading || importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Import data
                    </Button>
                    <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} />
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full border border-border/70 bg-background/70">
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full border border-border/70 bg-background/70">
                      <Bell className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-3 rounded-full border border-border/70 bg-background/80 px-3 py-2 pr-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">SA</div>
                      <div className="hidden sm:block">
                        <p className="text-sm font-medium leading-tight">Shopkeeper</p>
                        <p className="text-xs text-muted-foreground">{userEmail ?? "No email"}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full border border-border/70"
                        onClick={handleSignOut}
                        aria-label="Sign out"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TabsContent value="dashboard" className="mt-0 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric title="Total Products" value={summary.total} icon={<Boxes className="h-5 w-5" />} />
                <Metric title="Safe Items" value={summary.safe} icon={<BarChart3 className="h-5 w-5" />} />
                <Metric title="Low Stock" value={summary.low} icon={<AlertTriangle className="h-5 w-5" />} />
                <Metric title="Critical Stock" value={summary.critical} icon={<AlertTriangle className="h-5 w-5" />} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr_0.8fr]">
                <Card className={surfaceCardClass}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Inventory analytics</p>
                      <CardTitle className="mt-2 text-xl">Stock pulse</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/70 bg-background/70" onClick={() => setActiveTab("reorder")}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid h-44 grid-cols-8 items-end gap-3">
                      {activityBars.map((bar) => (
                        <Tooltip key={bar.label}>
                          <TooltipTrigger asChild>
                            <div className="flex h-full flex-col items-center gap-2 cursor-help">
                              <div className="flex h-full w-full items-end rounded-full bg-muted/50 p-1">
                                <div
                                  className="w-full rounded-full bg-[linear-gradient(180deg,_hsl(var(--primary))_0%,_hsl(150_54%_32%)_100%)] shadow-[0_10px_30px_hsl(var(--primary)/0.2)]"
                                  style={{ height: `${bar.height}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">{bar.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-slate-900 text-white border-slate-700">
                            <p className="font-semibold">{bar.description}</p>
                            <p className="text-xs text-slate-300 mt-1">Count: {bar.value}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <p className="text-sm text-muted-foreground">Most urgent item</p>
                        <p className="mt-1 text-lg font-semibold">{firstUrgent?.product.name ?? "No urgent item"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {firstUrgent ? `${Number.isFinite(firstUrgent.daysRemaining) ? firstUrgent.daysRemaining.toFixed(1) : "0.0"} days left` : "Inventory is stable right now."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <p className="text-sm text-muted-foreground">Movement trend</p>
                        <p className="mt-1 text-lg font-semibold">{filteredMovements.filter((movement) => movement.movement_type === "stock_out").length} stock-outs</p>
                        <p className="mt-1 text-sm text-muted-foreground">{filteredMovements.filter((movement) => movement.movement_type === "stock_in").length} stock-ins logged</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={surfaceCardClass}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Alerts</p>
                      <CardTitle className="mt-2 text-xl">Reminders</CardTitle>
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-full border border-border/70 bg-background/70" onClick={() => setActiveTab("reorder")}>
                      Review
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {filteredUrgent.length === 0 ? (
                      <EmptyState message="No urgent stock alerts right now." />
                    ) : (
                      <>
                        <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4">
                          <p className="text-sm font-semibold text-primary">{firstUrgent?.product.name ?? "Urgent item"}</p>
                          <p className="mt-2 text-lg font-semibold">{firstUrgent?.status ?? "Low"} stock priority</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {firstUrgent ? `${firstUrgent.product.current_stock} units available · ${Number.isFinite(firstUrgent.daysRemaining) ? `${firstUrgent.daysRemaining.toFixed(1)} days left` : "No stock-out history"}` : "Check reorder suggestions for details."}
                          </p>
                          <Button className="mt-4 w-full rounded-full" onClick={() => setActiveTab("reorder")}>Open reorder list</Button>
                        </div>
                        <div className="space-y-3">
                          {filteredUrgent.slice(0, 4).map(({ product, status, daysRemaining }) => (
                            <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-muted-foreground">{Number.isFinite(daysRemaining) ? `${daysRemaining.toFixed(1)} days left` : "No history available"}</p>
                              </div>
                              <StatusBadge status={status} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className={surfaceCardClass}>
                    <CardHeader>
                      <CardTitle>Project list</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {topReorder.length === 0 ? (
                        <EmptyState message="Add products and record stock out to generate reorder suggestions." />
                      ) : (
                        topReorder.map(({ product, status, suggestedReorder, daysRemaining }) => (
                          <div key={product.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Boxes className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate font-medium">{product.name}</p>
                                <StatusBadge status={status} />
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">Suggested reorder {Math.max(suggestedReorder, 1)} · {Number.isFinite(daysRemaining) ? `${daysRemaining.toFixed(1)} days left` : "No history"}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,_hsl(var(--primary))_0%,_hsl(150_58%_18%)_100%)] text-primary-foreground shadow-2xl shadow-primary/25">
                    <CardContent className="space-y-5 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/75">Restock timer</p>
                          <p className="mt-2 text-2xl font-semibold">{firstUrgent ? firstUrgent.product.name : "All clear"}</p>
                        </div>
                        <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">Live</div>
                      </div>
                      <div>
                        <p className="text-5xl font-semibold tracking-tight">{firstUrgent && Number.isFinite(firstUrgent.daysRemaining) ? firstUrgent.daysRemaining.toFixed(1) : "--"}</p>
                        <p className="mt-1 text-sm text-primary-foreground/80">days remaining until the highest-priority item gets critical</p>
                      </div>
                      <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-primary-foreground/85">
                        {firstUrgent
                          ? `Current stock: ${firstUrgent.product.current_stock} · Suggested reorder: ${Math.max(firstUrgent.suggestedReorder, 1)}`
                          : "No urgent items detected. Record movements to populate this panel."}
                      </div>
                      <Button className="w-full rounded-full bg-white text-foreground hover:bg-white/90" onClick={() => setActiveTab("reorder")}>
                        Review reorder plan
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="products" className="mt-0 grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card className={surfaceCardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" />Add product</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleAddProduct}>
                    <Field label="Product name"><Input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></Field>
                    <Field label="Category"><Input required value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Price"><Input required min="0" step="0.01" type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></Field>
                      <Field label="Current stock"><Input required min="0" step="1" type="number" value={productForm.current_stock} onChange={(e) => setProductForm({ ...productForm, current_stock: e.target.value })} /></Field>
                    </div>
                    <Field label="Supplier phone"><Input value={productForm.supplier_phone} onChange={(e) => setProductForm({ ...productForm, supplier_phone: e.target.value })} placeholder="e.g. 2348012345678" /></Field>
                    <Button className="w-full" disabled={savingProduct}>{savingProduct && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save product</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className={surfaceCardClass}>
                <CardHeader>
                  <CardTitle>Product dashboard</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto pt-0">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-border/70 text-muted-foreground">
                      <tr><th className="py-3">Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Supplier</th><th>Status</th><th className="text-center">Action</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredInsights.length === 0 ? (
                        <tr><td colSpan={7} className="py-8"><EmptyState message={searchTerm ? `No products match "${searchQuery}".` : "Add your first product to begin."} /></td></tr>
                      ) : (
                        filteredInsights.map(({ product, status }) => (
                          <tr key={product.id}>
                            <td className="py-3 font-medium">{product.name}</td>
                            <td>{product.category}</td>
                            <td>{currency.format(product.price)}</td>
                            <td>{product.current_stock}</td>
                            <td>{product.supplier_phone || "Not added"}</td>
                            <td><StatusBadge status={status} /></td>
                            <td className="text-center">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                    <AlertDialogDescription>Are you sure you want to delete "{product.name}"? This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteProduct(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stock" className="mt-0 grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card className={surfaceCardClass}>
                <CardHeader><CardTitle>Record Stock In / Stock Out</CardTitle></CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleAddMovement}>
                    <Field label="Movement type">
                      <Select value={movementForm.movement_type} onValueChange={(value: "stock_in" | "stock_out") => setMovementForm({ ...movementForm, movement_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stock_in">Stock In</SelectItem><SelectItem value="stock_out">Stock Out</SelectItem></SelectContent>
                      </Select>
                    </Field>
                    <Field label="Product">
                      <Select value={movementForm.product_id} onValueChange={(value) => setMovementForm({ ...movementForm, product_id: value })}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Quantity"><Input required min="1" type="number" value={movementForm.quantity} onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })} /></Field>
                      <Field label="Date"><Input required type="date" value={movementForm.movement_date} onChange={(e) => setMovementForm({ ...movementForm, movement_date: e.target.value })} /></Field>
                    </div>
                    <Field label="Note"><Textarea value={movementForm.note} onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })} placeholder="Optional" /></Field>
                    <Button className="w-full" disabled={savingMovement || products.length === 0}>{savingMovement && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record movement</Button>
                  </form>
                </CardContent>
              </Card>

              <Card className={surfaceCardClass}>
                <CardHeader><CardTitle>Stock movement history</CardTitle></CardHeader>
                <CardContent className="space-y-3">{filteredMovements.length === 0 ? <EmptyState message={searchTerm ? `No movement matches "${searchQuery}".` : "Recorded stock in and stock out will appear here."} /> : filteredMovements.map((movement) => <MovementRow key={movement.id} movement={movement} />)}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reorder" className="mt-0 space-y-4">
              {filteredInsights.length === 0 ? (
                <Card className={surfaceCardClass}><CardContent className="py-10"><EmptyState message={searchTerm ? `No reorder matches "${searchQuery}".` : "Add products and record stock out to generate reorder suggestions."} /></CardContent></Card>
              ) : (
                filteredInsights.map(({ product, status, averageDailyStockOut, daysRemaining, suggestedReorder }) => {
                  const phone = cleanPhone(product.supplier_phone);
                  const shouldReorder = status === "Critical" || status === "Low";
                  const quantity = Math.max(suggestedReorder, shouldReorder ? Math.ceil(Math.max(averageDailyStockOut * LOW_BUFFER_DAYS, 1)) : 0);
                  return (
                    <Card key={product.id} className={surfaceCardClass}>
                      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{product.name}</h2><StatusBadge status={status} /></div>
                          <p className="text-sm text-muted-foreground">
                            {averageDailyStockOut === 0 ? "No stock-out history yet — record stock out to generate stronger suggestions." : shouldReorder ? `Reorder ${quantity} units now to avoid stockout in ${daysRemaining.toFixed(1)} days.` : "Stock level is currently safe."}
                          </p>
                          <div className="grid gap-2 text-sm sm:grid-cols-3"><span>Avg daily stock out: <strong>{averageDailyStockOut.toFixed(1)}</strong></span><span>Days remaining: <strong>{Number.isFinite(daysRemaining) ? daysRemaining.toFixed(1) : "—"}</strong></span><span>Suggested reorder: <strong>{quantity || "Not needed"}</strong></span></div>
                        </div>
                        <Button disabled={!phone || quantity === 0} onClick={() => openWhatsApp(product, quantity)} className="w-full lg:w-auto"><Phone className="mr-2 h-4 w-4" />Order via WhatsApp</Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
      <InventoryChatbot products={products} movements={movements} />
    </main>
    </TooltipProvider>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2"><Label>{label}</Label>{children}</div>
);

const Metric = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => (
  <Card className={insetCardClass}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-3xl font-bold">{value}</p></div><div className="rounded-2xl bg-primary/10 p-3 text-primary ring-1 ring-primary/10">{icon}</div></CardContent></Card>
);

const StatusBadge = ({ status }: { status: Status }) => <Badge variant="outline" className={statusStyles[status]}>{status}</Badge>;

const MovementRow = ({ movement }: { movement: StockMovement }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 p-3 transition-colors hover:bg-muted/60">
    <div className="flex items-center gap-3">
      <div className={`rounded-md p-2 ${movement.movement_type === "stock_in" ? "bg-success text-success-foreground" : "bg-critical text-critical-foreground"}`}>{movement.movement_type === "stock_in" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}</div>
      <div><p className="font-medium">{movement.products?.name ?? "Product"}</p><p className="text-sm text-muted-foreground">{movement.movement_type === "stock_in" ? "Stock In" : "Stock Out"} · {movement.movement_date}</p></div>
    </div>
    <p className="font-semibold">{movement.quantity}</p>
  </div>
);

const EmptyState = ({ message }: { message: string }) => <p className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-6 text-center text-sm text-muted-foreground">{message}</p>;

export default Index;