import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings, Home, UtensilsCrossed } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const roleLabel = {
    employee: 'کارمند',
    operator: 'اپراتور',
    admin: 'مدیر ارشد'
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card shadow-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <img src={logo} alt="DailyFoods" className="h-10 w-auto" />
              <span className="text-lg font-bold hidden sm:inline">DailyFoods</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-2">
              <Button
                variant={isActive('/') ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate('/')}
              >
                <Home className="ml-2 h-4 w-4" />
                داشبورد
              </Button>
              
              {profile?.role === 'admin' && (
                <Button
                  variant={isActive('/admin') ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/admin')}
                >
                  <Settings className="ml-2 h-4 w-4" />
                  پنل مدیریت
                </Button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-sm">
              <span className="font-semibold">{profile?.full_name || profile?.employee_code}</span>
              <span className="text-xs text-muted-foreground">{profile?.role && roleLabel[profile.role]}</span>
            </div>
            
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
              <User className="h-4 w-4" />
            </Button>
            
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
