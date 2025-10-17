import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

const statusOptions = [
  { value: 'pending', label: 'در انتظار تایید', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', label: 'تایید شده', color: 'bg-blue-100 text-blue-800' },
  { value: 'preparing', label: 'در حال آماده‌سازی', color: 'bg-purple-100 text-purple-800' },
  { value: 'ready', label: 'آماده تحویل', color: 'bg-green-100 text-green-800' },
  { value: 'delivered', label: 'تحویل داده شده', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelled', label: 'لغو شده', color: 'bg-red-100 text-red-800' },
];

export const OrdersManagement = () => {
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

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus as any })
        .eq('id', orderId);

      if (error) throw error;
      toast.success('وضعیت سفارش به‌روزرسانی شد');
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('خطا در به‌روزرسانی وضعیت');
    }
  };

  const getStatusInfo = (status: string) => {
    return statusOptions.find(s => s.value === status) || statusOptions[0];
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
              <TableHead>وضعیت</TableHead>
              <TableHead>یادداشت</TableHead>
              <TableHead className="text-left">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  سفارشی یافت نشد
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
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
                    <TableCell>{order.order_date}</TableCell>
                    <TableCell>{order.order_time}</TableCell>
                    <TableCell>{order.total_amount.toLocaleString()} تومان</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {order.notes || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-left">
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
