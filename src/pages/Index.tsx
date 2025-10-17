import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, Clock, Calendar, TrendingUp } from 'lucide-react';
import { getCurrentJalaliDate } from '@/lib/date-utils';

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const currentDate = getCurrentJalaliDate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
          <Card className="shadow-card hover:shadow-orange transition-smooth cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">سفارش امروز</CardTitle>
              <UtensilsCrossed className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">ثبت نشده</div>
              <p className="text-xs text-muted-foreground mt-1">
                برای ثبت سفارش کلیک کنید
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">آخرین مهلت</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">10:00</div>
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
              <div className="text-2xl font-bold">0</div>
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
              <div className="text-2xl font-bold">0 تومان</div>
              <p className="text-xs text-muted-foreground mt-1">
                ماه جاری
              </p>
            </CardContent>
          </Card>
        </div>

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

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>منوی امروز</CardTitle>
              <CardDescription>رستوران‌ها و غذاهای موجود</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                منویی برای امروز ثبت نشده است
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>آخرین سفارش‌ها</CardTitle>
              <CardDescription>تاریخچه سفارش‌های شما</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                هنوز سفارشی ثبت نکرده‌اید
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
