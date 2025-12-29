
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Attachment, Message, AppStatus, Category, Conversation, UserProfile } from './types';
import { askGemini, validateHebrew, generateTitle } from './services/geminiService';
import FileUploader from './components/FileUploader';
import ChatMessage from './components/ChatMessage';
import { 
  Send, GraduationCap, Bot, Menu, Sparkles, LogOut, Moon, Sun, Trash2, 
  ChevronRight, Mic, Plus, Folder, ChevronDown, FolderPlus, FileText, X, Share2, Eye, Square,
  RefreshCw, LogIn, Link, Eraser, Info
} from 'lucide-react';

const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void; onLogin: (provider: string) => void }> = ({ isOpen, onClose, onLogin }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="bg-white dark:bg-[#1c2128] w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
        <div className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              < GraduationCap size={32} />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">ברוכים הבאים</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">התחבר כדי לשמור את היסטוריית הלמידה שלך</p>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => onLogin('Google')}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-white dark:bg-[#2d333b] border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#343b44] transition-all font-bold text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              המשך עם Google
            </button>
            <button 
              onClick={() => onLogin('Apple')}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:bg-black dark:hover:bg-slate-100 transition-all font-bold shadow-sm"
            >
              <svg viewBox="0 0 384 512" className="w-5 h-5 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              המשך עם Apple
            </button>
          </div>

          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium">
            אולי מאוחר יותר
          </button>
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
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('study_categories');
    if (saved) return JSON.parse(saved);
    return [{
      id: 'algebraic-structures-2',
      name: 'מבנים אלגבריים 2',
      conversations: [],
      attachments: [],
      updatedAt: Date.now()
    }];
  });

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(categories[0]?.id || null);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('study_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([categories[0]?.id]));

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAutoScrolling = useRef(true);

  const activeCategory = useMemo(() => 
    categories.find(c => c.id === activeCategoryId), 
    [categories, activeCategoryId]
  );

  const activeConversation = useMemo(() => 
    activeCategory?.conversations.find(c => c.id === activeConvId),
    [activeCategory, activeConvId]
  );

  const messages = activeConversation?.messages || [];

  // Consistent persistence
  useEffect(() => {
    localStorage.setItem('study_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    if (user) localStorage.setItem('study_user', JSON.stringify(user));
    else localStorage.removeItem('study_user');
  }, [user]);

  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
    }
  }, [input]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (isAutoScrolling.current) scrollToBottom();
  }, [messages, status]);

  const toggleCategory = (id: string) => {
    const next = new Set(expandedCategories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCategories(next);
    setActiveCategoryId(id);
    setActiveConvId(null);
    setShowFileManager(false);
  };

  const createCategory = () => {
    const name = prompt('שם הקטגוריה החדשה:');
    if (!name) return;
    const newCat: Category = {
      id: Date.now().toString(),
      name,
      conversations: [],
      attachments: [],
      updatedAt: Date.now()
    };
    setCategories([newCat, ...categories]);
    setActiveCategoryId(newCat.id);
    setActiveConvId(null);
    setExpandedCategories(new Set([...expandedCategories, newCat.id]));
  };

  const deleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('האם אתה בטוח שברצונך למחוק קטגוריה זו ואת כל התוכן שבה?')) return;
    setCategories(prev => prev.filter(c => c.id !== id));
    if (activeCategoryId === id) {
      setActiveCategoryId(null);
      setActiveConvId(null);
    }
  };

  const deleteConversation = (catId: string, convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('האם אתה בטוח שברצונך למחוק שיחה זו?')) return;
    setCategories(prev => prev.map(cat => {
      if (cat.id !== catId) return cat;
      return {
        ...cat,
        conversations: cat.conversations.filter(c => c.id !== convId)
      };
    }));
    if (activeConvId === convId) {
      setActiveConvId(null);
    }
  };

  const handleLogin = (provider: string) => {
    setUser({
      id: Date.now().toString(),
      name: 'סטודנט מצטיין',
      email: `student@${provider.toLowerCase()}.com`,
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
    });
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    if (confirm('האם להתנתק?')) setUser(null);
  };

  const handleUpload = (newFiles: Attachment[]) => {
    if (!activeCategoryId) return;
    setCategories(prev => prev.map(cat => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        attachments: [...cat.attachments, ...newFiles]
      };
    }));
    if (error === "אנא העלה קבצים לקטגוריה זו לפני תחילת השיחה.") {
      setError(null);
    }
  };

  const handleRemoveFile = (fileName: string) => {
    if (!activeCategoryId) return;
    setCategories(prev => prev.map(cat => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        attachments: cat.attachments.filter(a => a.name !== fileName)
      };
    }));
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setStatus(AppStatus.IDLE);
  };

  const handleShare = () => {
    if (!activeConversation) return;
    const shareUrl = `${window.location.origin}/share/${activeConversation.id}`;
    const shareText = `בדוק את השיחה שלי בנושא ${activeCategory?.name || 'לימודים'}:\n\n${activeConversation.title}\n\n${shareUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: activeConversation.title,
        text: shareText,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareText);
      alert('קישור לשיתוף הועתק ללוח!');
    }
  };

  const handleSend = async (e?: React.FormEvent, customInput?: string) => {
    e?.preventDefault();
    const messageToSend = customInput || input;
    if (!messageToSend.trim() || status !== AppStatus.IDLE || !activeCategoryId) return;

    if (!activeCategory || (activeCategory.attachments.length === 0 && !activeConversation)) {
      setError("אנא העלה קבצים לקטגוריה זו לפני תחילת השיחה.");
      return;
    }

    setStatus(AppStatus.PROCESSING);
    let finalInput = messageToSend;
    setInput('');
    
    try {
      const refinedInput = await validateHebrew(finalInput);
      finalInput = refinedInput;
    } catch (e) {
      console.warn("Failed to refine input.");
    }

    setStatus(AppStatus.STREAMING);
    isAutoScrolling.current = true;
    
    let convId = activeConvId;
    if (!convId) {
      convId = Date.now().toString();
      const title = await generateTitle(finalInput);
      const newConv: Conversation = {
        id: convId,
        title,
        messages: [],
        updatedAt: Date.now()
      };
      
      setCategories(prev => prev.map(cat => {
        if (cat.id !== activeCategoryId) return cat;
        return {
          ...cat,
          conversations: [newConv, ...cat.conversations],
          updatedAt: Date.now()
        };
      }));
      setActiveConvId(convId);
    } else {
      generateTitle(finalInput).then(newTitle => {
        setCategories(prev => prev.map(cat => {
          if (cat.id !== activeCategoryId) return cat;
          return {
            ...cat,
            conversations: cat.conversations.map(c => c.id === convId ? { ...c, title: newTitle } : c)
          };
        }));
      });
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: finalInput,
      timestamp: Date.now()
    };

    setCategories(prev => prev.map(cat => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        conversations: cat.conversations.map(c => 
          c.id === convId ? { ...c, messages: [...c.messages, userMessage], updatedAt: Date.now() } : c
        )
      };
    }));

    abortControllerRef.current = new AbortController();
    const streamMsgId = (Date.now() + 1).toString();
    
    setCategories(prev => prev.map(cat => {
      if (cat.id !== activeCategoryId) return cat;
      return {
        ...cat,
        conversations: cat.conversations.map(c => 
          c.id === convId ? { 
            ...c, 
            messages: [...c.messages, { id: streamMsgId, role: 'model', text: '', timestamp: Date.now(), isStreaming: true }] 
          } : c
        )
      };
    }));

    try {
      const finalResponse = await askGemini(
        finalInput, 
        messages, 
        activeCategory.attachments, 
        (text) => {
          setCategories(prev => prev.map(cat => {
            if (cat.id !== activeCategoryId) return cat;
            return {
              ...cat,
              conversations: cat.conversations.map(c => 
                c.id === convId ? {
                  ...c,
                  messages: c.messages.map(m => m.id === streamMsgId ? { ...m, text } : m)
                } : c
              )
            };
          }));
        },
        abortControllerRef.current.signal
      );
      
      setCategories(prev => prev.map(cat => {
        if (cat.id !== activeCategoryId) return cat;
        return {
          ...cat,
          conversations: cat.conversations.map(c => 
            c.id === convId ? {
              ...c,
              messages: c.messages.map(m => m.id === streamMsgId ? { ...m, text: finalResponse, isStreaming: false } : m)
            } : c
          )
        };
      }));
      setStatus(AppStatus.IDLE);
    } catch (err: any) {
      setStatus(AppStatus.IDLE);
      if (err.message !== "הופסקה") setError(err.message);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#0e1117] overflow-hidden text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLogin={handleLogin} 
      />

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-72 md:w-80' : 'w-0'} bg-slate-50 dark:bg-[#161b22] border-l border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-30 overflow-hidden`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="text-blue-600" />
            <h2 className="font-bold text-[15px] tracking-tight">מרכז הלמידה</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
            <ChevronRight size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <button 
            onClick={createCategory}
            className="w-full flex items-center gap-3 p-3 bg-white dark:bg-[#1c2128] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:border-blue-500 transition-all shadow-sm active:scale-[0.98]"
          >
            <FolderPlus size={18} className="text-blue-500" />
            <span className="text-sm font-bold">קטגוריה חדשה</span>
          </button>

          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="space-y-1">
                <div 
                  onClick={() => toggleCategory(cat.id)}
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${activeCategoryId === cat.id ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <ChevronDown size={14} className={`transition-transform duration-200 ${expandedCategories.has(cat.id) ? '' : '-rotate-90'}`} />
                    <Folder size={16} className={activeCategoryId === cat.id ? 'text-blue-500' : 'text-slate-400'} />
                    <span className={`text-[13px] truncate font-semibold ${activeCategoryId === cat.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setActiveCategoryId(cat.id); setActiveConvId(null); }} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 rounded">
                      <Plus size={14} />
                    </button>
                    <button onClick={(e) => deleteCategory(cat.id, e)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expandedCategories.has(cat.id) && (
                  <div className="mr-4 space-y-1 border-r border-slate-200 dark:border-slate-700 pr-2 mt-1 animate-in fade-in slide-in-from-right-2">
                    {cat.conversations.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2 pr-4 italic">אין שיחות עדיין</p>
                    ) : (
                      cat.conversations.map(conv => (
                        <button 
                          key={conv.id}
                          onClick={() => { setActiveCategoryId(cat.id); setActiveConvId(conv.id); }}
                          className={`w-full group flex items-center justify-between p-2 rounded-lg text-right transition-all ${activeConvId === conv.id ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                        >
                          <span className="text-xs truncate flex-1">{conv.title}</span>
                          <Trash2 
                            size={12} 
                            className="opacity-0 group-hover:opacity-100 mr-2 hover:text-red-500" 
                            onClick={(e) => { e.stopPropagation(); deleteConversation(cat.id, conv.id, e); }}
                          />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {user && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-[#1c2128] border border-slate-100 dark:border-slate-700 shadow-sm">
              <img src={user.picture} className="w-8 h-8 rounded-full" alt="profile" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-bold truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
              <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-[#0e1117]">
        <nav className="h-14 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-4 overflow-hidden">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2 overflow-hidden">
              <h1 className="text-[14px] font-bold text-slate-800 dark:text-slate-200 truncate">
                {activeCategory?.name || 'Gemini Study Hub'}
              </h1>
              {activeConversation && (
                <>
                  <ChevronRight size={14} className="text-slate-300" />
                  <span className="text-[13px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {activeConversation.title}
                  </span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {activeConversation && (
              <button 
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all text-xs font-bold"
                title="שתף שיחה"
              >
                <Share2 size={16} />
                <span>שתף שיחה</span>
              </button>
            )}
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="החלף מצב תצוגה"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <div className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <img src={user.picture} alt="Avatar" className="w-full h-full" />
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-xs font-bold hover:scale-105 transition-all shadow-md"
              >
                <LogIn size={14} /> התחברות
              </button>
            )}
          </div>
        </nav>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 relative">
          <div className="max-w-3xl mx-auto py-12 min-h-full flex flex-col">
            
            {activeCategory && (
               <div className="mb-10 p-5 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm animate-in fade-in duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <div className="text-right">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">חומרי לימוד</h3>
                        <p className="text-[11px] text-slate-500">{activeCategory.attachments.length} קבצים זמינים</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowFileManager(!showFileManager)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95"
                    >
                      {showFileManager ? <X size={14} /> : <Plus size={14} />}
                      {showFileManager ? 'סגור' : 'נהל קבצים'}
                    </button>
                  </div>

                  {showFileManager ? (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                       <FileUploader 
                        attachments={activeCategory.attachments} 
                        onUpload={handleUpload} 
                        onRemove={handleRemoveFile} 
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 justify-start flex-row-reverse">
                      {activeCategory.attachments.length > 0 ? (
                        activeCategory.attachments.map(file => (
                          <div key={file.name} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xs overflow-hidden">
                            <FileText size={12} className="text-blue-500 flex-shrink-0" />
                            <span className="text-[11px] font-medium truncate max-w-[120px]">{file.name}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">לא הועלו קבצים. לחץ על "נהל קבצים" כדי להוסיף חומרי לימוד.</p>
                      )}
                    </div>
                  )}
               </div>
            )}

            {!activeConversation ? (
              <div className="my-auto space-y-10 animate-in fade-in duration-500">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-[32px] bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-2xl shadow-blue-500/30 mb-4 animate-bounce-slow">
                    <Bot size={40} />
                  </div>
                  <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    {activeCategory?.name || 'במה נתעמק היום?'}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-base max-w-sm mx-auto">
                    שאל כל שאלה בנוגע לחומרי הלימוד שלך. Gemini יענה על סמך הקבצים שהעלית בלבד.
                  </p>
                </div>

                {activeCategory?.name.includes("מבנים אלגבריים") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(undefined, q)}
                        className="p-4 text-right bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-blue-400 dark:hover:border-blue-600 transition-all text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm hover:shadow-md"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
              </div>
            )}
          </div>
        </div>

        {/* Suggested Questions (Mobile/Context) */}
        {activeConversation && activeCategory?.name.includes("מבנים אלגבריים") && (
          <div className="max-w-3xl mx-auto w-full px-4 mb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 flex-row-reverse no-scrollbar">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="whitespace-nowrap px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="px-4 pb-8 pt-2 flex-shrink-0">
          <div className="max-w-3xl mx-auto relative">
            {error && (
              <div className="absolute -top-16 left-0 right-0 z-10 animate-in slide-in-from-bottom-2">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-xs font-bold border border-red-100 dark:border-red-800/50 flex justify-between items-center shadow-lg">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleSend} className="relative flex items-end gap-3">
              <div className="flex-1 relative bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-[28px] shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white dark:focus-within:bg-[#1c2128] transition-all overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                  rows={1}
                  maxLength={2000}
                  placeholder={activeCategoryId ? "שלח הודעה ל-Gemini..." : "בחר קטגוריה כדי להתחיל"}
                  disabled={!activeCategoryId || status === AppStatus.STREAMING || status === AppStatus.PROCESSING}
                  className="w-full bg-transparent border-none py-4 pr-6 pl-24 resize-none outline-none leading-relaxed text-right min-h-[56px] max-h-60 text-[15px]"
                  style={{ height: 'auto' }}
                />
                
                {input.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setInput('')}
                    className="absolute right-4 top-4 p-1 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}

                <div className="absolute left-3 bottom-2.5 flex items-center gap-1">
                  <div className="text-[9px] font-mono text-slate-400 mr-1 tabular-nums">
                    {input.length}/2000
                  </div>
                   <button type="button" className="p-2 text-slate-400 hover:text-blue-500 rounded-full transition-all">
                    <Mic size={18} />
                  </button>
                  {status === AppStatus.PROCESSING && (
                    <div className="p-2">
                       <RefreshCw size={18} className="animate-spin text-blue-500" />
                    </div>
                  )}
                </div>
              </div>
              
              {status === AppStatus.STREAMING ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-200 transition-all active:scale-90 shadow-md"
                  title="עצור יצירה"
                >
                  <Square size={18} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || status !== AppStatus.IDLE || !activeCategoryId}
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    input.trim() && status === AppStatus.IDLE && activeCategoryId
                      ? 'bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-90'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                  }`}
                >
                  <Send size={20} />
                </button>
              )}
            </form>
            <div className="flex justify-center mt-3">
               <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                 <Info size={12} />
                 <span>Gemini עשוי לטעות. בדוק תמיד את המקורות שלך.</span>
               </div>
            </div>
          </div>
        </div>
      </main>
      
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        ::placeholder {
          text-align: right;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;
