import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ShoppingCart, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price?: number;
  restaurant_id: string;
  restaurant_name?: string;
}

interface Restaurant {
  id: string;
  name: string;
}

interface SelectedItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Settings {
  order_deadline_time?: string;
  max_items_per_category?: Record<string, number>;
}

const categoryLabels: Record<string, string> = {
  main: 'غذای اصلی',
  side: 'پیش غذا',
  dessert: 'دسر',
  drink: 'نوشیدنی'
};

const NewOrder = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchSettings(),
        fetchRestaurantsAndMenu(),
        ...(orderId ? [fetchExistingOrder()] : [])
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');

      if (error) throw error;

      const settingsObj: Settings = {};
      data?.forEach((setting) => {
        if (setting.key === 'order_deadline_time') {
          settingsObj.order_deadline_time = setting.value as string;
        } else if (setting.key === 'max_items_per_category') {
          settingsObj.max_items_per_category = setting.value as Record<string, number>;
        }
      });

      setSettings(settingsObj);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchExistingOrder = async () => {
    if (!orderId) return;

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch menu item details
      const menuItemIds = order.order_items?.map((item: any) => item.menu_item_id) || [];
      
      if (menuItemIds.length > 0) {
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('id, name, category')
          .in('id', menuItemIds);

        if (menuError) throw menuError;

        const items: SelectedItem[] = order.order_items?.map((item: any) => {
          const menuItem = menuData?.find(m => m.id === item.menu_item_id);
          return {
            id: item.menu_item_id,
            name: menuItem?.name || '',
            category: menuItem?.category || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          };
        }) || [];

        setSelectedItems(items);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('خطا در بارگذاری سفارش');
    }
  };

  const fetchRestaurantsAndMenu = async () => {
    try {
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (restaurantsError) throw restaurantsError;
      setRestaurants(restaurantsData || []);

      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, category, restaurant_id')
        .eq('is_active', true)
        .order('restaurant_id')
        .order('category')
        .order('name');

      if (menuError) throw menuError;

      const menuItemIds = menuData?.map(m => m.id) || [];

      const { data: prices, error: priceError } = await supabase
        .from('menu_item_prices')
        .select('menu_item_id, price')
        .in('menu_item_id', menuItemIds)
        .lte('effective_from', new Date().toISOString().split('T')[0])
        .order('effective_from', { ascending: false });

      if (priceError) throw priceError;

      const priceMap = new Map<string, number>();
      prices?.forEach(p => {
        if (!priceMap.has(p.menu_item_id)) {
          priceMap.set(p.menu_item_id, p.price);
        }
      });

      const items: MenuItem[] = menuData?.map(m => {
        const restaurant = restaurantsData?.find(r => r.id === m.restaurant_id);
        return {
          id: m.id,
          name: m.name,
          category: m.category,
          restaurant_id: m.restaurant_id,
          restaurant_name: restaurant?.name,
          price: priceMap.get(m.id)
        };
      }) || [];

      setMenuItems(items);
    } catch (error) {
      console.error('Error fetching menu:', error);
      toast.error('خطا در بارگذاری منو');
    }
  };

  const getCategoryLabel = (category: string) => categoryLabels[category] || category;

  const handleAddItem = (itemId: string) => {
    const item = menuItems.find(m => m.id === itemId);
    if (!item || !item.price) return;

    const categoryCount = selectedItems.filter(i => i.category === item.category).reduce((sum, i) => sum + i.quantity, 0);
    const maxForCategory = settings.max_items_per_category?.[item.category] || 0;
    
    if (maxForCategory > 0 && categoryCount >= maxForCategory) {
      toast.error(`حداکثر ${maxForCategory} مورد از دسته ${getCategoryLabel(item.category)} مجاز است`);
      return;
    }

    const existingItemIndex = selectedItems.findIndex(i => i.id === itemId);
    
    if (existingItemIndex >= 0) {
      const newSelectedItems = [...selectedItems];
      newSelectedItems[existingItemIndex].quantity += 1;
      newSelectedItems[existingItemIndex].subtotal = 
        newSelectedItems[existingItemIndex].quantity * newSelectedItems[existingItemIndex].unit_price;
      setSelectedItems(newSelectedItems);
    } else {
      const newItem = {
        id: itemId,
        name: item.name,
        category: item.category,
        quantity: 1,
        unit_price: item.price,
        subtotal: item.price,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const itemIndex = selectedItems.findIndex(i => i.id === itemId);
    if (itemIndex < 0) return;

    const item = selectedItems[itemIndex];

    if (item.quantity > 1) {
      const newSelectedItems = [...selectedItems];
      newSelectedItems[itemIndex].quantity -= 1;
      newSelectedItems[itemIndex].subtotal = 
        newSelectedItems[itemIndex].quantity * newSelectedItems[itemIndex].unit_price;
      setSelectedItems(newSelectedItems);
    } else {
      const newSelectedItems = selectedItems.filter(i => i.id !== itemId);
      setSelectedItems(newSelectedItems);
    }
  };

  const handleSubmitOrder = async () => {
    if (selectedItems.length === 0) {
      toast.error('لطفاً حداقل یک آیتم انتخاب کنید');
      return;
    }

    // Check time limit
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
    if (settings.order_deadline_time && currentTime > settings.order_deadline_time) {
      toast.error(`زمان ثبت سفارش تا ساعت ${settings.order_deadline_time} است`);
      return;
    }

    try {
      const totalAmount = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const currentDate = new Date().toISOString().split('T')[0];
      const currentTimeStr = now.toTimeString().split(' ')[0];

      if (orderId) {
        // Update existing order - first set to pending to allow order_items modifications
        const { error: pendingError } = await supabase
          .from('orders')
          .update({ status: 'pending' })
          .eq('id', orderId);

        if (pendingError) throw pendingError;

        // Delete old order items
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);

        if (deleteError) throw deleteError;

        // Insert new order items
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(
            selectedItems.map(item => ({
              order_id: orderId,
              menu_item_id: item.id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
            }))
          );

        if (itemsError) throw itemsError;

        // Update total and confirm the order
        const { error: orderError } = await supabase
          .from('orders')
          .update({ 
            total_amount: totalAmount,
            status: 'confirmed'
          })
          .eq('id', orderId);

        if (orderError) throw orderError;

        toast.success('تغییرات سفارش با موفقیت ذخیره شد');
      } else {
        // Create new order with pending status first
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert([{
            user_id: user?.id,
            order_date: currentDate,
            order_time: currentTimeStr,
            total_amount: totalAmount,
            status: 'pending',
            created_by: user?.id,
          }])
          .select()
          .single();

        if (orderError) throw orderError;

        // Insert order items while order is pending
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(
            selectedItems.map(item => ({
              order_id: newOrder.id,
              menu_item_id: item.id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              subtotal: item.subtotal,
            }))
          );

        if (itemsError) throw itemsError;

        // Now confirm the order
        const { error: confirmError } = await supabase
          .from('orders')
          .update({ status: 'confirmed' })
          .eq('id', newOrder.id);

        if (confirmError) throw confirmError;

        toast.success('سفارش شما با موفقیت ثبت شد');
      }

      navigate('/');
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('خطا در ثبت سفارش');
    }
  };

  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.restaurant_id]) {
      acc[item.restaurant_id] = {
        restaurant: restaurants.find(r => r.id === item.restaurant_id),
        categories: {}
      };
    }

    if (!acc[item.restaurant_id].categories[item.category]) {
      acc[item.restaurant_id].categories[item.category] = [];
    }

    acc[item.restaurant_id].categories[item.category].push(item);
    return acc;
  }, {} as Record<string, { restaurant?: Restaurant; categories: Record<string, MenuItem[]> }>);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">در حال بارگذاری...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const totalAmount = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{orderId ? 'ویرایش سفارش' : 'ثبت سفارش جدید'}</h1>
            <p className="text-muted-foreground mt-1">
              {settings.order_deadline_time && `مهلت ثبت سفارش: ${settings.order_deadline_time}`}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            بازگشت به داشبورد
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>انتخاب غذا</CardTitle>
              <CardDescription>آیتم‌های مورد نظر خود را انتخاب کنید</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {Object.entries(groupedMenuItems).map(([restaurantId, { restaurant, categories }]) => (
                  <div key={restaurantId} className="space-y-2">
                    <h3 className="font-bold text-lg">{restaurant?.name}</h3>
                    {Object.entries(categories).map(([category, items]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground">
                          {getCategoryLabel(category)}
                        </h4>
                        <div className="space-y-1">
                          {items.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                              onClick={() => handleAddItem(item.id)}
                            >
                              <div className="flex-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {item.price?.toLocaleString()} تومان
                                </p>
                              </div>
                              <Plus className="h-4 w-4 text-primary" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                سبد سفارش
              </CardTitle>
              <CardDescription>
                {selectedItems.length} آیتم - مجموع: {totalAmount.toLocaleString()} تومان
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  سبد خرید خالی است
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.unit_price.toLocaleString()} × {item.quantity} = {item.subtotal.toLocaleString()} تومان
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddItem(item.id)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-lg">مجموع:</span>
                      <span className="font-bold text-lg">{totalAmount.toLocaleString()} تومان</span>
                    </div>
                    <Button 
                      onClick={handleSubmitOrder}
                      disabled={selectedItems.length === 0}
                      className="w-full"
                    >
                      {orderId ? 'ذخیره تغییرات' : 'ثبت سفارش'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default NewOrder;