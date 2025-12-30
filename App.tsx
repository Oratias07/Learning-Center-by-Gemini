
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Attachment, Message, AppStatus, Category, Conversation, UserProfile } from './types';
import { askGemini, validateHebrew, generateTitle } from './services/geminiService';
import FileUploader from './components/FileUploader';
import ChatMessage from './components/ChatMessage';
import { 
  Send, GraduationCap, Bot, Menu, Sparkles, LogOut, Moon, Sun, Trash2, 
  ChevronRight, Mic, Plus, Folder, ChevronDown, FolderPlus, FileText, X, Eye, Square,
  RefreshCw, Globe, AlertCircle, Key, Lock, ExternalLink, DownloadCloud, UploadCloud, Share2, Check
} from 'lucide-react';

const DEFAULT_ALGEBRA_FILES: Attachment[] = [
  { name: '1_מבוא_לחבורות.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 102400, extractedText: 'מבוא לחבורות ותתי חבורות' },
  { name: '2_משפטי_לגרנז.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 124000, extractedText: 'משפט לגרנז ותוצאותיו' },
  { name: '3_חבורות_נורמליות.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 98000, extractedText: 'תת חבורות נורמליות וחבורות מנה' },
  { name: '4_הומומורפיזמים.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 115000, extractedText: 'הומומורפיזמים ומשפטי האיזומורפיזם' },
  { name: '5_חוגים_ואידיאלים.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 105000, extractedText: 'מבוא לחוגים, אידיאלים וחוגי מנה' }
];

const SUGGESTED_QUESTIONS = [
  'הסבר לי על משפטי האיזומורפיזם',
  'איך בודקים פריקות פולינום?',
  'מהי חבורת גלואה?',
  'מהו אידיאל מקסימלי?'
];

const App: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('study_shared_global_db_v10');
    return saved ? JSON.parse(saved) : [{ id: 'alg2', name: 'מבנים אלגבריים 2', attachments: DEFAULT_ALGEBRA_FILES, updatedAt: Date.now() }];
  });
  const [allConversations, setAllConversations] = useState<Conversation[]>(() => JSON.parse(localStorage.getItem('study_private_user_chats_v10') || '[]'));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('study_ui_theme_pref') === 'dark');
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
  const [showRespectfulWarning, setShowRespectfulWarning] = useState(false);
  
  // הגדרת משתנה API_KEY בצורה שתזהה גם את Vercel וגם את AI Studio
  const [hasKey, setHasKey] = useState(() => !!process.env.API_KEY);
  const [isCheckingKey, setIsCheckingKey] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkKeyStatus = async () => {
    setIsCheckingKey(true);
    let keyFound = !!process.env.API_KEY;
    
    if (!keyFound && typeof (window as any).aistudio !== 'undefined') {
      try {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        keyFound = selected;
      } catch (e) { console.error(e); }
    }
    
    setHasKey(keyFound);
    setTimeout(() => setIsCheckingKey(false), 800);
  };

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const handleOpenKeyPicker = async () => {
    if (typeof (window as any).aistudio !== 'undefined') {
      try {
        await (window as any).aistudio.openSelectKey();
        setHasKey(true);
      } catch (err) {
        console.error("Failed to open key picker", err);
        setHasKey(true);
      }
    } else {
      setHasKey(true);
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
    localStorage.setItem('study_shared_global_db_v10', JSON.stringify(categories));
    localStorage.setItem('study_private_user_chats_v10', JSON.stringify(allConversations));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [categories, allConversations, darkMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
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
    if (!activeCategory || activeCategory.attachments.length === 0) { 
      setShowRespectfulWarning(true); 
      setTimeout(() => setShowRespectfulWarning(false), 3000); 
      return; 
    }

    setInput('');
    setStatus(AppStatus.PROCESSING);
    
    let convId = activeConvId;
    if (!convId) {
      convId = Date.now().toString();
      // יצירת שיחה חדשה באופן מיידי בממשק
      const initialTitle = "שיחה חדשה...";
      setAllConversations(prev => [{ 
        id: convId!, 
        title: initialTitle, 
        messages: [], 
        updatedAt: Date.now(), 
        categoryId: activeCategoryId, 
        userId: 'guest' 
      }, ...prev]);
      setActiveConvId(convId);
      
      // יצירת כותרת אמיתית ברקע
      generateTitle(msg).then(title => {
        setAllConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
      });
    }

    const streamMsgId = (Date.now() + 1).toString();
    const userMsgId = Date.now().toString();

    // הוספת הודעת המשתמש והכנה להודעת המודל - מיידית!
    setAllConversations(prev => prev.map(c => c.id === convId ? { 
      ...c, 
      messages: [
        ...c.messages, 
        { id: userMsgId, role: 'user', text: msg, timestamp: Date.now() }, 
        { id: streamMsgId, role: 'model', text: '', timestamp: Date.now(), isStreaming: true }
      ], 
      updatedAt: Date.now() 
    } : c));
    
    setStatus(AppStatus.STREAMING);
    abortControllerRef.current = new AbortController();

    // שליפת שיחות קודמות באותה קטגוריה להקשר
    const otherConvs = allConversations
      .filter(c => c.categoryId === activeCategoryId && c.id !== convId)
      .slice(0, 3);

    try {
      const response = await askGemini(msg, messages, activeCategory.attachments, otherConvs, (text) => {
        setAllConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.map(m => m.id === streamMsgId ? { ...m, text } : m) } : c));
      }, abortControllerRef.current.signal);
      
      const validated = await validateHebrew(response);
      setAllConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.map(m => m.id === streamMsgId ? { ...m, text: validated, isStreaming: false } : m) } : c));
      setStatus(AppStatus.IDLE);
    } catch (err: any) {
      if (err.message === 'KEY_NOT_FOUND') setHasKey(false);
      setStatus(AppStatus.IDLE);
      // ניקוי הודעת סטרימינג שנכשלה
      setAllConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: c.messages.filter(m => m.id !== streamMsgId) } : c));
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

  const generateSyncCode = () => {
    try {
      const data = { categories, allConversations };
      const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      navigator.clipboard.writeText(base64);
      alert("קוד הסנכרון הועתק! ניתן להדביק אותו בכל מכשיר אחר.");
    } catch (e) { alert("שגיאה ביצירת קוד."); }
  };

  const handleImportSync = () => {
    try {
      const json = decodeURIComponent(escape(atob(syncCodeInput)));
      const data = JSON.parse(json);
      if (confirm("פעולה זו תחליף את המידע הקיים. האם להמשיך?")) {
        setCategories(data.categories || []);
        setAllConversations(data.allConversations || []);
        setShowSyncModal(false);
        setSyncCodeInput('');
      }
    } catch (e) { alert("קוד לא תקין."); }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#131314] overflow-hidden text-slate-900 dark:text-[#e3e3e3] font-sans transition-colors duration-300">
      
      {/* מסך חסימה חכם */}
      {!hasKey && (
        <div className="fixed inset-0 z-[200] bg-[#f8fafd] dark:bg-[#131314] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-blue-600/10 text-blue-600 rounded-[30px] flex items-center justify-center mb-8 shadow-xl animate-pulse">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-black mb-4 tracking-tight">נחבר אותך לרגע...</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm leading-relaxed text-sm">
            אם הגדרת את המפתח ב-Vercel והאפליקציה פרוסה, תוכל ללחוץ על "המשך". בטלפון של חבר כדאי להשתמש ב-AI Studio.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={handleOpenKeyPicker} className="w-full py-4 bg-blue-600 text-white rounded-[20px] font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
              <Key size={20} /> בחר מפתח (AI Studio)
            </button>
            <button onClick={() => setHasKey(true)} className="w-full py-4 border-2 border-slate-200 dark:border-slate-800 rounded-[20px] font-bold text-slate-500 active:bg-slate-100 dark:active:bg-slate-800 transition-all">
              המשך (המפתח כבר ב-Vercel)
            </button>
            <button onClick={checkKeyStatus} className={`mt-4 text-xs font-bold text-blue-500 flex items-center justify-center gap-2 ${isCheckingKey ? 'opacity-50' : ''}`}>
              <RefreshCw size={14} className={isCheckingKey ? 'animate-spin' : ''} /> בדוק שוב
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative inset-y-0 right-0 z-50 w-72 md:w-80 bg-[#f0f4f9] dark:bg-[#1e1f20] border-l border-slate-200 dark:border-transparent transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-2"><GraduationCap className="text-blue-600" size={20}/><h2 className="font-bold text-sm">האקדמיה של Gemini</h2></div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2"><ChevronRight size={18} /></button>
        </div>
        <button onClick={() => { setActiveConvId(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="mx-4 mb-4 flex items-center gap-3 p-3 bg-white dark:bg-[#28292a] rounded-full shadow-sm text-sm font-medium hover:bg-slate-50 dark:hover:bg-[#333537] transition-all">
          <Plus size={20} className="text-blue-500" /> <span>שיחה חדשה</span>
        </button>
        <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
          {categories.map(cat => (
            <div key={cat.id} className="mb-2">
              <div onClick={() => setActiveCategoryId(cat.id)} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer text-sm font-medium transition-colors ${activeCategoryId === cat.id ? 'bg-[#d3e3fd] dark:bg-[#004a77] text-[#041e49] dark:text-[#c2e7ff]' : 'hover:bg-[#e1e5e9] dark:hover:bg-[#333537]'}`}>
                <Folder size={18} /> <span className="truncate">{cat.name}</span>
              </div>
              {activeCategoryId === cat.id && (
                <div className="mt-1 mr-6 space-y-1">
                  {allConversations.filter(c => c.categoryId === cat.id).map(conv => (
                    <div key={conv.id} onClick={() => { setActiveConvId(conv.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`p-2 rounded-lg text-xs truncate cursor-pointer ${activeConvId === conv.id ? 'bg-white dark:bg-[#333537] font-bold' : 'hover:bg-slate-200 dark:hover:bg-[#3c3d3e]'}`}>
                      {conv.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
           <button onClick={() => setShowSyncModal(true)} className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-[#333537] text-blue-600 dark:text-blue-400 rounded-xl text-sm font-bold transition-all">
             <Share2 size={18} /> <span>סנכרון וגיבוי</span>
           </button>
           <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-200 dark:hover:bg-[#333537] rounded-xl text-sm font-medium">
             {darkMode ? <Sun size={18} /> : <Moon size={18} />} <span>{darkMode ? 'מצב יום' : 'מצב לילה'}</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-[#333537] rounded-full"><Menu size={24} /></button>}
            <div className="text-xl font-medium tracking-tight">Gemini</div>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">U</div>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar pb-32">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {!activeConversation ? (
              <div className="mt-6 space-y-10">
                <div className="space-y-4 text-center md:text-right">
                  <h1 className="text-4xl md:text-5xl font-medium bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 bg-clip-text text-transparent">שלום, אני Gemini</h1>
                  <p className="text-2xl md:text-3xl text-[#444746] dark:text-[#c4c7c5]">איך אפשר לעזור לך ללמוד היום?</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => handleSend(undefined, q)} className="p-4 text-right bg-[#f0f4f9] dark:bg-[#1e1f20] hover:bg-[#e1e5e9] dark:hover:bg-[#333537] rounded-2xl text-sm transition-all shadow-sm">
                      {q}
                    </button>
                  ))}
                </div>

                <div className="p-5 bg-white dark:bg-[#1e1f20] border border-slate-200 dark:border-[#444746] rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><FileText className="text-blue-500" /> <h3 className="font-bold text-sm">חומרי לימוד ({activeCategory?.attachments.length || 0})</h3></div>
                    <button onClick={() => setShowFileManager(!showFileManager)} className="text-blue-500 text-xs font-bold uppercase tracking-wider">{showFileManager ? 'סגור' : 'נהל'}</button>
                  </div>
                  {showFileManager ? <FileUploader attachments={activeCategory?.attachments || []} onUpload={handleUpload} onRemove={handleRemoveFile} /> : (
                    <div className="flex flex-wrap gap-2">
                      {activeCategory?.attachments.map(f => (
                        <div key={f.name} onClick={() => setViewingFile(f)} className="px-3 py-2 bg-slate-50 dark:bg-[#333537] rounded-xl text-[11px] cursor-pointer flex items-center gap-2 hover:bg-slate-100 transition-colors border border-slate-100 dark:border-transparent font-medium shadow-sm"><Eye size={12} className="text-slate-400" /> {f.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8 mt-4">
                {messages.map(m => <ChatMessage key={m.id} message={m} />)}
              </div>
            )}
          </div>
        </div>

        {/* Input Bar */}
        <div className="fixed bottom-0 left-0 right-0 lg:pr-80 p-3 md:p-4 bg-gradient-to-t from-white dark:from-[#131314] via-white/95 dark:via-[#131314]/95 to-transparent z-30">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSend} className="relative flex items-center gap-1 md:gap-2 bg-[#f0f4f9] dark:bg-[#1e1f20] rounded-[28px] md:rounded-[32px] p-1.5 focus-within:bg-white dark:focus-within:bg-[#28292a] focus-within:shadow-xl transition-all border border-transparent focus-within:border-blue-100 dark:focus-within:border-blue-900/30">
              <button type="button" onClick={() => setShowFileManager(true)} className="p-2.5 md:p-3 text-slate-500 hover:bg-slate-200 dark:hover:bg-[#333537] rounded-full transition-colors"><Plus size={22} /></button>
              <textarea 
                ref={textareaRef} 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSend(); }}} 
                placeholder="הזן שאלה כאן" 
                className="flex-1 bg-transparent border-none py-3 px-1 md:px-2 resize-none outline-none text-right text-[15px] md:text-base leading-relaxed placeholder:text-[#444746] dark:placeholder:text-[#c4c7c5] max-h-[160px] min-h-[44px]"
                rows={1}
              />
              <div className="flex items-center gap-1 pr-1">
                <button type="button" onClick={() => { if(isListening) recognitionRef.current.stop(); else { setIsListening(true); recognitionRef.current.start(); }}} className={`p-2.5 md:p-3 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-md' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-[#333537]'}`}><Mic size={22} /></button>
                {(input.trim() || status === AppStatus.STREAMING) && (
                  status === AppStatus.STREAMING ? (
                    <button type="button" onClick={() => abortControllerRef.current?.abort()} className="p-2.5 md:p-3 text-red-500 hover:bg-red-50 dark:hover:bg-[#333537] rounded-full transition-all"><Square size={22} fill="currentColor" /></button>
                  ) : (
                    <button type="submit" className="p-2.5 md:p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-[#333537] rounded-full transition-all active:scale-90"><Send size={22} /></button>
                  )
                )}
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1e1f20] w-full max-w-lg rounded-[32px] overflow-hidden p-6 md:p-10 shadow-2xl text-right">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">סנכרון וגיבוי</h3>
              <button onClick={() => setShowSyncModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={24}/></button>
            </div>
            
            <div className="space-y-8">
              <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <h4 className="font-black text-sm mb-2 text-blue-800 dark:text-blue-300">ייצוא מידע</h4>
                <p className="text-xs text-blue-600/80 mb-4 font-medium">העתק את הקוד והדבק אותו במכשיר השני.</p>
                <button onClick={generateSyncCode} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                  <Share2 size={16} /> העתק קוד סנכרון
                </button>
              </div>

              <div className="p-5 bg-slate-50 dark:bg-[#28292a] rounded-2xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-black text-sm mb-2">ייבוא מידע</h4>
                <textarea 
                  value={syncCodeInput}
                  onChange={(e) => setSyncCodeInput(e.target.value)}
                  placeholder="הדבק קוד כאן..."
                  className="w-full h-24 p-3 bg-white dark:bg-[#131314] border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-mono mb-4 outline-none text-left"
                  dir="ltr"
                />
                <button onClick={handleImportSync} className="w-full py-3 bg-slate-900 dark:bg-blue-900/40 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                  <DownloadCloud size={16} /> סנכרן נתונים
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 md:bg-black/80 backdrop-blur-sm p-0 md:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1e1f20] w-full h-full md:h-[85vh] md:max-w-4xl md:rounded-3xl overflow-hidden flex flex-col">
            <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3"><FileText size={20} className="text-blue-500" /><h3 className="font-bold truncate text-sm">{viewingFile.name}</h3></div>
              <button onClick={() => setViewingFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={28} /></button>
            </div>
            <div className="flex-1 overflow-auto bg-[#f0f4f9] dark:bg-[#131314] flex justify-center">
              {viewingFile.mimeType === 'application/pdf' ? (
                <iframe src={`data:application/pdf;base64,${viewingFile.data}`} className="w-full h-full bg-white" title={viewingFile.name} />
              ) : (
                <div className="w-full max-w-2xl bg-white dark:bg-[#1e1f20] p-6 md:p-10 text-right whitespace-pre-wrap font-mono text-sm leading-relaxed">{viewingFile.extractedText || "אין טקסט זמין לצפייה."}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        ::placeholder { text-align: right; }
        textarea { unicode-bidi: plaintext; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
};

export default App;
