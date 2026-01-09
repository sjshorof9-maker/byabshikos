
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
  onCancel?: () => void;
  logoUrl?: string | null;
}

const Login: React.FC<LoginProps> = ({ onLogin, onCancel }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (email.toLowerCase() === 'ubaidihasan510@gmail.com' && password === '558510') {
        onLogin({ id: '0', businessId: 'system-platform', name: 'Super Admin', email, role: UserRole.SUPER_ADMIN, is_active: true });
        return;
      }

      if (isRegistering) {
        const businessId = `BIZ-${Date.now()}`;
        const userId = `USR-${Date.now()}`;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        // 1. Create Business
        const { error: bizErr } = await supabase.from('businesses').insert({
          id: businessId,
          name: businessName,
          plan: 'trial',
          expires_at: expiryDate.toISOString()
        });

        if (bizErr) throw new Error(bizErr.message);

        // 2. Create User
        const userData = {
          id: userId,
          business_id: businessId,
          name: name,
          email: email.toLowerCase(),
          password: password,
          role: UserRole.OWNER,
          is_active: true
        };

        const { error: userErr } = await supabase.from('users').insert(userData);
        if (userErr) throw new Error(userErr.message);

        onLogin({ ...userData, businessId: businessId } as any as User);
      } else {
        // Login Flow
        const { data: user, error: dbErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase())
          .eq('password', password)
          .maybeSingle();

        if (dbErr) throw new Error(dbErr.message);

        if (user) {
          onLogin({ ...user, businessId: user.business_id } as any as User);
        } else {
          setError('Email বা Password ভুল।');
        }
      }
    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      setError(errMsg);
      console.error("Auth Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05050a] p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-[-20%] left-[-20%] w-[600px] h-[600px] bg-orange-600/10 blur-[150px] rounded-full"></div>
      
      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center">
           <button onClick={onCancel} className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 hover:text-white transition-all bg-white/5 px-6 py-2 rounded-full border border-white/5">← Back to Gateway</button>
        </div>

        <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden text-slate-900">
          <div className="bg-slate-950 p-12 text-white text-center">
            <h1 className="text-4xl font-black tracking-tighter italic uppercase">Byabshik <span className="text-orange-500">OS</span></h1>
            <p className="mt-3 text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] italic">
              {isRegistering ? 'Initialize Cloud Identity' : 'Secure Database Login'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="p-10 space-y-6">
            {isRegistering && (
              <>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Business Name</label>
                  <input required type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-orange-500" placeholder="e.g. My Shop BD" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Owner Name</label>
                  <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-orange-500" placeholder="Full Name" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Email Address</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-orange-500" placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Secret Password</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-orange-500" placeholder="••••••••" />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                <p className="text-rose-500 text-[10px] font-black uppercase text-center whitespace-pre-wrap">{error}</p>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full bg-slate-950 hover:bg-orange-600 text-white font-black py-6 rounded-3xl transition-all shadow-xl uppercase tracking-widest text-[11px] flex items-center justify-center gap-3">
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : isRegistering ? 'Start 7-Day Trial' : 'Login Securely'}
            </button>

            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mt-4 hover:text-slate-900 transition-colors">
              {isRegistering ? 'Existing Merchant? Login' : "New Merchant? Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
