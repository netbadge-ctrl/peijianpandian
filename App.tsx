
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Plus, 
  Search, 
  MessageSquare, 
  Settings, 
  Menu,
  X,
  Server,
  ScanBarcode,
  Send,
  Trash2,
  Edit2,
  Check,
  ChevronLeft,
  Filter,
  MoreVertical
} from 'lucide-react';
import InventoryStats from './components/InventoryStats';
import Scanner from './components/Scanner';
import { InventoryItem, PartCategory, PartStatus } from './types';
import { askAssistant } from './services/geminiService';

// --- Mock Initial Data ---
const INITIAL_DATA: InventoryItem[] = [
  { id: '1', sn: 'CPU-XG-001', name: 'Intel Xeon Gold 6248R', category: PartCategory.CPU, model: '6248R', quantity: 4, status: PartStatus.NEW, location: 'A-01', lastUpdated: '2023-10-26' },
  { id: '2', sn: 'RAM-SS-002', name: 'Samsung 32GB DDR4', category: PartCategory.RAM, model: 'M393A4K40CB2', quantity: 24, status: PartStatus.NEW, location: 'A-02', lastUpdated: '2023-11-01' },
  { id: '3', sn: 'DSK-SG-003', name: 'Seagate Exos 16TB', category: PartCategory.DISK, model: 'ST16000NM001G', quantity: 8, status: PartStatus.USED, location: 'B-05', lastUpdated: '2023-10-15' },
  { id: '4', sn: 'NIC-CS-004', name: 'Cisco SFP+ 10G SR', category: PartCategory.NIC, model: 'SFP-10G-SR', quantity: 12, status: PartStatus.NEW, location: 'C-03', lastUpdated: '2023-11-05' },
];

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'chat'>('inventory');
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_DATA);
  const [showScanner, setShowScanner] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', text: string}[]>([
    { role: 'ai', text: '你好！我是机房盘点助手。你可以问我关于库存的问题，或者让我协助分析配置。' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Edit/Add Form State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const emptyItem: Omit<InventoryItem, 'id' | 'lastUpdated'> = {
    sn: '',
    name: '',
    category: PartCategory.OTHER,
    model: '',
    quantity: 1,
    status: PartStatus.NEW,
    location: '',
    notes: ''
  };
  const [formData, setFormData] = useState(emptyItem);

  // --- Effects ---
  useEffect(() => {
    // Load from localStorage if available (Simple persistence)
    const saved = localStorage.getItem('idc_inventory');
    if (saved) {
      setItems(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('idc_inventory', JSON.stringify(items));
  }, [items]);

  // --- Handlers ---

  const handleScanComplete = (scannedData: Partial<InventoryItem>) => {
    setShowScanner(false);
    // If scanned item exists (by SN), we could just highlight it, 
    // but here we assume we want to edit/view it or add a new one if it was an AI scan.
    
    const existing = items.find(i => i.sn && scannedData.sn && i.sn.toLowerCase() === scannedData.sn.toLowerCase());
    
    if (existing) {
      setEditingItem(existing);
      setFormData(existing);
      setShowAddModal(true);
    } else {
      setFormData({ ...emptyItem, ...scannedData });
      setEditingItem(null);
      setShowAddModal(true);
    }
  };

  const handleSaveItem = () => {
    if (editingItem) {
      // Update
      setItems(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { ...item, ...formData, lastUpdated: new Date().toISOString().split('T')[0] } 
          : item
      ));
    } else {
      // Create
      const newItem: InventoryItem = {
        id: Date.now().toString(),
        lastUpdated: new Date().toISOString().split('T')[0],
        ...formData
      } as InventoryItem;
      setItems(prev => [newItem, ...prev]);
    }
    setShowAddModal(false);
    setEditingItem(null);
    setFormData(emptyItem);
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？')) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const handleEditItem = (item: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setFormData(item);
    setShowAddModal(true);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    // Prepare context
    const inventoryContext = items.map(i => `${i.name} (SN:${i.sn}, Model:${i.model}): ${i.quantity}个, 位置 ${i.location}`).join('\n');
    
    const response = await askAssistant(userMsg, inventoryContext);
    
    setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
    setIsChatLoading(false);
  };

  // --- Derived Data ---
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Render Helpers ---

  const renderMobileNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 pb-safe-area pt-3 flex justify-between z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <button 
        onClick={() => setActiveTab('inventory')} 
        className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'inventory' ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <Package className="w-6 h-6" />
        <span className="text-[10px] font-medium">库存</span>
      </button>
      
      <button 
        onClick={() => setActiveTab('dashboard')} 
        className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <LayoutDashboard className="w-6 h-6" />
        <span className="text-[10px] font-medium">看板</span>
      </button>
      
      {/* Floating Action Button for Scan */}
      <div className="relative -top-8">
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg shadow-indigo-300 hover:bg-indigo-700 transition-transform active:scale-95 flex items-center justify-center border-4 border-slate-50"
        >
          <ScanBarcode className="w-7 h-7" />
        </button>
      </div>

      <button 
        onClick={() => setActiveTab('chat')} 
        className={`flex flex-col items-center gap-1 w-16 ${activeTab === 'chat' ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <MessageSquare className="w-6 h-6" />
        <span className="text-[10px] font-medium">助手</span>
      </button>
      
      <button 
        onClick={() => {}} // Settings placeholder
        className={`flex flex-col items-center gap-1 w-16 text-slate-400`}
      >
        <Settings className="w-6 h-6" />
        <span className="text-[10px] font-medium">设置</span>
      </button>
    </div>
  );

  const renderFullScreenModal = () => {
    if (!showAddModal) return null;
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
        {/* Modal Header */}
        <div className="bg-white px-4 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
          <button onClick={() => setShowAddModal(false)} className="text-slate-500 p-2 -ml-2">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h3 className="text-lg font-bold text-slate-900">
            {editingItem ? '编辑配件' : '入库新配件'}
          </h3>
          <button 
            onClick={handleSaveItem}
            className="text-indigo-600 font-semibold text-sm px-2"
          >
            保存
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
             <div>
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">配件名称</label>
               <input 
                 type="text" 
                 value={formData.name}
                 onChange={e => setFormData({...formData, name: e.target.value})}
                 className="w-full px-0 py-2 border-b border-slate-200 focus:border-indigo-500 outline-none text-lg font-semibold text-slate-900 bg-transparent transition-colors placeholder-slate-300"
                 placeholder="例如: Samsung DDR4 32GB"
               />
             </div>

             <div className="grid grid-cols-2 gap-6">
               <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SN (序列号)</label>
                 <input 
                   type="text" 
                   value={formData.sn}
                   onChange={e => setFormData({...formData, sn: e.target.value})}
                   className="w-full py-2 border-b border-slate-200 focus:border-indigo-500 outline-none text-slate-800 font-mono"
                   placeholder="扫描或输入..."
                 />
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">状态</label>
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as PartStatus})}
                    className="w-full py-2 bg-transparent border-b border-slate-200 outline-none text-slate-800 font-medium appearance-none"
                  >
                    {Object.values(PartStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-6">
               <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">分类</label>
                 <select 
                   value={formData.category}
                   onChange={e => setFormData({...formData, category: e.target.value as PartCategory})}
                   className="w-full py-2 bg-transparent border-b border-slate-200 outline-none text-slate-800 font-medium appearance-none"
                 >
                   {Object.values(PartCategory).map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
               </div>
               <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">型号 (P/N)</label>
                  <input 
                    type="text" 
                    value={formData.model}
                    onChange={e => setFormData({...formData, model: e.target.value})}
                    className="w-full py-2 border-b border-slate-200 focus:border-indigo-500 outline-none text-slate-800 bg-transparent"
                    placeholder="--"
                  />
               </div>
             </div>
           </div>

           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-4">
             <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">数量</label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setFormData(p => ({...p, quantity: Math.max(1, p.quantity - 1)}))}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                  >
                    -
                  </button>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                    className="w-16 text-center font-bold text-xl text-indigo-600 bg-transparent outline-none"
                  />
                  <button 
                    onClick={() => setFormData(p => ({...p, quantity: p.quantity + 1}))}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                  >
                    +
                  </button>
                </div>
             </div>

             <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">存放位置</label>
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  className="w-full py-2 border-b border-slate-200 focus:border-indigo-500 outline-none text-slate-800 bg-transparent"
                  placeholder="例如: A架-03层"
                />
             </div>
           </div>

           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">备注</label>
              <textarea 
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full py-2 border-b border-slate-200 focus:border-indigo-500 outline-none bg-transparent min-h-[80px] resize-none text-slate-700"
                placeholder="填写备注信息..."
              />
           </div>
           
           <div className="h-20"></div> {/* Spacer for bottom */}
        </div>
      </div>
    );
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24">
      
      {renderMobileNav()}
      {showScanner && <Scanner items={items} onScanComplete={handleScanComplete} onClose={() => setShowScanner(false)} />}
      {renderFullScreenModal()}

      {/* Mobile App Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm">
         <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-indigo-200 shadow-md">
             <Server className="w-5 h-5" />
           </div>
           <h1 className="text-lg font-bold text-slate-900 tracking-tight">IDC Master</h1>
         </div>
         <div className="flex items-center gap-2">
           {activeTab === 'inventory' && (
             <button 
                onClick={() => {
                  setFormData(emptyItem);
                  setEditingItem(null);
                  setShowAddModal(true);
                }}
                className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
             >
               <Plus className="w-5 h-5" />
             </button>
           )}
         </div>
      </header>

      {/* Content Area */}
      <main className="p-4 max-w-md mx-auto md:max-w-full">
        
        {/* DYNAMIC CONTENT SWITCHER */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
             <div className="px-1">
               <h2 className="text-xl font-bold text-slate-900">数据看板</h2>
               <p className="text-sm text-slate-500 mt-1">实时监控机房配件库存状态</p>
             </div>
             <InventoryStats items={items} />
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4 animate-fade-in">
            {/* Mobile Search Bar */}
            <div className="sticky top-[60px] z-20 -mx-4 px-4 pb-2 bg-slate-50/95 backdrop-blur-sm">
              <div className="relative shadow-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="搜索配件SN、型号、位置..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border-none rounded-xl outline-none text-sm shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 pb-6">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div 
                    key={item.id} 
                    onClick={(e) => handleEditItem(item, e)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 active:scale-[0.98] transition-transform relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="pr-8">
                        <div className="font-bold text-slate-900 text-base line-clamp-1">{item.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-mono">{item.sn}</span>
                            <div className="text-slate-400 text-xs font-mono">{item.model}</div>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide
                        ${item.category === PartCategory.CPU ? 'bg-blue-50 text-blue-600' : 
                          item.category === PartCategory.RAM ? 'bg-green-50 text-green-600' :
                          item.category === PartCategory.DISK ? 'bg-purple-50 text-purple-600' :
                          'bg-slate-100 text-slate-600'}`}
                      >
                        {item.category}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          {item.location || '无位置'}
                        </span>
                        <span className="flex items-center gap-1">
                           <span className={`w-1.5 h-1.5 rounded-full ${item.status === PartStatus.NEW ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                           {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                            onClick={(e) => handleDeleteItem(item.id, e)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                         <div className="text-xl font-bold text-indigo-600">
                           x{item.quantity}
                         </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                   <Package className="w-12 h-12 mb-3 opacity-20" />
                   <p className="text-sm">没有找到相关配件</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
           <div className="flex flex-col h-[calc(100vh-140px)]">
             <div className="flex-1 overflow-y-auto px-1 py-4 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                   <div className="flex justify-start">
                     <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1.5">
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                     </div>
                   </div>
                )}
             </div>

             <div className="mt-2">
               <form onSubmit={handleChatSubmit} className="flex gap-2 items-end bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                 <input 
                    type="text" 
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="输入您的问题..."
                    className="flex-1 px-3 py-2 bg-transparent border-none focus:ring-0 outline-none text-sm max-h-24"
                 />
                 <button 
                   type="submit" 
                   disabled={isChatLoading}
                   className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                 >
                   <Send className="w-5 h-5" />
                 </button>
               </form>
             </div>
           </div>
        )}

      </main>
    </div>
  );
};

export default App;
