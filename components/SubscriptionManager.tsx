
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
  const [showInvoice, setShowInvoice] = useState(false);
  const [adminWallets, setAdminWallets] = useState({ bkash: '01XXXXXXXXX', nagad: '01XXXXXXXXX', rocket: '01XXXXXXXXX' });

  useEffect(() => {
    const fetchAdminWallets = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('courier_config')
          .eq('business_id', 'system-platform')
          .maybeSingle();
        
        if (data?.courier_config) {
          setAdminWallets({
            bkash: data.courier_config.bkash || '01XXXXXXXXX',
            nagad: data.courier_config.nagad || '01XXXXXXXXX',
            rocket: data.courier_config.rocket || '01XXXXXXXXX'
          });
        }
      } catch (e) {
        console.warn("Using default wallets", e);
      }
    };
    fetchAdminWallets();
  }, []);

  const plans = [
    { id: 'starter', name: "Starter", price: 250, duration: "প্রতি মাস", durationDays: 30, desc: "ছোট পেজের জন্য সেরা", features: ["Lead Tracking", "Order Management", "Staff Audit", "Financial Reports"] },
    { id: 'business', name: "Business", price: 999, duration: "৬ মাস", durationDays: 180, desc: "Growing online shops", features: ["Lead Tracking", "Order Management", "Staff Audit", "Financial Reports"], recommended: true },
    { id: 'enterprise', name: "Enterprise", price: 2999, duration: "১ বছর", durationDays: 365, desc: "Custom solution", features: ["Lead Tracking", "Order Management", "Staff Audit", "Financial Reports"] }
  ];

  const handleSubmitPayment = async () => {
    if (!paymentPhone || !txnId || !selectedPlan) {
      alert("দয়া করে সব তথ্য প্রদান করুন।");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('businesses').update({
        transaction_id: txnId.trim().toUpperCase(),
        payment_phone: paymentPhone.trim(),
        selected_plan: String(selectedPlan.id),
        selected_plan_name: String(selectedPlan.name),
        selected_plan_price: Number(selectedPlan.price),
        selected_plan_days: Number(selectedPlan.durationDays)
      }).eq('id', businessData.id);

      if (error) throw error;
      onRefresh();
      alert("পেমেন্ট তথ্য সাবমিট হয়েছে! অ্যাডমিন ভেরিফাই করলে আপনার একাউন্ট আপডেট হবে।");
      setSelectedPlan(null); // Reset form
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = businessData?.transaction_id && businessData?.plan === 'trial';
  const isPro = businessData?.plan === 'pro';
  const isExpired = businessData?.expires_at && new Date(businessData.expires_at) < new Date();

  const handlePlanClick = (plan: any) => {
    // Prevent selecting the already active plan if it's already pro
    if (isPro && businessData.selected_plan === plan.id) {
      alert("This is your current active plan.");
      return;
    }
    setSelectedPlan(plan);
    // Smooth scroll to form
    setTimeout(() => {
      document.getElementById('payment-terminal')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (showInvoice && isPro) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-500 relative">
        <button onClick={() => setShowInvoice(false)} className="absolute top-10 right-10 text-slate-400 hover:text-slate-900 font-black text-xs uppercase p-2 no-print">Close ✕</button>
        <div className="text-center border-b border-slate-100 pb-10 mb-10">
          <div className="w-20 h-20 bg-slate-950 text-white rounded-3xl flex items-center justify-center text-3xl font-black mx-auto mb-6 shadow-xl shadow-slate-900/20">BY</div>
          <h2 className="text-3xl font-black tracking-tighter uppercase italic text-slate-900 leading-none">Subscription Invoice</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">Authorized Digital Receipt</p>
        </div>
        
        <div className="space-y-6">
          <div className="flex justify-between border-b border-slate-50 pb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Merchant Name</span>
            <span className="text-sm font-black text-slate-950 uppercase italic">{businessData.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-50 pb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan Node</span>
            <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">Verified Pro Active</span>
          </div>
          <div className="flex justify-between border-b border-slate-50 pb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit TnxID</span>
            <span className="text-sm font-mono font-black text-slate-950">{businessData.transaction_id || 'SYSTEM_AUTH'}</span>
          </div>
          <div className="flex justify-between border-b border-slate-50 pb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valid Until</span>
            <span className="text-sm font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
              {new Date(businessData.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="mt-12 p-8 bg-slate-950 rounded-[2.5rem] text-center text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-3xl"></div>
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Operational Protocol</p>
           <p className="text-4xl font-black tracking-tighter italic">Verified Access</p>
        </div>
        
        <p className="text-[8px] font-black text-slate-300 text-center uppercase tracking-[0.4em] mt-10 italic">This is a system-generated secure document.</p>
        
        <div className="flex gap-4 mt-10 no-print">
           <button onClick={() => window.print()} className="flex-1 py-5 bg-slate-950 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/20 active:scale-95">Download PDF / Print</button>
           <button onClick={() => setShowInvoice(false)} className="px-10 py-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-40 animate-in fade-in duration-700">
      {/* Dynamic Status Header */}
      <div className="bg-slate-950 p-10 md:p-14 rounded-[4rem] text-white shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/10 blur-[100px] rounded-full translate-x-1/4 -translate-y-1/4"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
           <div>
              <h2 className="text-5xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">Subscription <br/> <span className="text-orange-500">Node</span></h2>
              <div className="flex flex-wrap items-center gap-4 mt-6">
                 <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                   isExpired ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                   isPending ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse' :
                   isPro ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                   'bg-slate-500/10 text-slate-400 border-slate-500/20'
                 }`}>
                   {isExpired ? '⚠️ System Restricted' : isPending ? '⏳ Audit in Progress' : isPro ? '🛡️ Pro Active' : '📋 Trial Access'}
                 </span>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Business ID: {businessData.id}</p>
                 {isPro && (
                   <button 
                     onClick={() => setShowInvoice(true)}
                     className="px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                   >
                     📄 Get My Invoice
                   </button>
                 )}
              </div>
           </div>
           <div className="text-center md:text-right">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Service Valid Until</p>
              <p className={`text-4xl font-black tracking-tighter ${isExpired ? 'text-rose-500' : 'text-orange-500'} italic`}>
                {new Date(businessData.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {isPending && <p className="text-[9px] font-black text-orange-500/60 uppercase tracking-widest mt-2 italic animate-pulse">Update pending verification...</p>}
           </div>
        </div>
      </div>

      {isPending && (
        <div className="bg-white border-2 border-orange-100 p-8 rounded-[3rem] shadow-xl shadow-orange-500/5 animate-in slide-in-from-top-6 duration-700 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 bg-orange-100 rounded-3xl flex items-center justify-center text-4xl shadow-sm italic text-orange-600">⏳</div>
            <div>
              <h4 className="text-2xl font-black text-orange-950 tracking-tight italic uppercase">Request Under Audit</h4>
              <p className="text-sm font-bold text-orange-800/60 leading-relaxed mt-2 max-w-xl">
                আপনার পেমেন্ট রিকোয়েস্ট (TnxID: <span className="font-mono bg-orange-50 px-2 py-1 rounded border border-orange-200 text-orange-900 font-black">{businessData.transaction_id}</span>) বর্তমানে রিভিউ করা হচ্ছে।
                অ্যাডমিন ভেরিফাই করার পর আপনার প্রিমিয়াম ফিচারগুলো অটোমেটিক আনলক হয়ে যাবে।
              </p>
            </div>
          </div>
          <div className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] bg-orange-50 px-8 py-4 rounded-2xl border border-orange-100 animate-pulse whitespace-nowrap">Status: Verification Pending</div>
        </div>
      )}

      {/* Plan Selection */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-10 ${isPending ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
        {plans.map((plan) => {
          const isActivePlan = isPro && businessData.selected_plan === plan.id;
          const isSelected = selectedPlan?.id === plan.id;
          
          return (
            <div 
              key={plan.id} 
              onClick={() => handlePlanClick(plan)} 
              className={`p-12 rounded-[4.5rem] border-4 transition-all flex flex-col relative group cursor-pointer ${
                isActivePlan ? 'border-emerald-500 bg-white shadow-lg' :
                isSelected ? 'border-orange-600 bg-white shadow-3xl scale-105' : 
                'bg-white border-slate-100 hover:border-slate-200 hover:shadow-xl'
              }`}
            >
              {plan.recommended && <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-950 text-white px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl">Recommended Node</span>}
              <h3 className="text-2xl font-black uppercase mb-4 italic tracking-tight">{plan.name}</h3>
              <div className="flex items-baseline gap-2 mb-6">
                 <span className="text-6xl font-black italic tracking-tighter text-slate-950">৳{plan.price}</span>
                 <span className="text-slate-400 font-bold text-xs uppercase">/ {plan.duration}</span>
              </div>
              <ul className="space-y-4 mb-12 flex-1 pt-6 border-t border-slate-50">
                {plan.features.map((f, i) => (
                  <li key={i} className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3 italic">
                    <span className="w-5 h-5 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center text-[10px]">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button 
                type="button"
                className={`w-full py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest transition-all ${
                  isActivePlan ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                  isSelected ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/20' : 
                  'bg-slate-100 text-slate-400 group-hover:bg-slate-950 group-hover:text-white'
                }`}
              >
                {isActivePlan ? '✓ Current Plan Active' : isSelected ? 'Confirm Selection' : 'Select Package'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Audit Submission Form */}
      {selectedPlan && !isPending && (
        <div id="payment-terminal" className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-10 duration-700">
          <div className="flex flex-col lg:flex-row gap-16">
            <div className="lg:w-1/2 space-y-10">
               <div className="pb-6 border-b border-slate-100">
                  <h3 className="text-3xl font-black italic tracking-tighter text-slate-950 uppercase">Payment Terminal</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Submit verification proof for <span className="text-orange-600">{selectedPlan.name} Node</span></p>
               </div>

               <div className="space-y-4">
                 <div 
                   onClick={() => setPaymentMethod('bkash')}
                   className={`flex items-center justify-between p-6 rounded-3xl border transition-all cursor-pointer ${paymentMethod === 'bkash' ? 'bg-pink-50 border-pink-200' : 'bg-slate-50 border-slate-100 hover:border-pink-100'}`}
                 >
                    <div className="flex flex-col">
                       <span className={`text-[9px] font-black uppercase tracking-widest ${paymentMethod === 'bkash' ? 'text-pink-600' : 'text-slate-400'}`}>bKash (Personal)</span>
                       <span className="text-2xl font-mono font-black text-slate-950 mt-1">{adminWallets.bkash}</span>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${paymentMethod === 'bkash' ? 'bg-pink-600 text-white' : 'bg-white text-slate-300 border border-slate-100'}`}>✓</div>
                 </div>
                 <div 
                   onClick={() => setPaymentMethod('nagad')}
                   className={`flex items-center justify-between p-6 rounded-3xl border transition-all cursor-pointer ${paymentMethod === 'nagad' ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-100 hover:border-orange-100'}`}
                 >
                    <div className="flex flex-col">
                       <span className={`text-[9px] font-black uppercase tracking-widest ${paymentMethod === 'nagad' ? 'text-orange-500' : 'text-slate-400'}`}>Nagad (Personal)</span>
                       <span className="text-2xl font-mono font-black text-slate-950 mt-1">{adminWallets.nagad}</span>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${paymentMethod === 'nagad' ? 'bg-orange-600 text-white' : 'bg-white text-slate-300 border border-slate-100'}`}>✓</div>
                 </div>
                 <div 
                   onClick={() => setPaymentMethod('rocket')}
                   className={`flex items-center justify-between p-6 rounded-3xl border transition-all cursor-pointer ${paymentMethod === 'rocket' ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 hover:border-indigo-100'}`}
                 >
                    <div className="flex flex-col">
                       <span className={`text-[9px] font-black uppercase tracking-widest ${paymentMethod === 'rocket' ? 'text-indigo-600' : 'text-slate-400'}`}>Rocket (Personal)</span>
                       <span className="text-2xl font-mono font-black text-slate-950 mt-1">{adminWallets.rocket}</span>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${paymentMethod === 'rocket' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-300 border border-slate-100'}`}>✓</div>
                 </div>
               </div>
               
               <p className="text-[10px] font-bold text-slate-400 italic leading-relaxed uppercase bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200">
                  ⚠️ Instructions: Send Money (৳{selectedPlan.price}) to the selected number above. Copy the Transaction ID and enter it in the form to the right for audit verification.
               </p>
            </div>

            <div className="lg:w-1/2 p-10 bg-slate-50 rounded-[3rem] border border-slate-100 space-y-8">
               <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Sender Mobile Number</label>
                  <input 
                    type="text" 
                    value={paymentPhone} 
                    onChange={(e) => setPaymentPhone(e.target.value)} 
                    placeholder="01XXXXXXXXX" 
                    className="w-full px-8 py-6 bg-white border border-slate-200 rounded-3xl text-xl font-black font-mono outline-none focus:ring-8 focus:ring-orange-500/5 transition-all" 
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Transaction ID (TnxID)</label>
                  <input 
                    type="text" 
                    value={txnId} 
                    onChange={(e) => setTxnId(e.target.value)} 
                    placeholder="ABC123XYZ" 
                    className="w-full px-8 py-6 bg-white border border-slate-200 rounded-3xl text-xl font-black font-mono outline-none focus:ring-8 focus:ring-orange-500/5 transition-all uppercase" 
                  />
               </div>
               <button 
                 onClick={handleSubmitPayment}
                 disabled={isSubmitting || !paymentPhone || !txnId}
                 className="w-full py-6 bg-slate-950 hover:bg-black text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-4"
               >
                 {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 ) : 'Submit Audit Proof 🚀'}
               </button>
               <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Verification processed within 1-3 hours.</p>
                  <button onClick={() => setSelectedPlan(null)} className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest mt-4 underline decoration-2 underline-offset-4">Cancel & Reselect</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
