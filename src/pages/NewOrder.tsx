import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { formatJalaliDate, getCurrentJalaliDate } from '@/lib/date-utils';

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

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  name: string;
  category: string;
}

interface Settings {
  order_time_limit?: string;
  max_items_per_category?: Record<string, number>;
}

const categoryNames = {
  main: 'اصلی',
  side: 'جانبی',
  dessert: 'دسر',
  drink: 'نوشیدنی'
};

const NewOrder = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchRestaurantsAndMenu();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value');

      if (error) throw error;

      const settingsObj: Settings = {};
      data?.forEach((setting) => {
        if (setting.key === 'order_time_limit') {
          settingsObj.order_time_limit = setting.value as string;
        } else if (setting.key === 'max_items_per_category') {
          settingsObj.max_items_per_category = setting.value as Record<string, number>;
        }
      });

      setSettings(settingsObj);
    } catch (error: any) {
      console.error(error);
    }
  };

  const fetchRestaurantsAndMenu = async () => {
    try {
      // Fetch active restaurants
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (restaurantsError) throw restaurantsError;
      setRestaurants(restaurantsData || []);

      // Fetch active menu items
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, category, restaurant_id')
        .eq('is_active', true)
        .order('restaurant_id')
        .order('category')
        .order('name');

      if (menuError) throw menuError;

      const menuItemIds = menuData?.map(m => m.id) || [];

      // Fetch prices for menu items
      const { data: prices, error: priceError } = await supabase
        .from('menu_item_prices')
        .select('menu_item_id, price')
        .in('menu_item_id', menuItemIds)
        .lte('effective_from', new Date().toISOString().split('T')[0])
        .order('effective_from', { ascending: false });

      if (priceError) throw priceError;

      // Get latest price for each item
      const priceMap = new Map<string, number>();
      prices?.forEach(p => {
        if (!priceMap.has(p.menu_item_id)) {
          priceMap.set(p.menu_item_id, p.price);
        }
      });

      // Add restaurant names and prices to menu items
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
    } catch (error: any) {
      toast.error('خطا در بارگذاری منو');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkCategoryLimit = (category: string, currentQuantity: number): boolean => {
    if (!settings.max_items_per_category) return true;

    const limit = settings.max_items_per_category[category];
    if (!limit) return true;

    const currentTotal = orderItems
      .filter(item => item.category === category)
      .reduce((sum, item) => sum + item.quantity, 0);

    return currentTotal + currentQuantity <= limit;
  };

  const handleAddItem = () => {
    if (!selectedMenuItem) {
      toast.error('لطفاً یک آیتم انتخاب کنید');
      return;
    }

    if (quantity < 1) {
      toast.error('تعداد باید حداقل 1 باشد');
      return;
    }

    const menuItem = menuItems.find(item => item.id === selectedMenuItem);
    if (!menuItem) return;

    if (!menuItem.price) {
      toast.error('قیمت این آیتم تعریف نشده است');
      return;
    }

    if (!checkCategoryLimit(menuItem.category, quantity)) {
      const limit = settings.max_items_per_category?.[menuItem.category];
      toast.error(`حداکثر تعداد آیتم از دسته ${categoryNames[menuItem.category as keyof typeof categoryNames]}: ${limit}`);
      return;
    }

    const existingItemIndex = orderItems.findIndex(item => item.menu_item_id === selectedMenuItem);

    if (existingItemIndex >= 0) {
      const newQuantity = orderItems[existingItemIndex].quantity + quantity;
      
      if (!checkCategoryLimit(menuItem.category, quantity)) {
        const limit = settings.max_items_per_category?.[menuItem.category];
        toast.error(`حداکثر تعداد آیتم از دسته ${categoryNames[menuItem.category as keyof typeof categoryNames]}: ${limit}`);
        return;
      }

      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: newQuantity,
        subtotal: newQuantity * menuItem.price
      };
      setOrderItems(updatedItems);
    } else {
      setOrderItems([
        ...orderItems,
        {
          menu_item_id: selectedMenuItem,
          quantity,
          unit_price: menuItem.price,
          subtotal: quantity * menuItem.price,
          name: menuItem.name,
          category: menuItem.category
        }
      ]);
    }

    setSelectedMenuItem('');
    setQuantity(1);
    toast.success('آیتم به سفارش اضافه شد');
  };

  const handleRemoveItem = (menuItemId: string) => {
    setOrderItems(orderItems.filter(item => item.menu_item_id !== menuItemId));
    toast.success('آیتم از سفارش حذف شد');
  };

  const handleSubmitOrder = async () => {
    if (orderItems.length === 0) {
      toast.error('سفارش خالی است');
      return;
    }

    try {
      const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const now = new Date();

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id,
          order_date: now.toISOString().split('T')[0],
          order_time: now.toTimeString().split(' ')[0],
          total_amount: totalAmount,
          status: 'pending',
          created_by: user?.id
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(
          orderItems.map(item => ({
            order_id: order.id,
            menu_item_id: item.menu_item_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal
          }))
        );

      if (itemsError) throw itemsError;

      toast.success('سفارش با موفقیت ثبت شد');
      navigate('/');
    } catch (error: any) {
      toast.error('خطا در ثبت سفارش');
      console.error(error);
    }
  };

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

  const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ثبت سفارش جدید</h1>
          <p className="text-muted-foreground mt-1">تاریخ: {getCurrentJalaliDate()}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>آیتم‌های سفارش</CardTitle>
              <CardDescription>آیتم‌های خود را از منوی امروز انتخاب کنید</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2 space-y-2">
                  <Label>آیتم غذایی</Label>
                  <Select value={selectedMenuItem} onValueChange={setSelectedMenuItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب آیتم" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map((restaurant) => {
                        const restaurantItems = menuItems.filter(
                          item => item.restaurant_id === restaurant.id
                        );
                        
                        if (restaurantItems.length === 0) return null;

                        const itemsByCategory = restaurantItems.reduce((acc, item) => {
                          if (!acc[item.category]) acc[item.category] = [];
                          acc[item.category].push(item);
                          return acc;
                        }, {} as Record<string, MenuItem[]>);

                        return (
                          <React.Fragment key={restaurant.id}>
                            <SelectItem value={`rest-${restaurant.id}`} disabled className="font-bold">
                              🏪 {restaurant.name}
                            </SelectItem>
                            {Object.entries(itemsByCategory).map(([category, items]) => (
                              <React.Fragment key={`${restaurant.id}-${category}`}>
                                <SelectItem value={`cat-${restaurant.id}-${category}`} disabled className="pr-4">
                                  📁 {categoryNames[category as keyof typeof categoryNames]}
                                </SelectItem>
                                {items.map((item) => (
                                  <SelectItem key={item.id} value={item.id} className="pr-8">
                                    {item.name} - {item.price?.toLocaleString() || 0} تومان
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>تعداد</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <Button onClick={handleAddItem} className="w-full">
                <Plus className="ml-2 h-4 w-4" />
                افزودن به سفارش
              </Button>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نام</TableHead>
                      <TableHead>دسته</TableHead>
                      <TableHead>قیمت واحد</TableHead>
                      <TableHead>تعداد</TableHead>
                      <TableHead>جمع</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          هیچ آیتمی انتخاب نشده است
                        </TableCell>
                      </TableRow>
                    ) : (
                      orderItems.map((item) => (
                        <TableRow key={item.menu_item_id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            {categoryNames[item.category as keyof typeof categoryNames]}
                          </TableCell>
                          <TableCell>{item.unit_price.toLocaleString()} تومان</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.subtotal.toLocaleString()} تومان</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(item.menu_item_id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>خلاصه سفارش</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">تعداد آیتم‌ها</span>
                  <span>{orderItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>مجموع</span>
                  <span>{totalAmount.toLocaleString()} تومان</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmitOrder}
                disabled={orderItems.length === 0}
              >
                <ShoppingCart className="ml-2 h-5 w-5" />
                ثبت سفارش
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default NewOrder;