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
import { Loader2 } from "lucide-react";

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

const Reports = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(getCurrentJalaliDate());
  const [toDate, setToDate] = useState(getCurrentJalaliDate());
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && (!user || (profile?.role !== 'operator' && profile?.role !== 'admin'))) {
      navigate('/');
    }
  }, [user, profile, authLoading, navigate]);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      fetchOrders();
    }
  }, [fromDate, toDate, selectedRestaurant]);

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

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">گزارش سفارشات</h1>
          <p className="text-muted-foreground">مشاهده و فیلتر سفارشات</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>فیلترها</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>خلاصه</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">تعداد سفارشات</p>
                <p className="text-2xl font-bold">{orders.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">مجموع مبلغ</p>
                <p className="text-2xl font-bold">{totalAmount.toLocaleString('fa-IR')} ریال</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>سفارشات</CardTitle>
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
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      سفارشی یافت نشد
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Reports;
