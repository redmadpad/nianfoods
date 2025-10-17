import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatJalaliDate, parseJalaliDate } from '@/lib/date-utils';

interface MenuItem {
  id: string;
  name: string;
  category: string;
}

interface WeeklyPlan {
  id: string;
  week_start_date: string;
  day_of_week: number;
  menu_item_id: string;
  menu_items: MenuItem;
}

const dayNames = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
const categoryNames = {
  main: 'اصلی',
  side: 'جانبی',
  dessert: 'دسر',
  drink: 'نوشیدنی'
};

export const WeeklyMenuManagement = () => {
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState('');
  const [selectedDay, setSelectedDay] = useState('0');
  const [selectedMenuItem, setSelectedMenuItem] = useState('');

  useEffect(() => {
    fetchWeeklyPlans();
    fetchMenuItems();
  }, []);

  const fetchWeeklyPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_meal_plans')
        .select(`
          *,
          menu_items (
            id,
            name,
            category
          )
        `)
        .order('week_start_date', { ascending: false })
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      setWeeklyPlans(data || []);
    } catch (error: any) {
      toast.error('خطا در بارگذاری برنامه هفتگی');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!weekStartDate || !selectedMenuItem) {
      toast.error('لطفاً تمام فیلدها را پر کنید');
      return;
    }

    try {
      const gregorianDate = parseJalaliDate(weekStartDate);
      
      const { error } = await supabase
        .from('weekly_meal_plans')
        .insert({
          week_start_date: gregorianDate.toISOString().split('T')[0],
          day_of_week: parseInt(selectedDay),
          menu_item_id: selectedMenuItem
        });

      if (error) throw error;

      toast.success('آیتم به برنامه هفتگی اضافه شد');
      setIsDialogOpen(false);
      setWeekStartDate('');
      setSelectedDay('0');
      setSelectedMenuItem('');
      fetchWeeklyPlans();
    } catch (error: any) {
      toast.error('خطا در افزودن آیتم');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('weekly_meal_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('آیتم حذف شد');
      fetchWeeklyPlans();
    } catch (error: any) {
      toast.error('خطا در حذف آیتم');
      console.error(error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">برنامه غذایی هفتگی</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="ml-2 h-4 w-4" />
              افزودن آیتم
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن آیتم به برنامه هفتگی</DialogTitle>
              <DialogDescription>
                یک آیتم غذایی را برای روز مشخص انتخاب کنید
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>تاریخ شروع هفته (شمسی)</Label>
                <Input
                  type="text"
                  placeholder="1403/10/15"
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>روز هفته</Label>
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب روز" />
                  </SelectTrigger>
                  <SelectContent>
                    {dayNames.map((day, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>آیتم غذایی</Label>
                <Select value={selectedMenuItem} onValueChange={setSelectedMenuItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب آیتم" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(
                      menuItems.reduce((acc, item) => {
                        if (!acc[item.category]) acc[item.category] = [];
                        acc[item.category].push(item);
                        return acc;
                      }, {} as Record<string, MenuItem[]>)
                    ).map(([category, items]) => (
                      <React.Fragment key={category}>
                        <SelectItem value={`cat-${category}`} disabled>
                          {categoryNames[category as keyof typeof categoryNames]}
                        </SelectItem>
                        {items.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            &nbsp;&nbsp;{item.name}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit">افزودن</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>تاریخ شروع هفته</TableHead>
              <TableHead>روز هفته</TableHead>
              <TableHead>آیتم غذایی</TableHead>
              <TableHead>دسته‌بندی</TableHead>
              <TableHead className="text-left">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeklyPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  هیچ برنامه‌ای ثبت نشده است
                </TableCell>
              </TableRow>
            ) : (
              weeklyPlans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{formatJalaliDate(plan.week_start_date)}</TableCell>
                  <TableCell>{dayNames[plan.day_of_week]}</TableCell>
                  <TableCell>{plan.menu_items.name}</TableCell>
                  <TableCell>
                    {categoryNames[plan.menu_items.category as keyof typeof categoryNames]}
                  </TableCell>
                  <TableCell className="text-left">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(plan.id)}
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
    </div>
  );
};