
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Attachment, Message, AppStatus, Category, Conversation, UserProfile } from './types';
import { askGemini, validateHebrew, generateTitle } from './services/geminiService';
import FileUploader from './components/FileUploader';
import ChatMessage from './components/ChatMessage';
import { 
  Send, GraduationCap, Bot, Menu, Sparkles, LogOut, Moon, Sun, Trash2, 
  ChevronRight, Mic, Plus, Folder, ChevronDown, FolderPlus, FileText, X, Eye, Square,
  RefreshCw, Globe, AlertCircle, Maximize2, Download
} from 'lucide-react';

// Pre-loaded files for "מבנים אלגבריים 2" - Exactly 10 files
const DEFAULT_ALGEBRA_FILES: Attachment[] = [
  { name: 'AS2_Targil_1_Groups.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 102400, extractedText: 'תרגיל 1: חבורות ותתי חבורות, משפט לגרנז' },
  { name: 'AS2_Targil_2_Normal_Subgroups.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 124000, extractedText: 'תרגיל 2: תתי חבורות נורמליות וחבורות מנה' },
  { name: 'AS2_Targil_3_Homomorphisms.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 98000, extractedText: 'תרגיל 3: הומומורפיזמים ומשפטי האיזומורפיזם' },
  { name: 'AS2_Targil_4_Rings.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 115000, extractedText: 'תרגיל 4: מבוא לחוגים, אידיאלים ותתי חוגים' },
  { name: 'AS2_Targil_5_Ideals_and_Quotients.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 105000, extractedText: 'תרגיל 5: אידיאלים, חוגי מנה ומשפטי איזומורפיזם לחוגים' },
  { name: 'AS2_Targil_6_Polynomial_Rings.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 130000, extractedText: 'תרגיל 6: חוגי פולינומים, פריקות וקריטריון אייזנשטיין' },
  { name: 'AS2_Targil_7_Fields_Extensions.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 110000, extractedText: 'תרגיל 7: הרחבות שדות, דרגת הרחבה ושדות פיצול' },
  { name: 'AS2_Targil_8_Galois_Theory_Intro.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 140000, extractedText: 'תרגיל 8: מבוא לתורת גלואה, חבורת גלואה והתאמת גלואה' },
  { name: 'AS2_Summary_Course_Final.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 256000, extractedText: 'סיכום קורס מבנים אלגבריים 2 - כל המשפטים וההגדרות' },
  { name: 'AS2_Formula_Sheet.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 85000, extractedText: 'דף נוסחאות מרוכז למבחן במבנים אלגבריים 2' }
];

// Suggested questions for the landing screen
const SUGGESTED_QUESTIONS = [
  'הסבר לי על משפטי האיזומורפיזם של חבורות',
  'איך בודקים אם פולינום הוא אי-פריק לפי קריטריון אייזנשטיין?',
  'מהי חבורת גלואה של הרחבת שדות?',
  'מה ההבדל בין אידיאל מקסימלי לאידיאל ראשוני?'
];

const FileViewerModal: React.FC<{ file: Attachment | null; onClose: () => void }> = ({ file, onClose }) => {
  if (!file) return null;
  const isPDF = file.mimeType === 'application/pdf';
  const isImage = file.mimeType.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 md:p-8 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#1c2128] w-full max-w-5xl h-[90vh] rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-500" />
            <h3 className="text-sm font-black truncate max-w-[200px] md:max-w-md">{file.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose} 
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0d1117] flex items-center justify-center p-4">
          {isPDF ? (
            <iframe 
              src={`data:application/pdf;base64,${file.data}`} 
              className="w-full h-full border-none rounded-xl bg-white" 
              title={file.name}
            />
          ) : isImage ? (
            <img 
              src={`data:${file.mimeType};base64,${file.data}`} 
              className="max-w-full max-h-full object-contain rounded-xl shadow-lg" 
              alt={file.name} 
            />
          ) : (
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 text-right leading-relaxed whitespace-pre-wrap font-mono text-sm">
              {file.extractedText || "אין תוכן טקסטואלי זמין לצפייה."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void; onLogin: (provider: string) => void }> = ({ isOpen, onClose, onLogin }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1c2128] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
              <GraduationCap size={32} />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">כניסה למערכת</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">התחברות זו מאפשרת סנכרון ושמירה של היסטוריית הלמידה שלך בענן (בגרסת דמו זו, המידע נשמר בדפדפן תחת זהות המשתמש שלך).</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => onLogin('Google')} className="w-full flex items-center justify-center gap-3 py-3.5 bg-white dark:bg-[#2d333b] border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm active:scale-95">
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" /> המשך עם Google
            </button>
            <button onClick={() => onLogin('Apple')} className="w-full flex items-center justify-center gap-3 py-3.5 bg-black text-white rounded-2xl hover:bg-slate-900 transition-all font-bold shadow-sm active:scale-95">
               המשך עם Apple
            </button>
          </div>
          <div className="pt-2">
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors underline underline-offset-4">המשך כאורח (מידע לא יישמר בשימוש ממכשירים אחרים)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const GLOBAL_KNOWLEDGE_KEY = 'study_shared_global_db_v4';
  const PRIVATE_HISTORY_KEY = 'study_private_user_chats_v4';
  const THEME_KEY = 'study_ui_theme_pref';
  const USER_KEY = 'study_active_user';

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(GLOBAL_KNOWLEDGE_KEY);
    if (saved) return JSON.parse(saved);
    return [{
      id: 'algebraic-structures-2',
      name: 'מבנים אלגבריים 2',
      attachments: DEFAULT_ALGEBRA_FILES,
      updatedAt: Date.now()
    }];
  });

  const [allConversations, setAllConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(PRIVATE_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(categories[0]?.id || null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([categories[0]?.id]));
  const [showRespectfulWarning, setShowRespectfulWarning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [viewingFile, setViewingFile] = useState<Attachment | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const currentUserId = user ? user.id : 'guest';

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'he-IL';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => (prev ? prev + ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const handleMicToggle = () => {
    if (!recognitionRef.current) {
      alert("הדפדפן שלך לא תומך בזיהוי קולי.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { localStorage.setItem(GLOBAL_KNOWLEDGE_KEY, JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(PRIVATE_HISTORY_KEY, JSON.stringify(allConversations)); }, [allConversations]);
  useEffect(() => { if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY); }, [user]);
  
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) html.classList.add('dark'); else html.classList.remove('dark');
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 180);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [allConversations, status]);

  const userConversations = useMemo(() => allConversations.filter(c => c.userId === currentUserId), [allConversations, currentUserId]);
  const activeCategory = useMemo(() => categories.find(c => c.id === activeCategoryId), [categories, activeCategoryId]);
  const activeConversation = useMemo(() => userConversations.find(c => c.id === activeConvId), [userConversations, activeConvId]);
  const messages = activeConversation?.messages || [];

  const toggleCategoryExpansion = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = new Set(expandedCategories);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedCategories(next);
  };

  const selectCategory = (id: string) => {
    setActiveCategoryId(id);
    setActiveConvId(null);
    setShowFileManager(false);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    if (!expandedCategories.has(id)) toggleCategoryExpansion(id);
  };

  const handleLogin = (provider: string) => {
    const newUser = { 
      id: `user_${Date.now()}`, 
      name: `סטודנט ${provider}`, 
      email: `student@demo.com`, 
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}` 
    };
    setAllConversations(prev => prev.map(c => c.userId === 'guest' ? { ...c, userId: newUser.id } : c));
    setUser(newUser);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => { 
    if (confirm('להתנתק? השיחות שלך יישמרו בחשבון זה.')) { 
      setUser(null); 
      setActiveConvId(null); 
    } 
  };

  const createCategory = () => {
    const name = prompt('שם הקטגוריה החדשה במאגר המשותף:');
    if (!name) return;
    const newCat: Category = { id: Date.now().toString(), name, attachments: [], updatedAt: Date.now() };
    setCategories(prev => [newCat, ...prev]);
    setActiveCategoryId(newCat.id);
    setActiveConvId(null);
  };

  const deleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('מחיקת קטגוריה תמחק אותה לכולם. להמשיך?')) return;
    setCategories(prev => prev.filter(c => c.id !== id));
    if (activeCategoryId === id) setActiveCategoryId(null);
  };

  const handleUpload = (newFiles: Attachment[]) => {
    if (!activeCategoryId) return;
    setCategories(prev => prev.map(cat => cat.id !== activeCategoryId ? cat : { ...cat, attachments: [...cat.attachments, ...newFiles], updatedAt: Date.now() }));
    setShowRespectfulWarning(false);
  };

  const handleRemoveFile = (fileName: string) => {
    if (!activeCategoryId) return;
    setCategories(prev => prev.map(cat => cat.id !== activeCategoryId ? cat : { ...cat, attachments: cat.attachments.filter(a => a.name !== fileName), updatedAt: Date.now() }));
  };

  const handleStop = () => { abortControllerRef.current?.abort(); setStatus(AppStatus.IDLE); };

  const handleSend = async (e?: React.FormEvent, customInput?: string) => {
    e?.preventDefault();
    const messageToSend = customInput || input;
    if (!messageToSend.trim() || status !== AppStatus.IDLE || !activeCategoryId) return;

    if (!activeCategory || (activeCategory.attachments.length === 0 && !activeConversation)) {
      setShowRespectfulWarning(true);
      setTimeout(() => setShowRespectfulWarning(false), 4000);
      return;
    }

    const currentInput = messageToSend;
    setInput('');
    setStatus(AppStatus.PROCESSING);
    
    let convId = activeConvId;
    if (!convId) {
      convId = Date.now().toString();
      const title = await generateTitle(currentInput);
      const newConv: Conversation = { id: convId, title, messages: [], updatedAt: Date.now(), categoryId: activeCategoryId, userId: currentUserId };
      setAllConversations(prev => [newConv, ...prev]);
      setActiveConvId(convId);
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: currentInput, timestamp: Date.now() };
    const streamMsgId = (Date.now() + 1).toString();

    setAllConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));
    setAllConversations(prev => prev.map(c => c.id === convId ? { 
      ...c, 
      messages: [...c.messages, { id: streamMsgId, role: 'model', text: '', timestamp: Date.now(), isStreaming: true }] 
    } : c));

    setStatus(AppStatus.STREAMING);
    abortControllerRef.current = new AbortController();

    try {
      const response = await askGemini(
        currentInput, 
        messages, 
        activeCategory.attachments, 
        (text) => {
          setAllConversations(prev => prev.map(c => c.id === convId ? {
            ...c,
            messages: c.messages.map(m => m.id === streamMsgId ? { ...m, text } : m)
          } : c));
        },
        abortControllerRef.current.signal
      );
      
      const validated = await validateHebrew(response);
      setAllConversations(prev => prev.map(c => c.id === convId ? {
        ...c,
        messages: c.messages.map(m => m.id === streamMsgId ? { ...m, text: validated, isStreaming: false } : m)
      } : c));
      setStatus(AppStatus.IDLE);
    } catch (err: any) {
      setStatus(AppStatus.IDLE);
      if (err.message !== "הופסקה") setError(err.message);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#0e1117] overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onLogin={handleLogin} />
      <FileViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />

      {/* Sidebar Backdrop (Mobile) */}
      {isSidebarOpen && window.innerWidth < 1024 && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:relative inset-y-0 right-0 z-50 w-72 md:w-80 bg-slate-50 dark:bg-[#161b22] border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 flex-shrink-0 h-16">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-blue-600" size={20}/>
            <h2 className="font-bold text-sm tracking-tight">האקדמיה של Gemini</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg lg:hidden transition-colors"><ChevronRight size={18} /></button>
        </div>
        
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <button onClick={createCategory} className="w-full flex items-center justify-center gap-2 p-3 bg-white dark:bg-[#1c2128] border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-2xl hover:shadow-md transition-all text-xs font-black active:scale-[0.98]">
            <FolderPlus size={16} /><span>צור תיקייה חדשה</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          <div className="space-y-1">
            {categories.map(cat => {
              const isExpanded = expandedCategories.has(cat.id);
              const catConvs = userConversations.filter(c => c.categoryId === cat.id);
              return (
                <div key={cat.id} className="space-y-0.5 animate-in slide-in-from-right-4 duration-300">
                  <div onClick={() => selectCategory(cat.id)} className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${activeCategoryId === cat.id ? 'bg-blue-100/50 dark:bg-blue-900/20' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <button onClick={(e) => toggleCategoryExpansion(cat.id, e)} className={`p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 ${isExpanded ? '' : '-rotate-90'}`}><ChevronDown size={14} /></button>
                      <Folder size={16} className={activeCategoryId === cat.id ? 'text-blue-500' : 'text-slate-400'} />
                      <span className={`text-[12px] truncate font-bold ${activeCategoryId === cat.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>{cat.name}</span>
                    </div>
                    <button onClick={(e) => deleteCategory(cat.id, e)} className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"><Trash2 size={12} /></button>
                  </div>
                  {isExpanded && (
                    <div className="mr-6 border-r-2 border-slate-200 dark:border-slate-700 pr-3 mt-1 mb-3 space-y-1">
                      {catConvs.length === 0 && <p className="text-[10px] text-slate-400 py-2 pr-2 italic">אין שיחות שמורות</p>}
                      {catConvs.map(conv => (
                        <button key={conv.id} onClick={() => { setActiveCategoryId(cat.id); setActiveConvId(conv.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`w-full text-right p-2 rounded-lg text-[11px] truncate transition-all ${activeConvId === conv.id ? 'bg-white dark:bg-slate-700 font-black shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                          {conv.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#161b22]/50">
          {user ? (
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white dark:bg-[#1c2128] border border-slate-100 dark:border-slate-700 shadow-sm">
              <img src={user.picture} className="w-8 h-8 rounded-full border-2 border-blue-100 dark:border-blue-900" alt="profile" />
              <div className="flex-1 min-w-0 text-right"><p className="text-[11px] font-black truncate">{user.name}</p><p className="text-[9px] text-slate-400">חשבון מחובר</p></div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><LogOut size={14} /></button>
            </div>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="w-full p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[11px] font-black active:scale-[0.98] shadow-lg shadow-slate-900/10 dark:shadow-none">התחברות לחשבון</button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-slate-100 dark:border-slate-800/50 flex-shrink-0 bg-white/80 dark:bg-[#0e1117]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4 overflow-hidden">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all active:scale-90">
                <Menu size={22} />
              </button>
            )}
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
                <Globe size={14} className="text-blue-600 flex-shrink-0" />
                <span className="text-[12px] font-black text-blue-700 dark:text-blue-400 truncate max-w-[150px] md:max-w-xs">{activeCategory?.name || 'בחר תיקייה'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-90"
              title={darkMode ? "מצב יום" : "מצב לילה"}
            >
              {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
            </button>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 lg:px-0 custom-scrollbar pb-40">
          <div className="max-w-4xl mx-auto py-8 lg:py-16 min-h-full flex flex-col">
            {activeCategory && (
              <div className="mb-8 p-4 lg:p-8 bg-slate-50 dark:bg-slate-900/40 rounded-[32px] border border-slate-100 dark:border-slate-800/60 shadow-sm transition-all group">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><FileText size={24} /></div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">קבצי הלימוד שלך</h3>
                      <p className="text-[10px] text-slate-400 font-medium">קבצים אלו משמשים כמקור הידע היחיד של ה-AI</p>
                    </div>
                  </div>
                  <button onClick={() => setShowFileManager(!showFileManager)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-[12px] font-black active:scale-[0.98] shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700">
                    {showFileManager ? <X size={16} /> : <Plus size={16} />} 
                    <span>{showFileManager ? 'סגור' : 'הוסף חומרים'}</span>
                  </button>
                </div>

                {showFileManager ? (
                  <FileUploader attachments={activeCategory.attachments} onUpload={handleUpload} onRemove={handleRemoveFile} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeCategory.attachments.length > 0 ? activeCategory.attachments.map(f => (
                      <div key={f.name} className="flex items-center justify-between p-3.5 bg-white dark:bg-[#1c2128] border border-slate-100 dark:border-slate-700 rounded-2xl hover:shadow-md transition-all group/file">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText size={18} className="text-blue-500 flex-shrink-0" />
                          <span className="text-[11px] font-bold truncate text-slate-700 dark:text-slate-300">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setViewingFile(f)} 
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="צפייה"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => handleRemoveFile(f.name)} 
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="מחיקה"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full"><Folder size={32} /></div>
                        <p className="text-xs font-bold">התיקייה ריקה. העלו סיכומים או תרגילים כדי להתחיל.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!activeConversation ? (
              <div className="my-auto text-center space-y-8 animate-in fade-in duration-1000 px-4">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-blue-600 rounded-[40px] blur-3xl opacity-20 animate-pulse"></div>
                  <div className="relative inline-flex w-24 h-24 rounded-[40px] bg-gradient-to-br from-blue-500 to-blue-700 text-white items-center justify-center shadow-2xl mb-2 rotate-3 hover:rotate-0 transition-transform duration-500"><Bot size={48} /></div>
                </div>
                <div className="space-y-3 max-w-lg mx-auto">
                  <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-[1.2]">מוכן למבחן הבא?</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium">אני כאן כדי לעזור לך להבין את החומר בצורה עמוקה יותר, לפתור שאלות ולסכם נושאים מורכבים.</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
                  {SUGGESTED_QUESTIONS.map((q, i) => ( 
                    <button key={i} onClick={() => handleSend(undefined, q)} className="px-6 py-4 text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[24px] hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg text-[13px] font-black transition-all active:scale-[0.98] flex-1 min-w-[200px] shadow-sm">{q}</button> 
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                {messages.map(m => <ChatMessage key={m.id} message={m} />)}
                {status === AppStatus.PROCESSING && (
                  <div className="flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400"><RefreshCw size={20} className="animate-spin" /></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-1/4"></div>
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-3/4"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input Area - Floating Gemini Style */}
        <div className="fixed bottom-0 left-0 right-0 lg:left-0 lg:right-0 z-40 p-4 lg:p-8 bg-gradient-to-t from-white dark:from-[#0e1117] via-white/95 dark:via-[#0e1117]/95 to-transparent">
          <div className="max-w-3xl mx-auto relative">
            {showRespectfulWarning && (
              <div className="absolute bottom-full left-0 right-0 mb-6 animate-in slide-in-from-bottom-4 fade-in">
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-center gap-4 shadow-xl">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0"><AlertCircle size={24} /></div>
                  <p className="text-xs font-black text-amber-900 dark:text-amber-200">חסרים חומרי לימוד. העלה קבצים לתיקייה כדי שאוכל לענות על שאלותיך.</p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-slate-50 dark:bg-[#1c2128] border border-slate-200 dark:border-slate-800 rounded-[32px] lg:rounded-[40px] p-2 focus-within:ring-4 focus-within:ring-blue-500/10 shadow-2xl transition-all duration-300">
              <textarea 
                ref={textareaRef} 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); handleSend(); }}} 
                placeholder="הקלידו שאלה או נושא שברצונכם ללמוד..." 
                className="flex-1 bg-transparent border-none py-4 px-6 resize-none outline-none text-right text-[15px] lg:text-[17px] leading-relaxed font-bold min-h-[56px] max-h-[200px] placeholder:text-slate-400 dark:placeholder:text-slate-600"
                rows={1}
              />
              <div className="flex items-center gap-2 pr-2 pb-2">
                <button 
                  type="button" 
                  onClick={handleMicToggle}
                  className={`p-3 rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse scale-110' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                  title="חיפוש קולי"
                >
                  <Mic size={24} />
                </button>
                {status === AppStatus.STREAMING ? (
                   <button type="button" onClick={handleStop} className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-600 text-white shadow-xl shadow-blue-600/20 active:scale-90 transition-all"><Square size={18} fill="white"/></button>
                ) : (
                  <button 
                    type="submit" 
                    disabled={!input.trim() || status !== AppStatus.IDLE}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${input.trim() ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 active:scale-90' : 'bg-transparent text-slate-300'}`}
                  >
                    {status === AppStatus.PROCESSING ? <RefreshCw size={22} className="animate-spin" /> : <Send size={24} />}
                  </button>
                )}
              </div>
            </form>
            <div className="flex items-center justify-center gap-4 mt-4 opacity-50">
               <p className="text-[10px] text-center text-slate-400 font-black flex items-center justify-center gap-1.5 uppercase tracking-widest">
                <Sparkles size={12} className="text-blue-500" /> המידע מבוסס בלעדית על המאגר שלך
              </p>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .animate-bounce-slow { animation: bounce-slow 4s ease-in-out infinite; }
        ::placeholder { text-align: right; }
        textarea { unicode-bidi: plaintext; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        @media (max-width: 1023px) {
          .custom-scrollbar::-webkit-scrollbar { width: 0px; }
        }
        /* Mobile adjustments for KaTeX blocks */
        .math-block { max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
      `}</style>
    </div>
  );
};

export default App;
