import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatJalaliDate, toGregorianDate, getCurrentJalaliDate } from "@/lib/date-utils";
import { Loader2, Download, Search } from "lucide-react";
import * as XLSX from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Order {
  id: string;
  order_date: string;
  order_time: string;
  total_amount: number;
  status: string;
  user_id: string;
  notes?: string;
  profiles?: {
    full_name?: string;
    employee_code: string;
  };
  order_items?: Array<{
    quantity: number;
    unit_price: number;
    subtotal: number;
    menu_items?: {
      name: string;
      restaurants?: {
        name: string;
      };
    };
  }>;
}

interface Restaurant {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  order_date: string;
  order_time: string;
  order_id: string;
  user_name: string;
  employee_code: string;
  menu_item_name: string;
  restaurant_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status: string;
}

const Reports = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(getCurrentJalaliDate());
  const [toDate, setToDate] = useState(getCurrentJalaliDate());
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [reportType, setReportType] = useState<"orders" | "items">("orders");

  useEffect(() => {
    if (!authLoading && (!user || (profile?.role !== 'operator' && profile?.role !== 'admin'))) {
      navigate('/');
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      toast({
        title: "خطا",
        description: "بارگذاری رستوران‌ها با مشکل مواجه شد",
        variant: "destructive",
      });
    }
  };

  const handleFilter = () => {
    if (!fromDate || !toDate) {
      toast({
        title: "خطا",
        description: "لطفا تاریخ شروع و پایان را وارد کنید",
        variant: "destructive",
      });
      return;
    }
    
    if (reportType === "orders") {
      fetchOrders();
    } else {
      fetchOrderItems();
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const fromGregorian = toGregorianDate(fromDate);
      const toGregorian = toGregorianDate(toDate);

      let query = supabase
        .from('orders')
        .select(`
          id,
          order_date,
          order_time,
          total_amount,
          status,
          user_id,
          notes,
          profiles!orders_user_id_fkey (full_name, employee_code),
          order_items (
            quantity,
            unit_price,
            subtotal,
            menu_items:menu_item_id (
              name,
              restaurants:restaurant_id (name)
            )
          )
        `)
        .gte('order_date', fromGregorian)
        .lte('order_date', toGregorian)
        .order('order_date', { ascending: false })
        .order('order_time', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (selectedRestaurant !== "all") {
        filteredData = filteredData.filter(order => 
          order.order_items?.some(item => 
            item.menu_items?.restaurants?.name === restaurants.find(r => r.id === selectedRestaurant)?.name
          )
        );
      }

      setOrders(filteredData);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "خطا",
        description: "بارگذاری گزارشات با مشکل مواجه شد",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async () => {
    setLoading(true);
    try {
      const fromGregorian = toGregorianDate(fromDate);
      const toGregorian = toGregorianDate(toDate);

      let query = supabase
        .from('order_items')
        .select(`
          id,
          quantity,
          unit_price,
          subtotal,
          orders!inner (
            id,
            order_date,
            order_time,
            status,
            profiles!orders_user_id_fkey (full_name, employee_code)
          ),
          menu_items!inner (
            name,
            restaurants!inner (name)
          )
        `)
        .gte('orders.order_date', fromGregorian)
        .lte('orders.order_date', toGregorian);

      const { data, error } = await query;

      if (error) throw error;

      let items: OrderItem[] = (data || []).map(item => ({
        id: item.id,
        order_id: item.orders.id,
        order_date: item.orders.order_date,
        order_time: item.orders.order_time,
        status: item.orders.status,
        user_name: item.orders.profiles?.full_name || '-',
        employee_code: item.orders.profiles?.employee_code || '-',
        menu_item_name: item.menu_items.name,
        restaurant_name: item.menu_items.restaurants.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      if (selectedRestaurant !== "all") {
        const selectedRestaurantName = restaurants.find(r => r.id === selectedRestaurant)?.name;
        items = items.filter(item => item.restaurant_name === selectedRestaurantName);
      }

      setOrderItems(items);
    } catch (error) {
      console.error('Error fetching order items:', error);
      toast({
        title: "خطا",
        description: "بارگذاری گزارشات با مشکل مواجه شد",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  const totalAmount = reportType === "orders" 
    ? orders.reduce((sum, order) => sum + Number(order.total_amount), 0)
    : orderItems.reduce((sum, item) => sum + Number(item.subtotal), 0);

  const exportOrdersToExcel = () => {
    const exportData = orders.map(order => ({
      'تاریخ': formatJalaliDate(order.order_date),
      'ساعت': order.order_time,
      'کد پرسنلی': order.profiles?.employee_code || '-',
      'نام کاربر': order.profiles?.full_name || '-',
      'غذاها': order.order_items?.map(item => 
        `${item.menu_items?.name} (${item.quantity})`
      ).join(', ') || '-',
      'رستوران‌ها': order.order_items?.map(item => 
        item.menu_items?.restaurants?.name
      ).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '-',
      'وضعیت': order.status === 'confirmed' ? 'تایید شده' : 
               order.status === 'pending' ? 'در انتظار' : 
               order.status === 'cancelled' ? 'لغو شده' : order.status,
      'مبلغ (ریال)': Number(order.total_amount).toLocaleString('fa-IR'),
      'یادداشت': order.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش سفارشات');

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // تاریخ
      { wch: 8 },  // ساعت
      { wch: 12 }, // کد پرسنلی
      { wch: 20 }, // نام کاربر
      { wch: 40 }, // غذاها
      { wch: 20 }, // رستوران‌ها
      { wch: 12 }, // وضعیت
      { wch: 15 }, // مبلغ
      { wch: 30 }, // یادداشت
    ];

    const fileName = `گزارش-سفارشات-${fromDate}-${toDate}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "موفق",
      description: "فایل اکسل با موفقیت دانلود شد",
    });
  };

  const exportItemsToExcel = () => {
    const exportData = orderItems.map(item => ({
      'تاریخ': formatJalaliDate(item.order_date),
      'ساعت': item.order_time,
      'کد پرسنلی': item.employee_code,
      'نام کاربر': item.user_name,
      'نام غذا': item.menu_item_name,
      'رستوران': item.restaurant_name,
      'تعداد': item.quantity,
      'قیمت واحد (ریال)': Number(item.unit_price).toLocaleString('fa-IR'),
      'جمع (ریال)': Number(item.subtotal).toLocaleString('fa-IR'),
      'وضعیت': item.status === 'confirmed' ? 'تایید شده' : 
               item.status === 'pending' ? 'در انتظار' : 
               item.status === 'cancelled' ? 'لغو شده' : item.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'گزارش تفصیلی آیتم‌ها');

    ws['!cols'] = [
      { wch: 12 }, // تاریخ
      { wch: 8 },  // ساعت
      { wch: 12 }, // کد پرسنلی
      { wch: 20 }, // نام کاربر
      { wch: 30 }, // نام غذا
      { wch: 20 }, // رستوران
      { wch: 8 },  // تعداد
      { wch: 15 }, // قیمت واحد
      { wch: 15 }, // جمع
      { wch: 12 }, // وضعیت
    ];

    const fileName = `گزارش-آیتم‌ها-${fromDate}-${toDate}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "موفق",
      description: "فایل اکسل با موفقیت دانلود شد",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">گزارش سفارشات</h1>
          <p className="text-muted-foreground">مشاهده و فیلتر سفارشات</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>فیلترها و نوع گزارش</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-date">از تاریخ</Label>
                <Input
                  id="from-date"
                  type="text"
                  placeholder="1403/09/01"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-date">تا تاریخ</Label>
                <Input
                  id="to-date"
                  type="text"
                  placeholder="1403/09/30"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant">رستوران</Label>
                <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                  <SelectTrigger id="restaurant">
                    <SelectValue placeholder="انتخاب رستوران" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">همه رستوران‌ها</SelectItem>
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-type">نوع گزارش</Label>
                <Select value={reportType} onValueChange={(value: "orders" | "items") => setReportType(value)}>
                  <SelectTrigger id="report-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orders">گزارش سفارشات</SelectItem>
                    <SelectItem value="items">گزارش تفصیلی آیتم‌ها</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleFilter} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  در حال بارگذاری...
                </>
              ) : (
                <>
                  <Search className="ml-2 h-4 w-4" />
                  نمایش گزارش
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {(orders.length > 0 || orderItems.length > 0) && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>خلاصه</CardTitle>
                  <Button 
                    onClick={reportType === "orders" ? exportOrdersToExcel : exportItemsToExcel} 
                    disabled={reportType === "orders" ? orders.length === 0 : orderItems.length === 0}
                  >
                    <Download className="ml-2 h-4 w-4" />
                    خروجی Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {reportType === "orders" ? "تعداد سفارشات" : "تعداد آیتم‌ها"}
                    </p>
                    <p className="text-2xl font-bold">
                      {reportType === "orders" ? orders.length : orderItems.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">مجموع مبلغ</p>
                    <p className="text-2xl font-bold">{totalAmount.toLocaleString('fa-IR')} ریال</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {reportType === "orders" ? (
              <Card>
                <CardHeader>
                  <CardTitle>گزارش سفارشات</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">تاریخ</TableHead>
                        <TableHead className="text-right">ساعت</TableHead>
                        <TableHead className="text-right">کاربر</TableHead>
                        <TableHead className="text-right">غذاها</TableHead>
                        <TableHead className="text-right">وضعیت</TableHead>
                        <TableHead className="text-right">مبلغ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="text-right">
                            {formatJalaliDate(order.order_date)}
                          </TableCell>
                          <TableCell className="text-right">{order.order_time}</TableCell>
                          <TableCell className="text-right">
                            {order.profiles?.full_name || order.profiles?.employee_code || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {order.order_items?.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                {item.menu_items?.name} ({item.quantity})
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="text-right">
                            {order.status === 'confirmed' ? 'تایید شده' : 
                             order.status === 'pending' ? 'در انتظار' : 
                             order.status === 'cancelled' ? 'لغو شده' : order.status}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(order.total_amount).toLocaleString('fa-IR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>گزارش تفصیلی آیتم‌ها</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">تاریخ</TableHead>
                        <TableHead className="text-right">ساعت</TableHead>
                        <TableHead className="text-right">کاربر</TableHead>
                        <TableHead className="text-right">نام غذا</TableHead>
                        <TableHead className="text-right">رستوران</TableHead>
                        <TableHead className="text-right">تعداد</TableHead>
                        <TableHead className="text-right">قیمت واحد</TableHead>
                        <TableHead className="text-right">جمع</TableHead>
                        <TableHead className="text-right">وضعیت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-right">
                            {formatJalaliDate(item.order_date)}
                          </TableCell>
                          <TableCell className="text-right">{item.order_time}</TableCell>
                          <TableCell className="text-right">
                            {item.user_name}
                            <div className="text-xs text-muted-foreground">{item.employee_code}</div>
                          </TableCell>
                          <TableCell className="text-right">{item.menu_item_name}</TableCell>
                          <TableCell className="text-right">{item.restaurant_name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {Number(item.unit_price).toLocaleString('fa-IR')}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.subtotal).toLocaleString('fa-IR')}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.status === 'confirmed' ? 'تایید شده' : 
                             item.status === 'pending' ? 'در انتظار' : 
                             item.status === 'cancelled' ? 'لغو شده' : item.status}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Reports;
