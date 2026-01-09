
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface SubscriptionManagerProps {
  businessData: any;
  onRefresh: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ businessData, onRefresh }) => {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [txnId, setTxnId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [adminWallets, setAdminWallets] = useState({ bkash: '01XXXXXXXXX', nagad: '01XXXXXXXXX', rocket: '01XXXXXXXXX' });

  useEffect(() => {
    const fetchAdminWallets = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('courier_config')
          .eq('business_id', 'system-platform')
          .maybeSingle();
        
        if (error) throw error;
        
        if (data?.courier_config) {
          setAdminWallets({
            bkash: data.courier_config.bkash || '01XXXXXXXXX',
            nagad: data.courier_config.nagad || '01XXXXXXXXX',
            rocket: data.courier_config.rocket || '01XXXXXXXXX'
          });
        }
      } catch (e) {
        console.warn("Using default wallets - system config fetch failed", e);
      }
    };
    fetchAdminWallets();
  }, []);

  const plans = [
    { 
      id: 'starter', 
      name: "Starter", 
      price: 250, 
      duration: "প্রতি মাস", 
      durationDays: 30, 
      desc: "ছোট পেজের জন্য সেরা", 
      features: ["Lead Tracking", "Order Management", "Staff Audit", "Financial Reports"] 
    },
    { 
      id: 'business', 
      name: "Business", 
      price: 999, 
      duration: "৬ মাস", 
      durationDays: 180, 
      desc: "Growing online shops", 
      features: ["Lead Tracking", "Order Management", "Staff Audit", "Financial Reports"], 
      recommended: true 
    },
    { 
      id: 'enterprise', 
      name: "Enterprise", 
      price: 2999, 
      duration: "১ বছর", 
      durationDays: 365, 
      desc: "Custom solution", 
      features: ["Lead Tracking", "Order Management", "Staff Audit", "Financial Reports"] 
    }
  ];

  const handleSubmitPayment = async () => {
    if (!paymentPhone || !txnId || !selectedPlan) {
      alert("দয়া করে সব তথ্য প্রদান করুন।");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const updatePayload = {
        transaction_id: txnId.trim().toUpperCase(),
        payment_phone: paymentPhone.trim(),
        selected_plan: String(selectedPlan.id),
        selected_plan_name: String(selectedPlan.name),
        selected_plan_price: Number(selectedPlan.price),
        selected_plan_days: Number(selectedPlan.durationDays)
      };

      const { error } = await supabase.from('businesses').update(updatePayload).eq('id', businessData.id);

      if (error) throw error;
      
      setStep(3);
      onRefresh();
    } catch (err: any) {
      alert("ত্রুটি: পেমেন্ট সাবমিট করা সম্ভব হয়নি। " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!businessData) {
    return <div className="p-20 text-center font-black uppercase text-slate-400">Loading Operational Data...</div>;
  }

  if (businessData?.transaction_id && step !== 3) {
    return (
      <div className="py-20 text-center space-y-8 animate-in fade-in duration-500 bg-white rounded-[3rem] shadow-xl border border-slate-100 mx-auto max-w-2xl">
        <div className="text-8xl mb-6">📡</div>
        <h2 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900">ভেরিফিকেশন পেন্ডিং</h2>
        <p className="text-slate-400 font-bold max-w-md mx-auto italic px-6">
          আপনার <span className="text-indigo-600 font-black">{businessData.selected_plan_name || 'Business'}</span> প্ল্যানটির রিকোয়েস্ট পেন্ডিং আছে।
          অ্যাডমিন ভেরিফাই করলে সার্ভিসটি একটিভ হবে।
        </p>
        <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl inline-block">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TxnID</p>
           <p className="text-xl font-mono font-black text-slate-900">{businessData.transaction_id}</p>
        </div>
        <div className="pt-8">
           <button onClick={() => onRefresh()} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-600 shadow-xl transition-all">চেক স্ট্যাটাস</button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="py-20 text-center space-y-8 animate-in zoom-in-95 duration-500 bg-white rounded-[3rem] shadow-xl border border-slate-100 mx-auto max-w-2xl">
        <div className="text-8xl mb-6 animate-bounce">✅</div>
        <h2 className="text-4xl font-black uppercase italic text-emerald-600 tracking-tighter">সাবমিট সফল হয়েছে!</h2>
        <p className="text-slate-400 font-bold italic px-6">১-৩ ঘন্টার মধ্যে আপনার সার্ভিসটি একটিভ হয়ে যাবে।</p>
        <button onClick={() => setStep(1)} className="px-10 py-5 bg-slate-950 text-white rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-2xl">ড্যাশবোর্ডে ফিরে যান</button>
      </div>
    );
  }

  return (
    <div className="space-y-16 pb-40">
      <div className="text-center space-y-4">
        <h2 className="text-6xl font-black uppercase italic tracking-tighter text-slate-900">সাবস্ক্রিপশন <span className="text-indigo-600">প্ল্যান</span></h2>
        <p className="text-slate-400 font-bold italic text-xl">আপনার ব্যবসার জন্য সঠিক প্ল্যানটি বেছে নিন।</p>
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              onClick={() => setSelectedPlan(plan)} 
              className={`p-12 rounded-[4rem] border-4 transition-all cursor-pointer relative group flex flex-col ${selectedPlan?.id === plan.id ? 'border-indigo-600 bg-white shadow-3xl scale-105' : 'bg-white border-slate-100 hover:border-slate-200'}`}
            >
              {plan.recommended && <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Best Value</span>}
              <h3 className="text-2xl font-black uppercase mb-4 italic">{plan.name}</h3>
              <div className="flex items-baseline gap-2 mb-6">
                 <span className="text-5xl font-black italic tracking-tighter text-slate-950">৳{plan.price}</span>
                 <span className="text-slate-400 font-bold text-sm">/ {plan.duration}</span>
              </div>
              <p className="text-slate-400 font-bold italic mb-10 text-sm">{plan.desc}</p>
              <ul className="space-y-4 mb-12 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-3">
                    <span className="w-6 h-6 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center text-xs">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => setStep(2)} className={`w-full py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-xl transition-all ${selectedPlan?.id === plan.id ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-white'}`}>কিনুন এখনই</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-xl mx-auto bg-slate-950 p-12 rounded-[4rem] text-white shadow-3xl space-y-10 border border-white/10 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
           <div className="relative z-10 flex justify-between items-center border-b border-white/5 pb-8">
              <h3 className="text-2xl font-black uppercase italic">পেমেন্ট মেথড</h3>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Selected</p>
                <p className="text-xl font-black text-indigo-400 italic">{selectedPlan.name}</p>
              </div>
           </div>
           
           <div className="space-y-8 relative z-10">
              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
                 <button onClick={() => setPaymentMethod('bkash')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'bkash' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-400'}`}>bKash</button>
                 <button onClick={() => setPaymentMethod('nagad')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'nagad' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400'}`}>Nagad</button>
                 <button onClick={() => setPaymentMethod('rocket')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'rocket' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>Rocket</button>
              </div>

              <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{paymentMethod.toUpperCase()} (Personal)</p>
                   <span className="text-[9px] font-black px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 uppercase tracking-widest">SEND MONEY</span>
                </div>
                <p className="text-4xl font-black font-mono tracking-tighter text-white">{adminWallets[paymentMethod]}</p>
                <p className="text-[9px] font-bold text-slate-500 italic uppercase">উপরের নম্বরে টাকা পাঠিয়ে নিচের ঘরে তথ্য দিন।</p>
              </div>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">আপনার ফোন নম্বর</label>
                    <input type="text" placeholder="01XXXXXXXXX" value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)} className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 font-black text-xl tracking-widest text-white" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">ট্রানজেকশন আইডি (TxnID)</label>
                    <input type="text" placeholder="8X2K9L..." value={txnId} onChange={(e) => setTxnId(e.target.value)} className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-indigo-500 font-black text-xl tracking-widest text-white uppercase" />
                 </div>
              </div>

              <div className="flex flex-col gap-4">
                <button onClick={handleSubmitPayment} disabled={isSubmitting} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-widest shadow-2xl active:scale-95 transition-all">
                  {isSubmitting ? 'প্রসেসিং...' : 'সাবমিট করুন 🚀'}
                </button>
                <button onClick={() => setStep(1)} className="w-full py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors italic text-center">বাতিল করুন</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
