import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';

interface Profile {
  id: string;
  employee_code: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: 'employee' | 'operator' | 'admin';
  is_active: boolean;
}

export const UsersManagement = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'employee' as 'employee' | 'operator' | 'admin',
  });
  const [isCreating, setIsCreating] = useState(false);

  const createUserSchema = z.object({
    employee_code: z.string().trim().min(1, 'کد پرسنلی الزامی است').max(50, 'کد پرسنلی باید کمتر از 50 کاراکتر باشد'),
    password: z.string().min(6, 'رمز عبور باید حداقل 6 کاراکتر باشد'),
    full_name: z.string().trim().max(100, 'نام باید کمتر از 100 کاراکتر باشد').optional(),
    phone: z.string().trim().max(20, 'شماره تماس باید کمتر از 20 کاراکتر باشد').optional(),
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('خطا در دریافت لیست کاربران');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      if (editingUser) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name || null,
            phone: formData.phone || null,
          })
          .eq('id', editingUser.id);

        if (error) throw error;
        toast.success('کاربر با موفقیت به‌روزرسانی شد');
      } else {
        // Validate form data
        const validation = createUserSchema.safeParse({
          employee_code: formData.employee_code,
          password: formData.password,
          full_name: formData.full_name || undefined,
          phone: formData.phone || undefined,
        });

        if (!validation.success) {
          const firstError = validation.error.errors[0];
          toast.error(firstError.message);
          setIsCreating(false);
          return;
        }

        // Get current session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('لطفاً ابتدا وارد شوید');
          setIsCreating(false);
          return;
        }

        // Call edge function to create user
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            employee_code: formData.employee_code.trim(),
            password: formData.password,
            full_name: formData.full_name.trim() || null,
            phone: formData.phone.trim() || null,
            role: formData.role,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        toast.success('کاربر با موفقیت ایجاد شد');
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'خطا در ذخیره اطلاعات کاربر');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این کاربر اطمینان دارید؟')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('کاربر غیرفعال شد');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('خطا در حذف کاربر');
    }
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      employee_code: user.employee_code,
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: user.role,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      employee_code: '',
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role: 'employee',
    });
  };

  if (loading) {
    return <div className="text-center py-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">لیست کاربران</h3>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="ml-2 h-4 w-4" />
          افزودن کاربر
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کد پرسنلی</TableHead>
              <TableHead>نام کامل</TableHead>
              <TableHead>ایمیل</TableHead>
              <TableHead>شماره تماس</TableHead>
              <TableHead>نقش</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="text-left">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  کاربری یافت نشد
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.employee_code}</TableCell>
                  <TableCell>{user.full_name || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.role === 'admin' ? 'bg-primary/10 text-primary' :
                      user.role === 'operator' ? 'bg-accent/10 text-accent-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {user.role === 'admin' ? 'مدیر' : user.role === 'operator' ? 'اپراتور' : 'کارمند'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'ویرایش کاربر' : 'افزودن کاربر'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'اطلاعات کاربر را ویرایش کنید' : 'اطلاعات کاربر جدید را وارد کنید'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee_code">کد پرسنلی *</Label>
              <Input
                id="employee_code"
                value={formData.employee_code}
                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                disabled={!!editingUser}
                required={!editingUser}
                maxLength={50}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">حداقل 6 کاراکتر</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name">نام کامل</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">شماره تماس</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                maxLength={20}
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="role">نقش</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'employee' | 'operator' | 'admin') => 
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">کارمند</SelectItem>
                    <SelectItem value="operator">اپراتور</SelectItem>
                    <SelectItem value="admin">مدیر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
                disabled={isCreating}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
