import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Lock } from 'lucide-react';

const Profile = () => {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setBirthDate(profile.birth_date || '');
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          address,
          birth_date: birthDate || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();

      toast({
        title: 'موفق',
        description: 'اطلاعات پروفایل با موفقیت ذخیره شد',
      });
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message || 'خطا در ذخیره اطلاعات',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'خطا',
        description: 'رمز عبور جدید و تکرار آن یکسان نیستند',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'خطا',
        description: 'رمز عبور باید حداقل ۶ کاراکتر باشد',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'موفق',
        description: 'رمز عبور با موفقیت تغییر کرد',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.message || 'خطا در تغییر رمز عبور',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">پروفایل کاربری</h1>
          <p className="text-muted-foreground mt-1">مدیریت اطلاعات شخصی و تنظیمات حساب</p>
        </div>

        <Tabs defaultValue="profile" dir="rtl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">
              <User className="ml-2 h-4 w-4" />
              اطلاعات شخصی
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="ml-2 h-4 w-4" />
              امنیت
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>اطلاعات شخصی</CardTitle>
                <CardDescription>
                  اطلاعات پروفایل خود را مدیریت کنید
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="employee-code">کد پرسنلی</Label>
                      <Input
                        id="employee-code"
                        value={profile.employee_code}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">ایمیل</Label>
                      <Input
                        id="email"
                        type="email"
                        value={user.email || ''}
                        disabled
                        className="bg-muted"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="full-name">نام و نام خانوادگی</Label>
                      <Input
                        id="full-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="نام کامل خود را وارد کنید"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="birth-date">تاریخ تولد</Label>
                      <Input
                        id="birth-date"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">شماره موبایل</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09xxxxxxxxx"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">آدرس</Label>
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="آدرس کامل خود را وارد کنید"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving}>
                    {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>تغییر رمز عبور</CardTitle>
                <CardDescription>
                  برای امنیت بیشتر، رمز عبور قوی انتخاب کنید
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">رمز عبور جدید</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">تکرار رمز عبور جدید</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      dir="ltr"
                    />
                  </div>

                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword ? 'در حال تغییر...' : 'تغییر رمز عبور'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Profile;
