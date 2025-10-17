import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UtensilsCrossed, Clock, Calendar, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { getCurrentJalaliDate, formatJalaliDate } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import moment from 'moment-jalaali';

interface TodayOrder {
  id: string;
  total_amount: number;
  status: string;
  order_items: Array<{
    id: string;
    menu_item_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

interface OrderSummary {
  today_count: number;
  today_amount: number;
  month_count: number;
  month_amount: number;
}

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const currentDate = getCurrentJalaliDate();
  const [todayOrder, setTodayOrder] = useState<TodayOrder | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary>({
    today_count: 0,
    today_amount: 0,
    month_count: 0,
    month_amount: 0
  });
  const [orderTimeLimit, setOrderTimeLimit] = useState<string>('10:00');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTodayOrder();
      fetchOrderSummary();
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'order_time_limit')
        .single();

      if (error) throw error;
      if (data?.value) setOrderTimeLimit(data.value as string);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTodayOrder = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, status, order_items(id, menu_item_id, quantity, unit_price, subtotal)')
        .eq('user_id', user?.id)
        .eq('order_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setTodayOrder(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchOrderSummary = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get Jalali month start
      const jalaliNow = moment();
      const monthStart = jalaliNow.startOf('jMonth').format('YYYY-MM-DD');

      // Today's orders
      const { data: todayData, error: todayError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', user?.id)
        .eq('order_date', today)
        .in('status', ['pending', 'confirmed']);

      if (todayError) throw todayError;

      // Month's orders
      const { data: monthData, error: monthError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('user_id', user?.id)
        .gte('order_date', monthStart)
        .in('status', ['pending', 'confirmed']);

      if (monthError) throw monthError;

      setOrderSummary({
        today_count: todayData?.length || 0,
        today_amount: todayData?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0,
        month_count: monthData?.length || 0,
        month_amount: monthData?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteOrder = async () => {
    if (!todayOrder) return;

    if (!confirm('آیا از حذف سفارش امروز اطمینان دارید؟')) return;

    try {
      // Delete order items first
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', todayOrder.id);

      if (itemsError) throw itemsError;

      // Delete order
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', todayOrder.id);

      if (orderError) throw orderError;

      toast.success('سفارش حذف شد');
      setTodayOrder(null);
      fetchOrderSummary();
    } catch (error: any) {
      toast.error('خطا در حذف سفارش');
      console.error(error);
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold">خوش آمدید، {profile.full_name || profile.employee_code}</h1>
            <p className="text-muted-foreground mt-1">{currentDate}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card 
            className="shadow-card hover:shadow-orange transition-smooth cursor-pointer" 
            onClick={() => navigate(todayOrder ? `/new-order?orderId=${todayOrder.id}` : '/new-order')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">سفارش امروز</CardTitle>
              <UtensilsCrossed className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayOrder ? `${todayOrder.total_amount.toLocaleString()} تومان` : 'ثبت نشده'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {todayOrder ? `${todayOrder.order_items?.length || 0} آیتم - برای ویرایش کلیک کنید` : 'برای ثبت سفارش کلیک کنید'}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">آخرین مهلت</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orderTimeLimit}</div>
              <p className="text-xs text-muted-foreground mt-1">
                صبح امروز
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">سفارش‌های ماه</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orderSummary.month_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                سفارش ثبت شده
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">هزینه ماه</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{orderSummary.month_amount.toLocaleString()} تومان</div>
              <p className="text-xs text-muted-foreground mt-1">
                ماه جاری
              </p>
            </CardContent>
          </Card>
        </div>

        {todayOrder && (
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>سفارش امروز</CardTitle>
                  <CardDescription>وضعیت: {todayOrder.status === 'pending' ? 'در انتظار تایید' : 'تایید شده'}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/new-order?orderId=${todayOrder.id}`)}
                  >
                    <Edit className="ml-2 h-4 w-4" />
                    ویرایش سفارش
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteOrder}>
                    <Trash2 className="ml-2 h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">تعداد آیتم‌ها</p>
                  <p className="text-2xl font-bold">{todayOrder.order_items?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">مجموع</p>
                  <p className="text-2xl font-bold">{todayOrder.total_amount.toLocaleString()} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!todayOrder && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>ثبت سفارش غذا</CardTitle>
              <CardDescription>
                سفارش غذای امروز خود را ثبت کنید
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full md:w-auto shadow-orange" onClick={() => navigate('/new-order')}>
                <UtensilsCrossed className="ml-2 h-4 w-4" />
                ثبت سفارش جدید
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>خلاصه سفارشات</CardTitle>
            <CardDescription>آمار سفارشات روز و ماه جاری</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>دوره</TableHead>
                  <TableHead>تعداد سفارش</TableHead>
                  <TableHead>مجموع هزینه</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">امروز</TableCell>
                  <TableCell>{orderSummary.today_count}</TableCell>
                  <TableCell>{orderSummary.today_amount.toLocaleString()} تومان</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">ماه جاری</TableCell>
                  <TableCell>{orderSummary.month_count}</TableCell>
                  <TableCell>{orderSummary.month_amount.toLocaleString()} تومان</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Index;
