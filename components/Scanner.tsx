
import React, { useState, useRef, useEffect } from 'react';
import { 
  Loader2, X, ChevronLeft, Camera, CheckCircle2, 
  AlertTriangle, Search, ArrowRight, Edit3, Check, 
  ScanLine, Keyboard, Type, Image as ImageIcon, Layers,
  ChevronDown
} from 'lucide-react';
import { analyzeComponentImage } from '../services/geminiService';
import { InventoryItem, PartCategory, PartStatus } from '../types';

interface ScannerProps {
  items: InventoryItem[];
  onScanComplete: (item: Partial<InventoryItem>) => void;
  onClose: () => void;
}

type ScanMode = 'barcode' | 'ai_label';

interface EditableResult {
  sn: string;
  model: string;
  manufacturer: string;
  category: string;
  hardwareVersion: string;
}

const COMPONENT_TYPES = ['CPU', 'NVME', 'RAID', 'SSD', '内存', 'GPU', '网卡'];

const Scanner: React.FC<ScannerProps> = ({ items, onScanComplete, onClose }) => {
  // Mode State
  const [mode, setMode] = useState<ScanMode>('barcode');
  
  // Common State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Barcode Mode State
  const [snInput, setSnInput] = useState('');
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not-found'>('idle');
  const snInputRef = useRef<HTMLInputElement>(null);

  // AI Result State
  const [rawTextSegments, setRawTextSegments] = useState<string[]>([]);
  const [editableResult, setEditableResult] = useState<EditableResult>({ 
    sn: '', 
    model: '', 
    manufacturer: '',
    category: 'CPU',
    hardwareVersion: ''
  });
  const [activeTextSelection, setActiveTextSelection] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  
  const hasResults = !!previewUrl && !isAnalyzing && (!!editableResult.sn || rawTextSegments.length > 0);

  // Auto-focus SN input logic
  useEffect(() => {
    if (mode === 'barcode' && snInputRef.current && searchStatus === 'idle') {
      setTimeout(() => snInputRef.current?.focus(), 300);
    }
  }, [mode, searchStatus]);

  // --- Handlers: Barcode ---
  const handleSnCheck = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!snInput.trim()) return;
    const querySN = snInput.trim();
    const found = items.find(i => i.sn?.toLowerCase() === querySN.toLowerCase());
    
    if (found) {
      setFoundItem(found);
      setSearchStatus('found');
    } else {
      setFoundItem(null);
      setSearchStatus('not-found');
    }
  };

  const resetScanner = () => {
    setSnInput('');
    setSearchStatus('idle');
    setFoundItem(null);
  };

  // --- Handlers: AI Label ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setError(null);
    setEditableResult({ sn: '', model: '', manufacturer: '', category: 'CPU', hardwareVersion: '' });
    setRawTextSegments([]);
    setIsAnalyzing(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const result = await analyzeComponentImage(base64String, file.type, 'label');
          setEditableResult({
             sn: result.sn || '',
             model: result.model || '',
             manufacturer: result.manufacturer || '',
             category: 'CPU',
             hardwareVersion: ''
          });
          const texts = result.all_text && Array.isArray(result.all_text) ? result.all_text : [];
          setRawTextSegments(Array.from(new Set(texts)));
        } catch (err) {
          console.error(err);
          setError("无法识别标签，请确保文字清晰");
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("读取图片失败");
      setIsAnalyzing(false);
    }
  };

  const handleAssignText = (target: 'sn' | 'model' | 'hardwareVersion') => {
    if (!activeTextSelection) return;
    setEditableResult(prev => ({ ...prev, [target]: activeTextSelection }));
    setActiveTextSelection(null);
  };

  const handleConfirmAiResult = () => {
    if (!editableResult.sn && !editableResult.model) return;
    
    // Map custom types to PartCategory enum where possible
    let mappedCategory = PartCategory.OTHER;
    if (editableResult.category === 'CPU') mappedCategory = PartCategory.CPU;
    else if (editableResult.category === '内存') mappedCategory = PartCategory.RAM;
    else if (editableResult.category === '网卡') mappedCategory = PartCategory.NIC;
    else if (['SSD', 'NVME'].includes(editableResult.category)) mappedCategory = PartCategory.DISK;
    // RAID, GPU default to OTHER
    
    let notes = `AI补录 - 来源: 拍照识别`;
    
    if (editableResult.category === '网卡' && editableResult.hardwareVersion) {
      notes += ` | 硬件版本: ${editableResult.hardwareVersion}`;
    }
    
    if (!['CPU', '内存', '网卡', '硬盘'].includes(editableResult.category)) {
      notes += ` | 类型: ${editableResult.category}`;
    }

    const suggestedItem: Partial<InventoryItem> = {
      sn: editableResult.sn,
      name: `${editableResult.manufacturer || '未知品牌'} ${editableResult.category} ${editableResult.model}`,
      category: mappedCategory,
      model: editableResult.model,
      quantity: 1,
      status: PartStatus.NEW,
      notes: notes
    };
    onScanComplete(suggestedItem);
  };

  const handleCancelAiResult = () => {
    setPreviewUrl(null);
    setEditableResult({ sn: '', model: '', manufacturer: '', category: 'CPU', hardwareVersion: '' });
    setRawTextSegments([]);
    setError(null);
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  // --- UI Components ---

  // Mobile Header
  const Header = () => (
    <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pb-10">
      <button 
        onClick={onClose} 
        className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center active:scale-90 transition-transform"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>
      <span className="font-medium text-lg text-white drop-shadow-md tracking-wide">
        {mode === 'barcode' ? '扫码查重' : '拍照补录'}
      </span>
      <div className="w-10" /> {/* Spacer */}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white font-sans flex flex-col overscroll-none touch-none">
      {/* Render main header only if not in full-screen AI result mode */}
      {(!previewUrl || isAnalyzing) && <Header />}

      {/* --- MODE: BARCODE SCANNER --- */}
      {mode === 'barcode' && (
        <div className="flex-1 relative flex flex-col">
          {/* Viewfinder (Visual Only) */}
          <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center pb-40 relative overflow-hidden">
             {/* Grid Pattern */}
             <div className="absolute inset-0 opacity-10" 
                  style={{backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '30px 30px'}}>
             </div>
             
             {/* Scanner Box */}
             <div className="w-72 h-48 border-2 border-indigo-500/30 rounded-3xl relative shadow-[0_0_100px_rgba(99,102,241,0.2)] overflow-hidden">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-xl"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent animate-scan-down"></div>
                <div className="absolute top-1/2 w-full h-0.5 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)]"></div>
             </div>
             <p className="text-slate-400 text-xs mt-8 font-mono tracking-widest opacity-70">SCANNING ACTIVE</p>
          </div>

          {/* Bottom Input Area */}
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl p-6 pb-8 border-t border-slate-800 shadow-2xl z-10">
             <p className="text-slate-400 text-center text-xs mb-4 font-medium">请扫描条形码或手动输入 SN</p>
             <form onSubmit={handleSnCheck} className="flex gap-3">
               <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 flex items-center px-4 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all h-14">
                  <Keyboard className="w-5 h-5 text-slate-500 mr-3 shrink-0" />
                  <input 
                    ref={snInputRef}
                    type="text" 
                    value={snInput}
                    onChange={e => {
                      setSnInput(e.target.value);
                      if (searchStatus !== 'idle') setSearchStatus('idle');
                    }}
                    placeholder="输入序列号..."
                    className="flex-1 bg-transparent text-lg text-white outline-none font-mono placeholder-slate-600"
                  />
               </div>
               <button 
                 type="submit" 
                 disabled={!snInput.trim()}
                 className="bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40 active:scale-95 transition-all"
               >
                 <Search className="w-6 h-6" />
               </button>
             </form>
          </div>

          {/* Result Bottom Sheet Overlay */}
          {searchStatus !== 'idle' && (
             <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-fade-in" onClick={resetScanner}>
                <div 
                  className="bg-slate-900 w-full rounded-t-3xl p-6 pb-10 animate-slide-up shadow-2xl border-t border-slate-700 relative"
                  onClick={e => e.stopPropagation()}
                >
                   {/* Drag Handle */}
                   <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-6 opacity-50"></div>

                   {searchStatus === 'found' && foundItem ? (
                     <div className="text-center">
                        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/40">
                           <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-1">盘点成功</h3>
                        <p className="text-slate-400 text-sm mb-6">SN 已匹配数据库记录</p>
                        
                        <div className="bg-slate-800 rounded-2xl p-4 text-left space-y-3 mb-6 border border-emerald-500/20">
                           <div>
                               <span className="text-[10px] text-slate-500 uppercase font-bold">序列号 (SN)</span>
                               <div className="font-mono text-white text-lg tracking-tight">{foundItem.sn}</div>
                           </div>
                           <div className="h-px bg-slate-700/50"></div>
                           <div className="grid grid-cols-2 gap-4">
                               <div>
                                   <span className="text-[10px] text-slate-500 uppercase font-bold">类型</span>
                                   <div className="text-emerald-400 font-medium">{foundItem.category}</div>
                               </div>
                               <div>
                                   <span className="text-[10px] text-slate-500 uppercase font-bold">型号</span>
                                   <div className="text-slate-200 truncate">{foundItem.model}</div>
                               </div>
                           </div>
                        </div>
                        <button 
                           onClick={resetScanner}
                           className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition-transform"
                        >
                           确认，扫描下一个
                        </button>
                     </div>
                   ) : (
                     <div className="text-center">
                        <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-900/40">
                           <AlertTriangle className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">配件数据不存在</h3>
                        <p className="text-slate-400 text-sm mb-8 px-4 leading-relaxed">
                           数据库中未找到 SN <span className="text-amber-400 font-mono mx-1">{snInput}</span><br/>
                           需要进行拍照识别并补录信息。
                        </p>
                        
                        <div className="flex flex-col gap-3">
                           <button 
                             onClick={() => {
                               setMode('ai_label');
                               setSearchStatus('idle');
                             }}
                             className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                           >
                             <Camera className="w-5 h-5" />
                             拍照识别补录
                           </button>
                           <button 
                             onClick={resetScanner}
                             className="w-full py-4 bg-slate-800 text-slate-400 rounded-2xl font-semibold active:scale-[0.98]"
                           >
                             取消，重新扫描
                           </button>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          )}
        </div>
      )}

      {/* --- MODE: AI LABEL CAMERA --- */}
      {mode === 'ai_label' && (
        <div className="flex-1 relative flex flex-col bg-black">
           <input 
               type="file" 
               accept="image/*" 
               capture="environment" 
               ref={fileInputRef}
               onChange={handleFileChange}
               className="hidden"
           />

           {/* 1. Initial Empty State */}
           {!previewUrl && (
             <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
                <div 
                   onClick={triggerFileSelect}
                   className="w-64 h-64 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center cursor-pointer active:scale-95 transition-transform shadow-[0_0_40px_rgba(0,0,0,0.5)]"
                >
                   <Camera className="w-24 h-24 text-indigo-500" />
                </div>
                <div className="text-center space-y-2">
                   <h2 className="text-2xl font-bold">点击拍照</h2>
                   <p className="text-slate-400 text-sm">对准配件标签，AI 自动提取 SN 和型号</p>
                </div>
                <button onClick={() => setMode('barcode')} className="text-slate-500 underline mt-8">返回扫码模式</button>
             </div>
           )}

           {/* 2. Analysis & Results */}
           {previewUrl && (
             <>
               {/* Background Image Layer (Only shown during analysis) */}
               {isAnalyzing && (
                 <div className="absolute inset-0 bg-black">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-50 mask-image-gradient" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/40 backdrop-blur-sm">
                       <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                       <span className="text-lg font-semibold text-white tracking-wider">正在识别文字...</span>
                    </div>
                 </div>
               )}

               {/* Result Full Screen View */}
               {!isAnalyzing && (hasResults || error) && (
                 <div className="absolute inset-0 z-50 flex flex-col bg-slate-950 animate-in slide-in-from-bottom-8 duration-300">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 shrink-0 pt-safe">
                       <button 
                         onClick={handleCancelAiResult}
                         className="text-slate-400 hover:text-white px-3 py-2 -ml-2 transition-colors font-medium"
                       >
                         取消
                       </button>
                       <h3 className="text-lg font-bold text-white">确认信息</h3>
                       <button 
                         onClick={triggerFileSelect} 
                         className="text-indigo-400 font-medium text-sm px-3 py-2 -mr-2 active:text-indigo-300"
                       >
                          重拍
                       </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
                       {error ? (
                         <div className="p-8 text-center pt-20">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><X className="w-8 h-8"/></div>
                            <p className="text-lg font-bold mb-6 text-white">{error}</p>
                            <button onClick={triggerFileSelect} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">重试</button>
                         </div>
                       ) : (
                         <div className="p-5 space-y-6 pb-32">
                            
                            {/* Form Fields */}
                            <div className="space-y-4 pt-4">
                               <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 focus-within:border-indigo-500/50 transition-all">
                                  <div className="flex justify-between mb-2">
                                    <label className="text-[11px] text-indigo-400 uppercase font-bold tracking-wider">SN 序列号</label>
                                    <Edit3 className="w-3 h-3 text-slate-600" />
                                  </div>
                                  <input
                                     type="text"
                                     value={editableResult.sn}
                                     onChange={e => setEditableResult({...editableResult, sn: e.target.value})}
                                     className="w-full bg-transparent text-xl text-white font-mono font-bold outline-none placeholder-slate-700"
                                     placeholder="--"
                                  />
                               </div>

                               <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 focus-within:border-indigo-500/50 transition-all">
                                  <div className="flex justify-between mb-2">
                                    <label className="text-[11px] text-indigo-400 uppercase font-bold tracking-wider">Model 型号</label>
                                    <Edit3 className="w-3 h-3 text-slate-600" />
                                  </div>
                                  <input
                                     type="text"
                                     value={editableResult.model}
                                     onChange={e => setEditableResult({...editableResult, model: e.target.value})}
                                     className="w-full bg-transparent text-lg text-slate-200 font-medium outline-none placeholder-slate-700"
                                     placeholder="--"
                                  />
                               </div>

                               {/* Category Selector Trigger */}
                               <div 
                                 onClick={() => setShowCategoryPicker(true)}
                                 className="bg-slate-900 p-4 rounded-xl border border-slate-800 active:border-indigo-500/50 active:bg-slate-800 transition-all cursor-pointer"
                               >
                                  <div className="flex justify-between mb-2">
                                    <label className="text-[11px] text-indigo-400 uppercase font-bold tracking-wider">配件类型</label>
                                    <Layers className="w-3 h-3 text-slate-600" />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-lg text-slate-200 font-medium">{editableResult.category}</span>
                                    <ChevronDown className="w-5 h-5 text-slate-500" />
                                  </div>
                               </div>

                               {editableResult.category === '网卡' && (
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 focus-within:border-indigo-500/50 transition-all animate-fade-in">
                                    <div className="flex justify-between mb-2">
                                      <label className="text-[11px] text-indigo-400 uppercase font-bold tracking-wider">硬件版本</label>
                                      <Edit3 className="w-3 h-3 text-slate-600" />
                                    </div>
                                    <input
                                        type="text"
                                        value={editableResult.hardwareVersion}
                                        onChange={e => setEditableResult({...editableResult, hardwareVersion: e.target.value})}
                                        className="w-full bg-transparent text-lg text-slate-200 font-medium outline-none placeholder-slate-700"
                                        placeholder="例如: v1.0"
                                    />
                                </div>
                               )}
                            </div>

                            {/* OCR Chips */}
                            <div>
                               <p className="text-xs text-slate-500 mb-3 font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                                 <ScanLine className="w-3 h-3" /> 点击下方文字自动填入
                               </p>
                               <div className="flex flex-wrap gap-2">
                                  {rawTextSegments.map((text, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setActiveTextSelection(text)}
                                      className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/50 text-sm text-slate-300 active:bg-indigo-600 active:text-white active:border-indigo-500 transition-all text-left break-all"
                                    >
                                      {text}
                                    </button>
                                  ))}
                                  {rawTextSegments.length === 0 && (
                                     <span className="text-slate-600 text-xs italic pl-1">未检测到额外文本</span>
                                  )}
                               </div>
                            </div>
                         </div>
                       )}
                    </div>

                    {/* Fixed Bottom Footer */}
                    {!error && (
                        <div className="p-4 bg-slate-900 border-t border-slate-800 pb-safe-bottom">
                             <button 
                               onClick={handleConfirmAiResult}
                               disabled={!editableResult.sn && !editableResult.model}
                               className="w-full py-4 bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                             >
                               <Check className="w-5 h-5" />
                               确认入库
                             </button>
                        </div>
                    )}
                 </div>
               )}

               {/* Category Selection Sheet (Bottom Sheet) */}
               {showCategoryPicker && (
                 <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-fade-in" onClick={() => setShowCategoryPicker(false)}>
                    <div className="bg-slate-900 w-full rounded-t-3xl p-6 pb-10 shadow-2xl border-t border-slate-700 animate-slide-up" onClick={e => e.stopPropagation()}>
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold text-white">选择配件类型</h3>
                          <button onClick={() => setShowCategoryPicker(false)} className="p-2 bg-slate-800 rounded-full"><X className="w-5 h-5 text-slate-400"/></button>
                       </div>
                       <div className="grid grid-cols-3 gap-3">
                          {COMPONENT_TYPES.map(type => (
                            <button
                              key={type}
                              onClick={() => {
                                setEditableResult(prev => ({ ...prev, category: type }));
                                setShowCategoryPicker(false);
                              }}
                              className={`py-4 rounded-xl font-bold text-sm transition-all ${
                                editableResult.category === type 
                                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 ring-1 ring-indigo-400' 
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>
               )}

               {/* Text Selection Sheet (Level 2 Overlay) */}
               {activeTextSelection !== null && (
                  <div className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-fade-in" onClick={() => setActiveTextSelection(null)}>
                     <div className="bg-slate-800 w-full rounded-t-3xl p-6 pb-10 shadow-2xl border-t border-slate-600" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                           <h4 className="text-sm text-slate-400 font-bold uppercase tracking-wider">编辑选中文字</h4>
                           <button onClick={() => setActiveTextSelection(null)} className="p-1 bg-slate-700 rounded-full"><X className="w-4 h-4 text-slate-300"/></button>
                        </div>
                        
                        <div className="bg-black/30 p-4 rounded-2xl mb-6 border border-slate-600/50">
                           <textarea
                              value={activeTextSelection}
                              onChange={(e) => setActiveTextSelection(e.target.value)}
                              className="w-full bg-transparent text-lg text-white font-mono outline-none resize-none min-h-[3rem]"
                              rows={2}
                           />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                           <button 
                             onClick={() => handleAssignText('sn')}
                             className="py-3.5 bg-indigo-600 active:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                           >
                             <Check className="w-4 h-4" /> 选择为 SN
                           </button>
                           <button 
                             onClick={() => handleAssignText('model')}
                             className="py-3.5 bg-emerald-600 active:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                           >
                             <Check className="w-4 h-4" /> 选择为 Model
                           </button>
                        </div>
                        {editableResult.category === '网卡' && (
                           <button 
                             onClick={() => handleAssignText('hardwareVersion')}
                             className="w-full mt-3 py-3.5 bg-amber-600 active:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                           >
                             <Check className="w-4 h-4" /> 选择为硬件版本
                           </button>
                        )}
                     </div>
                  </div>
               )}
             </>
           )}
        </div>
      )}
    </div>
  );
};

export default Scanner;
