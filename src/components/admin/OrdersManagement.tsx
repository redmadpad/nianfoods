import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { toast } from 'sonner';
import { formatJalaliDate } from '@/lib/date-utils';
import { Trash2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Order {
  id: string;
  user_id: string;
  order_date: string;
  order_time: string;
  total_amount: number;
  status: string;
  notes: string | null;
  profiles: {
    full_name: string | null;
    employee_code: string;
  } | null;
}


export const OrdersManagement = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(order => order.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, employee_code')
          .in('id', userIds);

        const profilesMap = new Map(
          profilesData?.map(p => [p.id, p]) || []
        );

        const ordersWithProfiles = data.map(order => ({
          ...order,
          profiles: profilesMap.get(order.user_id) || null,
        }));

        setOrders(ordersWithProfiles as Order[]);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('خطا در دریافت لیست سفارش‌ها');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('آیا از حذف این سفارش اطمینان دارید؟')) return;

    try {
      // Delete order items first
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;

      // Delete order
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (orderError) throw orderError;

      toast.success('سفارش حذف شد');
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('خطا در حذف سفارش');
    }
  };


  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">لیست سفارش‌ها</h3>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کاربر</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead>ساعت</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>یادداشت</TableHead>
              <TableHead className="text-left">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  سفارشی یافت نشد
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const profile = order.profiles;
                
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {profile?.full_name || profile?.employee_code || '-'}
                        </div>
                        {profile?.full_name && (
                          <div className="text-xs text-muted-foreground">
                            {profile?.employee_code}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatJalaliDate(order.order_date)}</TableCell>
                    <TableCell>{order.order_time}</TableCell>
                    <TableCell>{order.total_amount.toLocaleString()} تومان</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {order.notes || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/new-order?orderId=${order.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOrder(order.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
