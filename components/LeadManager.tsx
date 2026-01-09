
import React, { useState, useMemo, useRef } from 'react';
import { User, Lead, Order, LeadStatus } from '../types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface LeadManagerProps {
  currentUser: User;
  moderators: User[];
  leads: Lead[];
  orders: Order[];
  onAssignLeads: (leads: Lead[]) => void;
  onBulkUpdateLeads: (leadIds: string[], modId: string, date: string) => void;
  onDeleteLead: (id: string) => void;
  onDeduplicateLeads?: () => void;
}

interface EnrichedContact {
  phone: string;
  name: string;
  address: string;
  leadId: string | null;
  lastOrderDate: string | null;
  lastCallDate: string | null;
  daysSinceCall: number | null;
  daysSinceOrder: number | null;
  totalOrders: number;
  currentStatus: LeadStatus | 'unassigned';
  moderatorId: string | null;
}

const LeadManager: React.FC<LeadManagerProps> = ({ 
  currentUser, 
  moderators, 
  leads, 
  orders, 
  onAssignLeads, 
  onBulkUpdateLeads, 
  onDeleteLead,
  onDeduplicateLeads
}) => {
  const getBSTDate = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 6));
  };

  const [selectedModId, setSelectedModId] = useState('');
  const [assignedDate, setAssignedDate] = useState(getBSTDate().toISOString().split('T')[0]);
  
  const [minDaysSinceCall, setMinDaysSinceCall] = useState<string>('');
  const [minDaysSinceOrder, setMinDaysSinceOrder] = useState<string>('');
  const [strategicSelectedPhones, setStrategicSelectedPhones] = useState<string[]>([]);
  
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all' | 'unassigned'>('all');
  const [searchPhone, setSearchPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanPhoneNumber = (raw: any) => {
    if (!raw) return "";
    let cleaned = String(raw).replace(/[^\d]/g, '');
    if (cleaned.startsWith('880')) cleaned = cleaned.substring(3);
    else if (cleaned.startsWith('88')) cleaned = cleaned.substring(2);
    if (cleaned.length === 10) cleaned = '0' + cleaned;
    return cleaned;
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const contacts = useMemo(() => {
    const contactMap: Record<string, EnrichedContact> = {};
    const now = getBSTDate();

    leads.forEach(l => {
      const phone = cleanPhoneNumber(l.phoneNumber);
      if (phone.length < 10) return;
      
      let callDate: Date | null = null;
      if (l.status !== 'pending' && l.createdAt) {
        const d = new Date(l.createdAt);
        if (!isNaN(d.getTime())) callDate = d;
      }

      if (!contactMap[phone]) {
        contactMap[phone] = {
          phone, 
          name: l.customerName || 'Prospect', 
          address: l.address || '',
          leadId: l.id, 
          lastCallDate: callDate ? callDate.toISOString() : null,
          daysSinceCall: callDate ? Math.floor((now.getTime() - callDate.getTime()) / (1000 * 60 * 60 * 24)) : null,
          lastOrderDate: null, 
          daysSinceOrder: null, 
          totalOrders: 0,
          currentStatus: l.status, 
          moderatorId: l.moderatorId
        };
      }
    });

    orders.forEach(o => {
      const phone = cleanPhoneNumber(o.customerPhone);
      if (phone.length < 10) return;
      
      let orderDate: Date | null = null;
      if (o.createdAt) {
        const d = new Date(o.createdAt);
        if (!isNaN(d.getTime())) orderDate = d;
      }

      if (!contactMap[phone]) {
        contactMap[phone] = {
          phone, 
          name: o.customerName, 
          address: o.customerAddress,
          leadId: null, 
          lastCallDate: null, 
          daysSinceCall: null,
          lastOrderDate: orderDate ? orderDate.toISOString() : null,
          daysSinceOrder: orderDate ? Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)) : null,
          totalOrders: 1, 
          currentStatus: 'unassigned', 
          moderatorId: null
        };
      } else {
        contactMap[phone].totalOrders += 1;
        if (orderDate) {
          const currentLastOrderStr = contactMap[phone].lastOrderDate;
          const currentLastOrder = currentLastOrderStr ? new Date(currentLastOrderStr) : null;
          
          if (!currentLastOrder || isNaN(currentLastOrder.getTime()) || orderDate > currentLastOrder) {
            contactMap[phone].lastOrderDate = orderDate.toISOString();
            contactMap[phone].daysSinceOrder = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }
      }
    });

    return Object.values(contactMap);
  }, [leads, orders]);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      if (searchPhone && !c.phone.includes(searchPhone)) return false;
      if (statusFilter === 'unassigned') {
        if (c.moderatorId && c.moderatorId !== '') return false;
      } else if (statusFilter !== 'all') {
        if (c.currentStatus !== statusFilter) return false;
      }
      if (minDaysSinceCall !== '') {
        const threshold = parseInt(minDaysSinceCall);
        if (c.daysSinceCall === null || c.daysSinceCall < threshold) return false;
      }
      if (minDaysSinceOrder !== '') {
        const threshold = parseInt(minDaysSinceOrder);
        if (c.daysSinceOrder === null || c.daysSinceOrder < threshold) return false;
      }
      return true;
    }).sort((a, b) => {
      const dateA = a.lastOrderDate || a.lastCallDate || '0';
      const dateB = b.lastOrderDate || b.lastCallDate || '0';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [contacts, statusFilter, searchPhone, minDaysSinceCall, minDaysSinceOrder]);

  const processDataArray = (data: any[]) => {
    setIsProcessing(true);
    const existingPhones = new Set(leads.map(l => cleanPhoneNumber(l.phoneNumber)));
    const batchPhones = new Set<string>();
    let duplicateCount = 0;
    const newLeads: Lead[] = [];
    data.forEach((row, idx) => {
      const findValue = (possibleKeys: string[]) => {
        const rowKeys = Object.keys(row);
        const foundKey = rowKeys.find(rk => 
          possibleKeys.some(pk => {
            const normalizedRowKey = rk.toLowerCase().replace(/[\s_]/g, '');
            const normalizedSearchKey = pk.toLowerCase().replace(/[\s_]/g, '');
            return normalizedRowKey.includes(normalizedSearchKey) || normalizedSearchKey.includes(normalizedRowKey);
          })
        );
        return foundKey ? String(row[foundKey]).trim() : "";
      };
      const phone = cleanPhoneNumber(findValue(['phone', 'mobile', 'number', 'contact', 'customerphone', 'cell', 'মোবাইল', 'ফোন']));
      if (phone.length >= 11) {
        if (existingPhones.has(phone) || batchPhones.has(phone)) {
          duplicateCount++;
          return;
        }
        batchPhones.add(phone);
        const name = findValue(['name', 'customer', 'recipient', 'client', 'নাম', 'কাস্টমার']);
        const addr = findValue(['address', 'location', 'area', 'destination', 'ঠিকানা']);
        newLeads.push({
          id: `lead-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          businessId: currentUser.businessId,
          phoneNumber: phone, 
          customerName: name || 'Prospect', 
          address: addr || '',
          moderatorId: selectedModId || '', 
          status: 'pending' as LeadStatus, 
          assignedDate: selectedModId ? assignedDate : '', 
          createdAt: getBSTDate().toISOString()
        });
      }
    });
    if (newLeads.length > 0) {
      onAssignLeads(newLeads);
      showToast(`✅ ${newLeads.length} টি লিড যোগ করা হয়েছে!`);
    } else {
      alert("❌ কোনো নতুন ভ্যালিড লিড পাওয়া যায়নি।");
    }
    setIsProcessing(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumbers.trim()) return;
    setIsProcessing(true);
    const numberList = phoneNumbers.split(/[\n,]/).map(n => n.trim()).filter(n => n.length >= 10);
    const manualLeads = numberList.map(num => ({ 'Phone': num, 'Name': customerName, 'Address': address }));
    processDataArray(manualLeads);
    setPhoneNumbers(''); setCustomerName(''); setAddress('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          processDataArray(jsonData);
        } catch (err) { alert("❌ Excel পড়তে সমস্যা হয়েছে।"); setIsProcessing(false); }
      };
      reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.csv')) {
      Papa.parse(file, { header: true, complete: (res) => processDataArray(res.data), error: () => setIsProcessing(false) });
    } else {
      alert("❌ ভুল ফরম্যাট!");
      setIsProcessing(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStrategicDeployment = async () => {
    if (strategicSelectedPhones.length === 0 || !selectedModId) {
      alert("⚠️ মডারেটর এবং লিড সিলেক্ট করুন!");
      return;
    }
    setIsProcessing(true);
    const selectedFullContacts = contacts.filter(c => strategicSelectedPhones.includes(c.phone));
    const existingLeadIds = selectedFullContacts.filter(c => c.leadId !== null).map(c => c.leadId!);
    const newLeadsToCreate: Lead[] = selectedFullContacts.filter(c => c.leadId === null).map((c, idx) => ({
      id: `revived-${Date.now()}-${idx}`,
      businessId: currentUser.businessId,
      phoneNumber: c.phone, customerName: c.name, address: c.address,
      moderatorId: selectedModId, status: 'pending' as LeadStatus, assignedDate, createdAt: getBSTDate().toISOString()
    }));
    try {
      if (existingLeadIds.length > 0) await onBulkUpdateLeads(existingLeadIds, selectedModId, assignedDate);
      if (newLeadsToCreate.length > 0) await onAssignLeads(newLeadsToCreate);
      showToast(`🎯 ${strategicSelectedPhones.length} টি লিড মোতায়েন করা হয়েছে!`);
      setStrategicSelectedPhones([]);
    } catch (err) { alert("Deployment failed."); } finally { setIsProcessing(false); }
  };

  const applyPreset = (type: 'dormant' | 'followup' | 'fresh') => {
    if (type === 'dormant') { setMinDaysSinceOrder('30'); setMinDaysSinceCall(''); }
    else if (type === 'followup') { setMinDaysSinceOrder(''); setMinDaysSinceCall('7'); }
    else { setMinDaysSinceOrder(''); setMinDaysSinceCall(''); setStatusFilter('pending'); }
  };

  const getModName = (id: string | null) => {
    if (!id || id === '') return <span className="text-rose-400 italic">Unassigned</span>;
    return moderators.find(m => String(m.id) === String(id))?.name || 'Unassigned';
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-700">
      {successMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-10 py-5 rounded-2xl shadow-2xl border border-white/10 font-black uppercase text-[10px] tracking-widest">
          <span className="mr-3">🚀</span> {successMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">Intelligence Command</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">Dhaka Standard Time Node</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-slate-100 p-1.5 rounded-[2rem] border border-slate-200 overflow-x-auto">
            <button onClick={() => applyPreset('dormant')} className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all whitespace-nowrap">⏳ Dormant (30d+)</button>
            <button onClick={() => applyPreset('followup')} className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all whitespace-nowrap">📞 Follow-up (7d+)</button>
            <button onClick={() => applyPreset('fresh')} className="px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all whitespace-nowrap">✨ Fresh</button>
          </div>
          {onDeduplicateLeads && (
            <button onClick={() => confirm("Cleanup duplicates?") && onDeduplicateLeads()} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
              🧹 Clean Duplicates
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-950 p-8 rounded-[3rem] text-white shadow-2xl border border-white/5 relative overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 border-b border-white/5 pb-4 italic">Assign Duty</h3>
            <div className="space-y-5">
               <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Selected</p>
                 <div className="flex justify-between items-end">
                    <p className="text-3xl font-black text-indigo-400">{strategicSelectedPhones.length}</p>
                    <button onClick={() => setStrategicSelectedPhones([])} className="text-[8px] font-black text-rose-400 uppercase hover:underline mb-1">Clear</button>
                 </div>
               </div>
               <div className="space-y-4 pt-4">
                 <select value={selectedModId} onChange={(e) => setSelectedModId(e.target.value)} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black outline-none appearance-none">
                   <option value="" className="bg-slate-900">Select Moderator...</option>
                   {moderators.filter(m => m.is_active).map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>)}
                 </select>
                 <input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black outline-none" />
               </div>
               <button onClick={handleStrategicDeployment} disabled={isProcessing || strategicSelectedPhones.length === 0} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all">
                 Set Duty List
               </button>
            </div>
          </div>
          
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">Data Ingestion</h3>
            <div className="space-y-4">
               <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full py-4 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black flex items-center justify-center gap-2 shadow-lg">
                 📁 Batch File Upload
               </button>
               <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload}/>
               <form onSubmit={handleManualSubmit} className="space-y-4 pt-4 border-t border-slate-50">
                  <p className="text-[8px] font-black text-slate-400 uppercase ml-1">Manual Injection</p>
                  <textarea rows={3} value={phoneNumbers} onChange={(e) => setPhoneNumbers(e.target.value)} className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none" placeholder="017... 018..."/>
                  <button disabled={isProcessing || !phoneNumbers} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-xl uppercase tracking-widest text-[9px]">Inject</button>
               </form>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white p-6 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input type="text" placeholder="Search Identity..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="w-full pl-14 pr-8 py-5 bg-slate-50 border border-slate-200 rounded-[2.5rem] text-[11px] font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"/>
              </div>
              <div className="flex bg-slate-100 p-2 rounded-[2rem] border border-slate-200 overflow-x-auto max-w-full">
                {['all', 'unassigned', 'pending', 'confirmed', 'no-response'].map(stat => (
                  <button key={stat} onClick={() => setStatusFilter(stat as any)} className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase transition-all tracking-widest whitespace-nowrap ${statusFilter === stat ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>{stat}</button>
                ))}
              </div>
           </div>

           <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="px-6 py-7 text-[9px] font-black text-slate-500 uppercase">S.N.</th>
                      <th className="px-6 py-7 text-[9px] font-black text-slate-500 uppercase text-center">Select</th>
                      <th className="px-10 py-7 text-[9px] font-black text-slate-500 uppercase">Identity</th>
                      <th className="px-10 py-7 text-[9px] font-black text-slate-500 uppercase">Activity Age</th>
                      <th className="px-10 py-7 text-[9px] font-black text-slate-500 uppercase text-right">Moderator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredContacts.map((contact, idx) => (
                      <tr key={contact.phone} className={`group hover:bg-slate-50/50 transition-colors ${strategicSelectedPhones.includes(contact.phone) ? 'bg-indigo-50/30' : ''}`}>
                        <td className="px-6 py-8">
                           <span className="text-[10px] font-black text-slate-300 italic">#{idx + 1}</span>
                        </td>
                        <td className="px-6 py-8 text-center">
                           <input type="checkbox" checked={strategicSelectedPhones.includes(contact.phone)} onChange={() => { setStrategicSelectedPhones(prev => prev.includes(contact.phone) ? prev.filter(p => p !== contact.phone) : [...prev, contact.phone]); }} className="w-6 h-6 rounded-xl border-slate-300 text-indigo-600 cursor-pointer" />
                        </td>
                        <td className="px-10 py-8">
                           <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm ${contact.totalOrders > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {contact.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm font-mono tracking-tighter leading-none">{contact.phone}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{contact.name}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-8">
                           <div className="flex gap-8">
                              <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Call</p>
                                <p className={`text-[10px] font-black ${contact.daysSinceCall !== null && contact.daysSinceCall > 7 ? 'text-rose-500' : 'text-slate-800'}`}>
                                  {contact.daysSinceCall !== null ? `${contact.daysSinceCall}d` : '--'}
                                </p>
                              </div>
                              <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Order</p>
                                <p className={`text-[10px] font-black ${contact.daysSinceOrder !== null && contact.daysSinceOrder > 30 ? 'text-orange-600' : 'text-slate-800'}`}>
                                  {contact.daysSinceOrder !== null ? `${contact.daysSinceOrder}d` : '--'}
                                </p>
                              </div>
                           </div>
                        </td>
                        <td className="px-10 py-8 text-right">
                           <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                             contact.currentStatus === 'unassigned' || !contact.moderatorId ? 'bg-rose-50 text-rose-400 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                           }`}>
                             {contact.currentStatus}
                           </span>
                           <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase">Unit: {getModName(contact.moderatorId)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LeadManager;
