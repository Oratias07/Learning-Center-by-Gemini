
import React, { useState, useEffect, useRef } from 'react';
import { Attachment, Message, AppStatus, Category, Conversation } from './types';
import { askGemini, validateHebrew, generateTitle } from './services/geminiService';
import FileUploader from './components/FileUploader';
import ChatMessage from './components/ChatMessage';
import { 
  Send, GraduationCap, Menu, Plus, Folder, FileText, X, Eye, Square,
  RefreshCw, Key, Lock, Share2, Sun, Moon, Sparkles, Mic
} from 'lucide-react';

const App: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('study_v13_db');
    return saved ? JSON.parse(saved) : [{ id: 'general', name: 'לימודים כללי', attachments: [], updatedAt: Date.now() }];
  });
  const [allConversations, setAllConversations] = useState<Conversation[]>(() => JSON.parse(localStorage.getItem('study_v13_chats') || '[]'));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('study_theme') === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(categories[0]?.id || null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isListening, setIsListening] = useState(false);
  const [viewingFile, setViewingFile] = useState<Attachment | null>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  
  // Smart detection: Assume we have a key unless a call fails
  const [hasKey, setHasKey] = useState(true); 
  const [showLockScreen, setShowLockScreen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Initial check but don't block
    const key = process.env.API_KEY;
    if (!key || key === 'undefined') {
      // Check if user already unlocked via AI Studio in this session
      if (typeof (window as any).aistudio !== 'undefined') {
        (window as any).aistudio.hasSelectedApiKey().then((has: boolean) => {
          if (!has) setShowLockScreen(true);
        });
      } else {
        setShowLockScreen(true);
      }
    }
  }, []);

  const handleOpenKeyPicker = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      try {
        await (window as any).aistudio.openSelectKey();
        setShowLockScreen(false);
        setHasKey(true);
      } catch (err) {
        setShowLockScreen(false);
      }
    } else {
      setShowLockScreen(false);
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'he-IL';
      recognitionRef.current.onresult = (e: any) => { setInput(prev => prev + e.results[0][0].transcript); setIsListening(false); };
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('study_v13_db', JSON.stringify(categories));
    localStorage.setItem('study_v13_chats', JSON.stringify(allConversations));
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('study_theme', darkMode ? 'dark' : 'light');
  }, [categories, allConversations, darkMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [allConversations, status]);

  const activeCategory = categories.find(c => c.id === activeCategoryId);
  const activeConversation = allConversations.find(c => c.id === activeConvId);
  const messages = activeConversation?.messages || [];

  const handleSend = async (e?: React.FormEvent, customInput?: string) => {
    e?.preventDefault();
    const msg = customInput || input;
    if (!msg.trim() || status !== AppStatus.IDLE || !activeCategoryId) return;
    
    setInput('');
    setStatus(AppStatus.PROCESSING);
    
    let convId = activeConvId;
    if (!convId) {
      convId = Date.now().toString();
      setAllConversations(prev => [{ 
        id: convId!, 
        title: "שיחה חדשה...", 
        messages: [], 
        updatedAt: Date.now(), 
        categoryId: activeCategoryId, 
        userId: 'guest' 
      }, ...prev]);
      setActiveConvId(convId);
      
      generateTitle(msg).then(title => {
        setAllConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
      });
    }

    const userMsgId = Date.now().toString();
    const botMsgId = (Date.now() + 1).toString();

    // IMMEDIATE RENDER - The "Throw" effect
    setAllConversations(prev => prev.map(c => c.id === convId ? { 
      ...c, 
      messages: [
        ...c.messages, 
        { id: userMsgId, role: 'user', text: msg, timestamp: Date.now() }, 
        { id: botMsgId, role: 'model', text: '', timestamp: Date.now(), isStreaming: true }
      ], 
      updatedAt: Date.now() 
    } : c));
    
    setStatus(AppStatus.STREAMING);
    abortControllerRef.current = new AbortController();

    // Cross-conversation memory within the same category
    const otherConversations = allConversations
      .filter(c => c.categoryId === activeCategoryId && c.id !== convId)
      .slice(0, 3); // Last 3 relevant conversations

    try {
      const response = await askGemini(msg, messages, activeCategory?.attachments || [], otherConversations, (text) => {
        setAllConversations(prev => prev.map(c => c.id === convId ? { 
          ...c, 
          messages: c.messages.map(m => m.id === botMsgId ? { ...m, text } : m) 
        } : c));
      }, abortControllerRef.current.signal);
      
      const validated = await validateHebrew(response);
      setAllConversations(prev => prev.map(c => c.id === convId ? { 
        ...c, 
        messages: c.messages.map(m => m.id === botMsgId ? { ...m, text: validated, isStreaming: false } : m) 
      } : c));
      setStatus(AppStatus.IDLE);
    } catch (err: any) {
      if (err.message === 'KEY_NOT_FOUND') {
        setShowLockScreen(true);
      }
      setStatus(AppStatus.IDLE);
      setAllConversations(prev => prev.map(c => c.id === convId ? { 
        ...c, 
        messages: c.messages.map(m => m.id === botMsgId ? { ...m, text: "שגיאת מפתח API. וודא שהגדרת אותו ב-Vercel וביצעת Redeploy.", isStreaming: false } : m) 
      } : c));
    }
  };

  const handleUpload = (newFiles: Attachment[]) => {
    if (!activeCategoryId) return;
    setCategories(prev => prev.map(cat => cat.id === activeCategoryId ? { ...cat, attachments: [...cat.attachments, ...newFiles], updatedAt: Date.now() } : cat));
  };

  const handleRemoveFile = (fileName: string) => {
    if (!activeCategoryId) return;
    setCategories(prev => prev.map(cat => cat.id === activeCategoryId ? { ...cat, attachments: cat.attachments.filter(a => a.name !== fileName), updatedAt: Date.now() } : cat));
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#131314] overflow-hidden text-slate-900 dark:text-[#e3e3e3] font-sans transition-colors duration-300">
      
      {/* Smart Blocking Overlay - Only shows if actually needed */}
      {showLockScreen && (
        <div className="fixed inset-0 z-[200] bg-white dark:bg-[#131314] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-blue-500/10 text-blue-500 rounded-[30px] flex items-center justify-center mb-8 shadow-xl animate-bounce-slow">
            <Lock size={36} />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight">נחבר אותך ללימודים</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm leading-relaxed text-sm">
            אם הגדרת את המפתח ב-Vercel, לחץ על המשך. אם לא, בחר מפתח דרך AI Studio.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={handleOpenKeyPicker} className="w-full py-4 bg-blue-600 text-white rounded-[20px] font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              <Key size={18} /> בחר מפתח (AI Studio)
            </button>
            <button onClick={() => setShowLockScreen(false)} className="w-full py-4 border-2 border-slate-100 dark:border-slate-800 rounded-[20px] font-bold text-slate-400 hover:text-slate-600 transition-all">
              המשך (המפתח ב-Vercel)
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative inset-y-0 right-0 z-50 w-72 md:w-80 bg-[#f8fafd] dark:bg-[#1e1f20] border-l border-slate-100 dark:border-transparent transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 font-black text-blue-600 text-sm tracking-tighter uppercase"><GraduationCap size={20}/> עוזר הלימודים</div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2"><X size={18} /></button>
        </div>
        <button onClick={() => { setActiveConvId(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="mx-4 mb-4 flex items-center gap-3 p-4 bg-white dark:bg-[#28292a] rounded-2xl shadow-sm text-sm font-black hover:scale-[1.02] transition-all border border-slate-50 dark:border-transparent">
          <Plus size={20} className="text-blue-500" strokeWidth={3} /> <span>שיחה חדשה</span>
        </button>
        <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
          {categories.map(cat => (
            <div key={cat.id} className="mb-2 px-2">
              <div onClick={() => setActiveCategoryId(cat.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer text-sm font-bold transition-all ${activeCategoryId === cat.id ? 'bg-blue-50 dark:bg-[#004a77] text-blue-700 dark:text-[#c2e7ff]' : 'hover:bg-slate-100 dark:hover:bg-[#333537]'}`}>
                <Folder size={18} /> <span className="truncate">{cat.name}</span>
              </div>
              {activeCategoryId === cat.id && (
                <div className="mt-1 mr-6 space-y-1">
                  {allConversations.filter(c => c.categoryId === cat.id).map(conv => (
                    <div key={conv.id} onClick={() => { setActiveConvId(conv.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`p-2.5 rounded-lg text-[11px] font-medium truncate cursor-pointer ${activeConvId === conv.id ? 'bg-white dark:bg-[#333537] shadow-sm font-black' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
                      {conv.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
           <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-[#333537] rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400">
             {darkMode ? <Sun size={16} /> : <Moon size={16} />} <span>{darkMode ? 'מצב יום' : 'מצב לילה'}</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 z-40 bg-white/80 dark:bg-[#131314]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-[#333537] rounded-full"><Menu size={22} /></button>}
            <div className="text-lg font-black tracking-tight flex items-center gap-2">Gemini <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full">EXAM</span></div>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar pb-40">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {!activeConversation ? (
              <div className="mt-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center md:text-right">
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent py-2">שלום, אני Gemini</h1>
                  <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-medium">אעזור לך ללמוד למבחן על בסיס החומרים שלך.</p>
                </div>
                
                <div className="p-6 bg-white dark:bg-[#1e1f20] border border-slate-100 dark:border-[#444746] rounded-[32px] space-y-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><FileText className="text-blue-500" /> <h3 className="font-black text-sm uppercase">חומרי לימוד ({activeCategory?.attachments.length || 0})</h3></div>
                    <button onClick={() => setShowFileManager(!showFileManager)} className="px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white rounded-full text-[10px] font-black uppercase">{showFileManager ? 'סגור' : 'נהל קבצים'}</button>
                  </div>
                  {showFileManager ? <FileUploader attachments={activeCategory?.attachments || []} onUpload={handleUpload} onRemove={handleRemoveFile} /> : (
                    <div className="flex flex-wrap gap-2">
                      {activeCategory?.attachments.map(f => (
                        <div key={f.name} onClick={() => setViewingFile(f)} className="px-4 py-2 bg-slate-50 dark:bg-[#333537] rounded-xl text-[10px] cursor-pointer flex items-center gap-2 hover:bg-blue-50 transition-colors border border-slate-100 dark:border-transparent font-black shadow-sm group">
                          <Eye size={12} className="text-slate-400 group-hover:text-blue-500" /> 
                          {f.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 md:space-y-8 mt-4">
                {messages.map(m => <ChatMessage key={m.id} message={m} />)}
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Bar */}
        <div className="fixed bottom-0 left-0 right-0 lg:pr-80 p-4 md:p-6 bg-gradient-to-t from-white dark:from-[#131314] via-white/80 dark:via-[#131314]/80 to-transparent z-30">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSend} className="relative flex items-center gap-2 bg-[#f0f4f9] dark:bg-[#1e1f20] rounded-[30px] md:rounded-[40px] p-2 focus-within:bg-white dark:focus-within:bg-[#28292a] focus-within:shadow-2xl transition-all border-2 border-transparent focus-within:border-blue-400/20">
              <button type="button" onClick={() => setShowFileManager(true)} className="p-3 text-slate-500 hover:bg-slate-200 dark:hover:bg-[#333537] rounded-full transition-colors"><Plus size={24} strokeWidth={3} /></button>
              <textarea 
                ref={textareaRef} 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSend(); }}} 
                placeholder="שאל שאלה על החומר..." 
                className="flex-1 bg-transparent border-none py-3 px-2 resize-none outline-none text-right text-[15px] md:text-base font-bold leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 max-h-[180px] min-h-[44px]"
                rows={1}
              />
              <div className="flex items-center gap-1 pr-1">
                <button type="button" onClick={() => { if(isListening) recognitionRef.current.stop(); else { setIsListening(true); recognitionRef.current.start(); }}} className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-[#333537]'}`}><Mic size={22} /></button>
                {(input.trim() || status === AppStatus.STREAMING) && (
                  status === AppStatus.STREAMING ? (
                    <button type="button" onClick={() => abortControllerRef.current?.abort()} className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-[#333537] rounded-full"><Square size={22} fill="currentColor" /></button>
                  ) : (
                    <button type="submit" className="p-3 bg-blue-600 text-white hover:bg-blue-700 rounded-full transition-all shadow-lg shadow-blue-500/20"><Send size={22} /></button>
                  )
                )}
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-0 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1e1f20] w-full h-full md:h-[90vh] md:max-w-5xl md:rounded-[40px] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600"><FileText size={20} /></div>
                <div><h3 className="font-black truncate text-base">{viewingFile.name}</h3></div>
              </div>
              <button onClick={() => setViewingFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={32} /></button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#131314] flex justify-center custom-scrollbar">
              {viewingFile.mimeType === 'application/pdf' ? (
                <iframe src={`data:application/pdf;base64,${viewingFile.data}`} className="w-full h-full bg-white" title={viewingFile.name} />
              ) : (
                <div className="w-full max-w-3xl bg-white dark:bg-[#1e1f20] p-10 md:p-16 text-right whitespace-pre-wrap font-mono text-sm leading-loose">{viewingFile.extractedText || "אין טקסט זמין לצפייה."}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
        ::placeholder { text-align: right; }
        textarea { unicode-bidi: plaintext; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
};

export default App;
