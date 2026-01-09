
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
}) => {
  const getBSTDate = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 6));
  };

  const [selectedModId, setSelectedModId] = useState('');
  const [assignedDate, setAssignedDate] = useState(getBSTDate().toISOString().split('T')[0]);
  
  // Intelligence Filters
  const [minDaysSinceCall, setMinDaysSinceCall] = useState<string>('');
  const [minDaysSinceOrder, setMinDaysSinceOrder] = useState<string>('');
  const [strategicSelectedPhones, setStrategicSelectedPhones] = useState<string[]>([]);
  
  // Range Selection
  const [rangeFrom, setRangeFrom] = useState<string>('1');
  const [rangeTo, setRangeTo] = useState<string>('100');

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

  // Restored Upload Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processDataArray(results.data)
      });
    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processDataArray(data);
      };
      reader.readAsBinaryString(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processDataArray = (data: any[]) => {
    setIsProcessing(true);
    const existingPhones = new Set(leads.map(l => cleanPhoneNumber(l.phoneNumber)));
    const batchPhones = new Set<string>();
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
      
      if (phone.length >= 10) {
        if (existingPhones.has(phone) || batchPhones.has(phone)) return;
        batchPhones.add(phone);
        
        const name = findValue(['name', 'customer', 'recipient', 'client', 'নাম', 'কাস্টমার']);
        const addr = findValue(['address', 'location', 'area', 'destination', 'ঠিকানা']);
        
        newLeads.push({
          id: `lead-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          businessId: currentUser.businessId,
          phoneNumber: phone, 
          customerName: name || 'Prospect', 
          address: addr || '',
          moderatorId: '', 
          status: 'pending' as LeadStatus, 
          assignedDate: '', 
          createdAt: getBSTDate().toISOString()
        });
      }
    });

    if (newLeads.length > 0) {
      onAssignLeads(newLeads);
      showToast(`✅ ${newLeads.length} Leads Imported!`);
    } else {
      alert("No new unique phone numbers found in the file.");
    }
    setIsProcessing(false);
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

  const applyRangeSelection = () => {
    const from = parseInt(rangeFrom) - 1;
    const to = parseInt(rangeTo);
    if (isNaN(from) || isNaN(to)) return;

    const slice = filteredContacts.slice(Math.max(0, from), Math.min(filteredContacts.length, to));
    const newPhones = slice.map(c => c.phone);
    setStrategicSelectedPhones(prev => {
      const combined = new Set([...prev, ...newPhones]);
      return Array.from(combined);
    });
    showToast(`${newPhones.length} added to list.`);
  };

  const handleStrategicDeployment = async () => {
    if (strategicSelectedPhones.length === 0 || !selectedModId) {
      alert("Please select leads and a moderator.");
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
      showToast(`🎯 Duty Assigned Successfully!`);
      setStrategicSelectedPhones([]);
    } catch (err) { alert("Deployment failed."); } finally { setIsProcessing(false); }
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
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Intelligence Command</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1 italic">Tactical Duty Deployment Terminal</p>
        </div>
        
        {/* Lead Injector Terminal */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Inject Leads</span>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-slate-950 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
              >
                📁 Upload XLSX/CSV
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />
           </div>
           <div className="w-px h-10 bg-slate-100"></div>
           <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Analysis Filters</p>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Min Call Age:</span>
                    <input type="number" value={minDaysSinceCall} onChange={(e) => setMinDaysSinceCall(e.target.value)} placeholder="Days" className="w-12 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-black outline-none" />
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Min Order Age:</span>
                    <input type="number" value={minDaysSinceOrder} onChange={(e) => setMinDaysSinceOrder(e.target.value)} placeholder="Days" className="w-12 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-black outline-none" />
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-950 p-8 rounded-[3.5rem] text-white shadow-2xl border border-white/5 relative overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 border-b border-white/5 pb-4 italic">Operational Protocol</h3>
            
            <div className="space-y-8">
               <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                 <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Queued for Duty</p>
                 <div className="flex justify-between items-baseline">
                    <p className="text-4xl font-black text-indigo-400 italic">{strategicSelectedPhones.length}</p>
                    <button onClick={() => setStrategicSelectedPhones([])} className="text-[8px] font-black text-rose-400 uppercase hover:underline">Clear Queue</button>
                 </div>
               </div>

               {/* Smart Selection Tools */}
               <div className="space-y-4">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">S.N. Deployment Scope</p>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <label className="text-[7px] font-black text-slate-600 uppercase ml-1">From</label>
                        <input type="number" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-xs font-black text-white outline-none" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[7px] font-black text-slate-600 uppercase ml-1">To</label>
                        <input type="number" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-xs font-black text-white outline-none" />
                     </div>
                  </div>
                  <button onClick={applyRangeSelection} className="w-full bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Capture Range</button>
               </div>

               <div className="pt-4 space-y-4">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Assign To Unit</label>
                    <select value={selectedModId} onChange={(e) => setSelectedModId(e.target.value)} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black text-white outline-none">
                      <option value="" className="bg-slate-900">Select Moderator...</option>
                      {moderators.filter(m => m.is_active).map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Shift Date</label>
                    <input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black text-white outline-none" />
                 </div>
               </div>

               <button 
                 onClick={handleStrategicDeployment} 
                 disabled={isProcessing || strategicSelectedPhones.length === 0 || !selectedModId} 
                 className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-20 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95"
               >
                 {isProcessing ? 'Deploying...' : 'Deploy Unit Mission'}
               </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white p-6 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input type="text" placeholder="Search Database (Phone/Name)..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} className="w-full pl-14 pr-8 py-5 bg-slate-50 border border-slate-200 rounded-[2.5rem] text-[11px] font-black outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"/>
              </div>
              <div className="flex bg-slate-100 p-2 rounded-full border border-slate-200 overflow-x-auto max-w-full">
                {['all', 'unassigned', 'pending', 'confirmed', 'no-response'].map(stat => (
                  <button key={stat} onClick={() => setStatusFilter(stat as any)} className={`px-6 py-3 rounded-full text-[9px] font-black uppercase transition-all tracking-widest whitespace-nowrap ${statusFilter === stat ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>{stat}</button>
                ))}
              </div>
           </div>

           <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-950">
                    <tr>
                      <th className="px-8 py-8 text-[9px] font-black text-slate-500 uppercase tracking-widest">S.N.</th>
                      <th className="px-6 py-8 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Duty</th>
                      <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-widest">Client Identity</th>
                      <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-widest">Operational Data</th>
                      <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Unit Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredContacts.map((contact, idx) => {
                      const isSelected = strategicSelectedPhones.includes(contact.phone);
                      return (
                        <tr key={contact.phone} className={`group hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                          <td className="px-8 py-10">
                             <span className="text-[10px] font-black text-slate-300 italic">#{idx + 1}</span>
                          </td>
                          <td className="px-6 py-10 text-center">
                             <input type="checkbox" checked={isSelected} onChange={() => { setStrategicSelectedPhones(prev => prev.includes(contact.phone) ? prev.filter(p => p !== contact.phone) : [...prev, contact.phone]); }} className="w-6 h-6 rounded-xl border-slate-300 text-indigo-600 cursor-pointer shadow-sm" />
                          </td>
                          <td className="px-10 py-10">
                             <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-3xl flex items-center justify-center font-black text-base shadow-sm ${contact.totalOrders > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'} italic`}>
                                  {contact.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-black text-slate-950 text-base font-mono tracking-tighter leading-none">{contact.phone}</p>
                                  <p className="text-[10px] font-black text-indigo-500 uppercase mt-2 tracking-widest italic">{contact.name}</p>
                                  <p className="text-[8px] text-slate-400 font-bold truncate max-w-[150px] mt-1 uppercase italic">{contact.address}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-10">
                             <div className="flex gap-12">
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Last Call</p>
                                  <p className={`text-[14px] font-black ${contact.daysSinceCall !== null && contact.daysSinceCall > 7 ? 'text-rose-500' : 'text-slate-900'}`}>
                                    {contact.daysSinceCall !== null ? `${contact.daysSinceCall}d ago` : '--'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Last Order</p>
                                  <p className={`text-[14px] font-black ${contact.daysSinceOrder !== null && contact.daysSinceOrder > 30 ? 'text-orange-600' : 'text-slate-900'}`}>
                                    {contact.daysSinceOrder !== null ? `${contact.daysSinceOrder}d ago` : '--'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Impact</p>
                                  <p className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 italic">{contact.totalOrders} Orders</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-10 py-10 text-right">
                             <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border italic ${
                               contact.currentStatus === 'unassigned' || !contact.moderatorId ? 'bg-rose-50 text-rose-400 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                             }`}>
                               {contact.currentStatus}
                             </span>
                             <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase italic">Unit: <span className="text-slate-600 font-black">{moderators.find(m => String(m.id) === String(contact.moderatorId))?.name || 'Unassigned'}</span></p>
                          </td>
                        </tr>
                      );
                    })}
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
