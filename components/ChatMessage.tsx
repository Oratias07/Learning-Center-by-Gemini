
import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { User, Bot, Check, Copy, Terminal } from 'lucide-react';
import katex from 'katex';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (contentRef.current) {
      let text = message.text;
      
      // 1. Code blocks
      const codeBlocks: string[] = [];
      text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const id = codeBlocks.length;
        codeBlocks.push(code.trim());
        return `__CODE_BLOCK_${id}_${lang || 'code'}__`;
      });

      // 2. Bold LTR Math rendering
      text = text.replace(/\$([\s\S]+?)\$/g, (m, f) => {
        try {
          const rendered = katex.renderToString(f.trim(), { 
            displayMode: false, 
            throwOnError: false 
          });
          return `<span class="math-inline font-bold" style="direction: ltr; unicode-bidi: isolate; display: inline-block;">${rendered}</span>`;
        } catch (e) {
          return m;
        }
      });

      // 3. Simple Markdown support
      let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 dark:text-white">$1</strong>')
        .replace(/\n/g, '<br/>');

      // 4. Inject styled code blocks back
      codeBlocks.forEach((code, idx) => {
        const placeholder = new RegExp(`__CODE_BLOCK_${idx}_(\\w+)__`, 'g');
        html = html.replace(placeholder, (match, lang) => {
          return `
            <div class="my-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-sm text-left dir-ltr">
              <div class="flex items-center justify-between px-5 py-2.5 bg-slate-900 text-slate-400 text-[10px] font-mono uppercase tracking-widest border-b border-slate-800">
                <span class="flex items-center gap-2"><Terminal size={12}/> ${lang}</span>
              </div>
              <pre class="p-5 overflow-x-auto text-[14px] text-blue-100 font-mono leading-relaxed"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
            </div>
          `;
        });
      });

      // 5. References as plain text in parentheses: (filename, עמ' X)
      html = html.replace(/\[([^\]]+?\.(pdf|txt|jpg|jpeg|png|md))(?:,\s*([^\]]+))?\]/gi, (match, filename, ext, details) => {
        const detailStr = details ? `, ${details}` : '';
        return `<span class="text-blue-600/80 dark:text-blue-400/80 font-medium italic">(${filename}${detailStr})</span>`;
      });

      contentRef.current.innerHTML = html;
    }
  }, [message.text]);

  return (
    <div className={`group flex w-full mb-10 animate-in fade-in slide-in-from-bottom-3 duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex w-full max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-5`}>
        <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${
          isUser ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-blue-600 text-white'
        }`}>
          {isUser ? <User size={22} strokeWidth={2} /> : <Bot size={22} strokeWidth={2} />}
        </div>
        
        <div className={`flex flex-col flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-3 mb-2 px-1">
            <span className="text-[13px] font-bold tracking-tight text-slate-500 dark:text-slate-400 uppercase">
              {isUser ? 'אתה' : 'Gemini Assistant'}
            </span>
          </div>
          
          <div className={`relative w-full ${isUser ? 'text-right' : 'text-right'}`}>
            <div 
              ref={contentRef}
              className={`leading-[1.7] text-[16px] whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200 selection:bg-blue-100 dark:selection:bg-blue-900/50 ${isUser ? 'font-medium' : ''}`}
            />
            
            {!isUser && !message.isStreaming && (
              <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-all text-xs font-medium"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  <span>{copied ? 'הועתק' : 'העתק תשובה'}</span>
                </button>
              </div>
            )}
          </div>

          {message.isStreaming && (
            <div className="flex gap-1.5 mt-4 px-2">
              <span className="w-2 h-2 bg-blue-500/40 rounded-full animate-pulse"></span>
              <span className="w-2 h-2 bg-blue-500/60 rounded-full animate-pulse [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-blue-500/80 rounded-full animate-pulse [animation-delay:0.4s]"></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
