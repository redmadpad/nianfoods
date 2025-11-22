import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface Settings {
  order_deadline_time?: string;
  max_items_per_category?: {
    main?: number;
    side?: number;
    dessert?: number;
    drink?: number;
  };
}

export const SettingsManagement = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    order_deadline_time: '10:00',
    max_items_per_category: {
      main: 2,
      side: 2,
      dessert: 1,
      drink: 1,
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['order_deadline_time', 'max_items_per_category']);

      if (error) throw error;

      const settingsMap: Settings = {};
      data?.forEach((item) => {
        if (item.key === 'order_deadline_time') {
          settingsMap.order_deadline_time = item.value as string;
        } else if (item.key === 'max_items_per_category') {
          settingsMap.max_items_per_category = item.value as any;
        }
      });

      setSettings((prev) => ({ ...prev, ...settingsMap }));
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('خطا در دریافت تنظیمات');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save order deadline time
      const { error: timeError } = await supabase
        .from('settings')
        .upsert(
          {
            key: 'order_deadline_time',
            value: settings.order_deadline_time,
            description: 'ساعت محدودیت سفارش‌گیری',
          },
          {
            onConflict: 'key',
          }
        );

      if (timeError) throw timeError;

      // Save max items per category
      const { error: itemsError } = await supabase
        .from('settings')
        .upsert(
          {
            key: 'max_items_per_category',
            value: settings.max_items_per_category,
            description: 'حداکثر تعداد آیتم از هر دسته',
          },
          {
            onConflict: 'key',
          }
        );

      if (itemsError) throw itemsError;

      toast.success('تنظیمات با موفقیت ذخیره شد');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('خطا در ذخیره تنظیمات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>زمان‌بندی سفارش</CardTitle>
          <CardDescription>
            تعیین ساعت محدودیت برای ثبت، ویرایش یا حذف سفارش‌ها
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">ساعت محدودیت سفارش‌گیری</Label>
              <Input
                id="deadline"
                type="time"
                value={settings.order_deadline_time}
                onChange={(e) =>
                  setSettings({ ...settings, order_deadline_time: e.target.value })
                }
              />
              <p className="text-sm text-muted-foreground">
                بعد از این ساعت، کاربران نمی‌توانند سفارش جدید ثبت کنند یا سفارش‌های قبلی را ویرایش/حذف کنند
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>محدودیت تعداد آیتم‌ها</CardTitle>
          <CardDescription>
            تعیین حداکثر تعداد آیتم از هر دسته در هر سفارش
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_main">حداکثر غذای اصلی</Label>
              <Input
                id="max_main"
                type="number"
                min="0"
                value={settings.max_items_per_category?.main || 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_items_per_category: {
                      ...settings.max_items_per_category,
                      main: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_side">حداکثر پیش غذا</Label>
              <Input
                id="max_side"
                type="number"
                min="0"
                value={settings.max_items_per_category?.side || 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_items_per_category: {
                      ...settings.max_items_per_category,
                      side: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_dessert">حداکثر دسر</Label>
              <Input
                id="max_dessert"
                type="number"
                min="0"
                value={settings.max_items_per_category?.dessert || 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_items_per_category: {
                      ...settings.max_items_per_category,
                      dessert: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_drink">حداکثر نوشیدنی</Label>
              <Input
                id="max_drink"
                type="number"
                min="0"
                value={settings.max_items_per_category?.drink || 0}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_items_per_category: {
                      ...settings.max_items_per_category,
                      drink: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            مقدار 0 یعنی بدون محدودیت
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="ml-2 h-4 w-4" />
          {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
        </Button>
      </div>
    </div>
  );
};
