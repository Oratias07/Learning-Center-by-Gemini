
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Attachment, Message, AppStatus, Category, Conversation, UserProfile } from './types';
import { askGemini, validateHebrew, generateTitle } from './services/geminiService';
import FileUploader from './components/FileUploader';
import ChatMessage from './components/ChatMessage';
import { 
  Send, GraduationCap, Bot, Menu, Sparkles, LogOut, Moon, Sun, Trash2, 
  ChevronRight, Mic, Plus, Folder, ChevronDown, FolderPlus, FileText, X, Share2, Eye, Square,
  RefreshCw, LogIn, Link, Eraser, Info, User as UserIcon, Globe, Lock, Search, AlertCircle, ChevronLeft
} from 'lucide-react';

// Pre-loaded files for "מבנים אלגבריים 2"
const DEFAULT_ALGEBRA_FILES: Attachment[] = [
  { name: 'AS2_Targil_1_Groups.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 102400, extractedText: 'תרגיל 1: חבורות ותתי חבורות, משפט לגרנז' },
  { name: 'AS2_Targil_2_Normal_Subgroups.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 124000, extractedText: 'תרגיל 2: תתי חבורות נורמליות וחבורות מנה' },
  { name: 'AS2_Targil_3_Homomorphisms.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 98000, extractedText: 'תרגיל 3: הומומורפיזמים ומשפטי האיזומורפיזם' },
  { name: 'AS2_Targil_4_Rings.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 115000, extractedText: 'תרגיל 4: מבוא לחוגים, אידיאלים ותתי חוגים' },
  { name: 'AS2_Summary_Algebraic_Structures.pdf', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', size: 256000, extractedText: 'סיכום קורס מבנים אלגבריים 2 - כל המשפטים וההגדרות' }
];

const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void; onLogin: (provider: string) => void }> = ({ isOpen, onClose, onLogin }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="bg-white dark:bg-[#1c2128] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              <GraduationCap size={32} />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">כניסה למערכת</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">התחבר כדי לשמור ולסנכרן את היסטוריית הלמידה האישית שלך. חומרי הלימוד נשארים גלובליים לכולם.</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => onLogin('Google')} className="w-full flex items-center justify-center gap-3 py-3.5 bg-white dark:bg-[#2d333b] border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm">
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" /> המשך עם Google
            </button>
          </div>
          <div className="pt-2">
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors">המשך כאורח</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SUGGESTED_QUESTIONS = [
  "מהו משפט האיזומורפיזם השלישי?",
  "הסבר את המושג חוג פשוט.",
  "מה ההבדל בין שדה למרחב וקטורי?",
  "איך מוכיחים שקבוצה היא תת-חוג?",
];

const App: React.FC = () => {
  const GLOBAL_KNOWLEDGE_KEY = 'study_shared_global_db_v2';
  const PRIVATE_HISTORY_KEY = 'study_private_user_chats_v2';
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

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(categories[0]?.id || null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(THEME_KEY) === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([categories[0]?.id]));
  const [showRespectfulWarning, setShowRespectfulWarning] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUserId = user ? user.id : 'guest';

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
      const newHeight = Math.min(textareaRef.current.scrollHeight, 240);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const userConversations = useMemo(() => allConversations.filter(c => c.userId === currentUserId), [allConversations, currentUserId]);
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const lowerSearch = searchTerm.toLowerCase();
    return categories.filter(cat => {
      const nameMatch = cat.name.toLowerCase().includes(lowerSearch);
      const fileMatch = cat.attachments.some(att => att.name.toLowerCase().includes(lowerSearch) || (att.extractedText && att.extractedText.toLowerCase().includes(lowerSearch)));
      const convMatch = userConversations.some(c => c.categoryId === cat.id && c.title.toLowerCase().includes(lowerSearch));
      return nameMatch || fileMatch || convMatch;
    });
  }, [categories, searchTerm, userConversations]);

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
    if (!expandedCategories.has(id)) toggleCategoryExpansion(id);
  };

  const handleLogin = (provider: string) => {
    const newUser = { id: `user_${Date.now()}`, name: 'סטודנט מצטיין', email: `student@${provider.toLowerCase()}.com`, picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}` };
    setAllConversations(prev => prev.map(c => c.userId === 'guest' ? { ...c, userId: newUser.id } : c));
    setUser(newUser);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => { if (confirm('האם להתנתק מהחשבון האישי? חומרי הלימוד הגלובליים יישארו זמינים לכולם.')) { setUser(null); setActiveConvId(null); } };

  const createCategory = () => {
    const name = prompt('שם הקטגוריה החדשה (מאגר גלובלי):');
    if (!name) return;
    const newCat: Category = { id: Date.now().toString(), name, attachments: [], updatedAt: Date.now() };
    setCategories(prev => [newCat, ...prev]);
    setActiveCategoryId(newCat.id);
    setActiveConvId(null);
    setExpandedCategories(prev => new Set([...prev, newCat.id]));
  };

  const deleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('אזהרה: מחיקת קטגוריה תמחק את כל הקבצים שלה עבור כל המשתמשים במערכת. האם להמשיך?')) return;
    setCategories(prev => prev.filter(c => c.id !== id));
    if (activeCategoryId === id) { setActiveCategoryId(null); setActiveConvId(null); }
  };

  const deleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('האם למחוק שיחה זו מהיסטוריית הלמידה האישית שלך?')) return;
    setAllConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConvId === convId) setActiveConvId(null);
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
      setTimeout(() => setShowRespectfulWarning(false), 5000);
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

    // IMMEDIATELY display user message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: currentInput, timestamp: Date.now() };
    const streamMsgId = (Date.now() + 1).toString();

    setAllConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));

    // Prepare model slot
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
      
      // AUTO-VALIDATE Hebrew quality on complete
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
    <div className="flex h-screen bg-white dark:bg-[#0e1117] overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onLogin={handleLogin} />
      <aside className={`${isSidebarOpen ? 'w-72 md:w-80' : 'w-0'} bg-slate-50 dark:bg-[#161b22] border-l border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-30 overflow-hidden`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2"><GraduationCap className="text-blue-600" /><h2 className="font-bold text-[15px] tracking-tight">מרכז הלמידה</h2></div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><ChevronRight size={18} /></button>
        </div>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="relative group">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="חפש בתיקיות, שיחות או קבצים..." className="w-full bg-white dark:bg-[#1c2128] border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-right" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><Globe size={12} className="text-blue-500" /> מאגר ידע משותף</div>
            <button onClick={createCategory} className="w-full flex items-center gap-3 p-3 bg-white dark:bg-[#1c2128] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:border-blue-500 transition-all shadow-sm group">
              <FolderPlus size={18} className="text-blue-500" /><span className="text-sm font-bold">תיקייה גלובלית חדשה</span>
            </button>
            <div className="space-y-1">
              {filteredCategories.map(cat => {
                const isExpanded = expandedCategories.has(cat.id) || searchTerm.trim() !== '';
                const catConvs = userConversations.filter(c => c.categoryId === cat.id);
                return (
                  <div key={cat.id} className="space-y-0.5">
                    <div onClick={() => selectCategory(cat.id)} className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${activeCategoryId === cat.id ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <button onClick={(e) => toggleCategoryExpansion(cat.id, e)} className={`p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}><ChevronDown size={14} /></button>
                        <Folder size={16} className={activeCategoryId === cat.id ? 'text-blue-500' : 'text-slate-400'} />
                        <span className={`text-[13px] truncate font-semibold ${activeCategoryId === cat.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); selectCategory(cat.id); }} className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg"><Plus size={14} /></button>
                        <button onClick={(e) => deleteCategory(cat.id, e)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mr-5 space-y-0.5 border-r border-slate-200 dark:border-slate-700 pr-2 mt-1 mb-2 animate-in fade-in slide-in-from-right-2">
                        {catConvs.length === 0 && !searchTerm && <p className="text-[11px] text-slate-400 py-2 pr-4 italic">אין שיחות אישיות</p>}
                        {catConvs.map(conv => (
                          <button key={conv.id} onClick={() => { setActiveCategoryId(cat.id); setActiveConvId(conv.id); }} className={`w-full group flex items-center justify-between p-2 rounded-lg text-right transition-all ${activeConvId === conv.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            <span className="text-xs truncate flex-1">{conv.title}</span>
                            <Trash2 size={12} className="opacity-0 group-hover:opacity-100 mr-2 hover:text-red-500 transition-opacity" onClick={(e) => deleteConversation(conv.id, e)} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-[#1a2027]">
          <div className="flex items-center gap-2 mb-3 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><Lock size={10} /> {user ? 'היסטוריה אישית' : 'מצב אורח'}</div>
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#1c2128] border border-slate-100 dark:border-slate-700 shadow-sm">
              <img src={user.picture} className="w-8 h-8 rounded-full ring-2 ring-blue-500/20" alt="profile" />
              <div className="flex-1 min-w-0 text-right"><p className="text-xs font-bold truncate">{user.name}</p><p className="text-[10px] text-slate-400 truncate">{user.email}</p></div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
            </div>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="w-full flex items-center justify-center gap-2 p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-xs font-bold shadow-md"><LogIn size={16} /> התחבר לשמירת היסטוריה</button>
          )}
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0e1117]">
        <nav className="h-14 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-4 overflow-hidden">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><Menu size={20} /></button>}
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg"><Globe size={14} className="text-blue-500" /><h1 className="text-[13px] font-black text-blue-700 dark:text-blue-400 truncate">{activeCategory?.name || 'בחר תיקייה'}</h1></div>
              {activeConversation && <><ChevronLeft size={14} className="text-slate-300" /><span className="text-[13px] text-slate-500 truncate max-w-[200px] font-medium">{activeConversation.title}</span></>}
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
        </nav>
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 custom-scrollbar">
          <div className="max-w-3xl mx-auto py-12 min-h-full flex flex-col">
            {activeCategory && (
              <div className="mb-10 p-6 bg-slate-50 dark:bg-slate-900/40 rounded-[32px] border border-slate-200 dark:border-slate-800/60 shadow-sm animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><FileText size={24} /></div>
                    <div><h3 className="text-sm font-black text-slate-900 dark:text-white">חומרי לימוד משותפים</h3><p className="text-[11px] text-slate-500 font-medium italic">הקבצים כאן זמינים לכל משתמשי המערכת</p></div>
                  </div>
                  <button onClick={() => setShowFileManager(!showFileManager)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 shadow-lg transition-all active:scale-95">
                    {showFileManager ? <X size={14} /> : <Plus size={14} />} {showFileManager ? 'סגור' : 'העלה קובץ'}
                  </button>
                </div>
                {showFileManager ? <FileUploader attachments={activeCategory.attachments} onUpload={handleUpload} onRemove={handleRemoveFile} /> : (
                  <div className="flex flex-wrap gap-2 justify-start flex-row-reverse">
                    {activeCategory.attachments.length > 0 ? activeCategory.attachments.map(f => (
                      <div key={f.name} className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs"><FileText size={14} className="text-blue-500" /><span className="text-[11px] font-bold truncate max-w-[140px]">{f.name}</span></div>
                    )) : <div className="w-full text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl bg-white/30"><p className="text-[11px] text-slate-400 italic font-medium">התיקייה ריקה.</p></div>}
                  </div>
                )}
              </div>
            )}
            {!activeConversation ? (
              <div className="my-auto text-center space-y-8 animate-in fade-in duration-700">
                <div className="inline-flex w-24 h-24 rounded-[36px] bg-gradient-to-br from-blue-500 to-blue-700 text-white items-center justify-center shadow-2xl mb-2 animate-bounce-slow"><Bot size={48} /></div>
                <div className="space-y-3"><h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{activeCategory?.name || 'מוכנים ללמוד?'}</h2><p className="text-slate-500 dark:text-slate-400 text-sm font-medium">העוזר החכם יענה על שאלותיכם בהתבסס על החומר בלבד.</p></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                  {SUGGESTED_QUESTIONS.map((q, i) => ( <button key={i} onClick={() => handleSend(undefined, q)} className="p-5 text-right bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[24px] hover:border-blue-400 shadow-sm text-sm font-bold text-slate-700 dark:text-slate-200 transition-all active:scale-[0.98]">{q}</button> ))}
                </div>
              </div>
            ) : <div className="space-y-4 pb-12">{messages.map(m => <ChatMessage key={m.id} message={m} />)}</div>}
          </div>
        </div>
        {showRespectfulWarning && (
          <div className="mx-6 mb-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="max-w-3xl mx-auto flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-amber-800 dark:text-amber-300 shadow-lg">
              <AlertCircle size={20} className="flex-shrink-0" /><p className="text-xs font-bold leading-relaxed">שלום! כדי שאוכל לענות על שאלות בצורה מדויקת, אנא העלו תחילה חומרי לימוד (PDF או טקסט) לתיקייה שבחרתם. תודה!</p>
              <button onClick={() => setShowRespectfulWarning(false)} className="mr-auto p-1 hover:bg-amber-100 rounded-full transition-colors"><X size={16}/></button>
            </div>
          </div>
        )}
        <div className="px-6 pb-8 pt-2 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSend} className="relative flex items-end gap-3">
              <div className="flex-1 relative bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-[32px] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all overflow-hidden shadow-sm">
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} maxLength={2000} placeholder="שאל שאלה על חומרי הלימוד..." className="w-full bg-transparent border-none py-5 pr-14 pl-28 resize-none outline-none text-right text-[15px] block overflow-hidden leading-relaxed font-medium" style={{ height: 'auto', minHeight: '60px' }} />
                {input && <button type="button" onClick={() => setInput('')} className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 transition-colors"><X size={14} /></button>}
                <div className="absolute left-4 bottom-3 flex items-center gap-1.5"><div className={`text-[9px] font-mono mr-1 tabular-nums ${input.length > 1800 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>{input.length}/2000</div><button type="button" className="p-2.5 text-slate-400 hover:text-blue-500 transition-colors"><Mic size={20} /></button>{status === AppStatus.PROCESSING && <RefreshCw size={20} className="animate-spin text-blue-500 mx-1" />}</div>
              </div>
              <button type={status === AppStatus.STREAMING ? "button" : "submit"} onClick={status === AppStatus.STREAMING ? handleStop : undefined} disabled={(status === AppStatus.IDLE && (!input.trim() || !activeCategoryId)) || status === AppStatus.PROCESSING} className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all ${(input.trim() && status === AppStatus.IDLE) || status === AppStatus.STREAMING ? 'bg-blue-600 text-white shadow-xl scale-100 hover:bg-blue-700 active:scale-95' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 scale-95 opacity-50'}`}><Send size={24} /></button>
            </form>
          </div>
        </div>
      </main>
      <style>{`
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        .animate-bounce-slow { animation: bounce-slow 4s ease-in-out infinite; }
        ::placeholder { text-align: right; }
        textarea { unicode-bidi: plaintext; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
};

export default App;
