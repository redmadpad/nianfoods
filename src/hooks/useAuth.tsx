import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  employee_code: string;
  email: string | null;
  full_name: string | null;
  birth_date: string | null;
  phone: string | null;
  address: string | null;
  role?: 'employee' | 'operator' | 'admin'; // Role now fetched separately from user_roles
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (employeeCode: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, employeeCode: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Fetch role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      // Combine profile and role
      setProfile({
        ...profileData,
        role: roleData?.role || 'employee'
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (employeeCode: string, password: string) => {
    try {
      // Convert employee code to internal email format
      const internalEmail = `${employeeCode}@dailyfoods.local`;
      
      // Sign in with the internal email
      const { error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });
      
      if (error) {
        toast({
          title: 'خطا در ورود',
          description: error.message === 'Invalid login credentials' 
            ? 'کد پرسنلی یا رمز عبور اشتباه است'
            : error.message,
          variant: 'destructive',
        });
      }
      
      return { error };
    } catch (err) {
      toast({
        title: 'خطا در ورود',
        description: 'مشکلی در ورود به سیستم پیش آمد',
        variant: 'destructive',
      });
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, employeeCode: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          employee_code: employeeCode,
        },
      },
    });
    
    if (error) {
      let errorMessage = error.message;
      
      if (error.message === 'User already registered') {
        errorMessage = 'این ایمیل قبلاً ثبت شده است';
      } else if (error.message.includes('rate_limit') || error.status === 429) {
        errorMessage = 'لطفاً چند ثانیه صبر کنید و دوباره امتحان کنید';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'لطفاً ایمیل خود را تأیید کنید';
      }
      
      toast({
        title: 'خطا در ثبت‌نام',
        description: errorMessage,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'ثبت‌نام موفق',
        description: 'لطفاً ایمیل خود را برای تأیید حساب کاربری چک کنید',
      });
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    
    toast({
      title: 'خروج موفق',
      description: 'با موفقیت از سیستم خارج شدید',
    });
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
