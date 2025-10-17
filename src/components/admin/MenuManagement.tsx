import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  restaurant_id: string;
  is_active: boolean;
  active_from: string;
  active_until: string | null;
}

interface Restaurant {
  id: string;
  name: string;
}

const categories = [
  { value: 'main', label: 'غذای اصلی' },
  { value: 'side', label: 'پیش غذا' },
  { value: 'dessert', label: 'دسر' },
  { value: 'drink', label: 'نوشیدنی' },
] as const;

export const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    category: 'main' | 'side' | 'dessert' | 'drink';
    restaurant_id: string;
    active_from: string;
    active_until: string;
    price: string;
  }>({
    name: '',
    description: '',
    category: 'main',
    restaurant_id: '',
    active_from: new Date().toISOString().split('T')[0],
    active_until: '',
    price: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [menuResponse, restaurantsResponse] = await Promise.all([
        supabase.from('menu_items').select('*').order('created_at', { ascending: false }),
        supabase.from('restaurants').select('id, name').eq('is_active', true),
      ]);

      if (menuResponse.error) throw menuResponse.error;
      if (restaurantsResponse.error) throw restaurantsResponse.error;

      setMenuItems(menuResponse.data || []);
      setRestaurants(restaurantsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.restaurant_id) {
      toast.error('نام غذا و رستوران الزامی است');
      return;
    }

    try {
      const menuItemData = {
        name: formData.name,
        description: formData.description || null,
        category: formData.category,
        restaurant_id: formData.restaurant_id,
        active_from: formData.active_from,
        active_until: formData.active_until || null,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('menu_items')
          .update(menuItemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        
        // Update price if provided
        if (formData.price) {
          const { error: priceError } = await supabase
            .from('menu_item_prices')
            .insert([{
              menu_item_id: editingItem.id,
              price: parseFloat(formData.price),
              effective_from: new Date().toISOString().split('T')[0],
            }]);

          if (priceError) throw priceError;
        }

        toast.success('آیتم منو با موفقیت به‌روزرسانی شد');
      } else {
        const { data: newItem, error } = await supabase
          .from('menu_items')
          .insert([menuItemData])
          .select()
          .single();

        if (error) throw error;

        // Add price
        if (formData.price && newItem) {
          const { error: priceError } = await supabase
            .from('menu_item_prices')
            .insert([{
              menu_item_id: newItem.id,
              price: parseFloat(formData.price),
              effective_from: new Date().toISOString().split('T')[0],
            }]);

          if (priceError) throw priceError;
        }

        toast.success('آیتم منو با موفقیت اضافه شد');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast.error('خطا در ذخیره اطلاعات');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این آیتم اطمینان دارید؟')) return;

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('آیتم غیرفعال شد');
      fetchData();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      toast.error('خطا در حذف آیتم');
    }
  };

  const openEditDialog = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category as 'main' | 'side' | 'dessert' | 'drink',
      restaurant_id: item.restaurant_id,
      active_from: item.active_from,
      active_until: item.active_until || '',
      price: '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      category: 'main',
      restaurant_id: '',
      active_from: new Date().toISOString().split('T')[0],
      active_until: '',
      price: '',
    });
  };

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">لیست آیتم‌های منو</h3>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="ml-2 h-4 w-4" />
          افزودن آیتم
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام غذا</TableHead>
              <TableHead>دسته‌بندی</TableHead>
              <TableHead>تاریخ شروع</TableHead>
              <TableHead>تاریخ پایان</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="text-left">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {menuItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  آیتمی یافت نشد
                </TableCell>
              </TableRow>
            ) : (
              menuItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    {categories.find(c => c.value === item.category)?.label || item.category}
                  </TableCell>
                  <TableCell>{item.active_from}</TableCell>
                  <TableCell>{item.active_until || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {item.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {item.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'ویرایش آیتم منو' : 'افزودن آیتم منو'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'اطلاعات آیتم را ویرایش کنید' : 'اطلاعات آیتم جدید را وارد کنید'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">نام غذا *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant">رستوران *</Label>
                <Select
                  value={formData.restaurant_id}
                  onValueChange={(value) => setFormData({ ...formData, restaurant_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب رستوران" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">توضیحات</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">دسته‌بندی *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as 'main' | 'side' | 'dessert' | 'drink' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">قیمت (تومان)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="active_from">تاریخ شروع *</Label>
                <Input
                  id="active_from"
                  type="date"
                  value={formData.active_from}
                  onChange={(e) => setFormData({ ...formData, active_from: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="active_until">تاریخ پایان</Label>
                <Input
                  id="active_until"
                  type="date"
                  value={formData.active_until}
                  onChange={(e) => setFormData({ ...formData, active_until: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                انصراف
              </Button>
              <Button type="submit">ذخیره</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
