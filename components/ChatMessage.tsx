
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
      
      const codeBlocks: string[] = [];
      text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        const id = codeBlocks.length;
        codeBlocks.push(code.trim());
        return `__CODE_BLOCK_${id}_${lang || 'code'}__`;
      });

      // Render block math
      text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m, f) => {
        try {
          // Fix: 'color' is not a valid KatexOption. Moved to style attribute.
          const rendered = katex.renderToString(f.trim(), { 
            displayMode: true, 
            throwOnError: false,
            trust: true,
            macros: { "\\abs": "|#1|" }
          });
          return `<div class="math-block my-4 p-2 bg-slate-800 rounded-lg text-white" style="direction: ltr; text-align: center; color: white;">${rendered}</div>`;
        } catch (e) { return m; }
      });

      // Render inline math
      text = text.replace(/\$([\s\S]+?)\$/g, (m, f) => {
        try {
          // Fix: 'color' is not a valid KatexOption. Moved to style attribute.
          const rendered = katex.renderToString(f.trim(), { 
            displayMode: false, 
            throwOnError: false,
            trust: true,
            macros: { "\\abs": "|#1|" }
          });
          return `<span class="math-inline font-bold px-1 py-0.5 bg-slate-800/80 rounded text-white" style="direction: ltr; unicode-bidi: isolate; display: inline-block; vertical-align: middle; margin: 0 4px; color: white;">${rendered}</span>`;
        } catch (e) { return m; }
      });

      let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 dark:text-white font-black">$1</strong>')
        .replace(/\n/g, '<br/>');

      codeBlocks.forEach((code, idx) => {
        const placeholder = new RegExp(`__CODE_BLOCK_${idx}_(\\w+)__`, 'g');
        html = html.replace(placeholder, (match, lang) => {
          return `
            <div class="my-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-lg text-left" style="direction: ltr">
              <div class="flex items-center justify-between px-5 py-3 bg-slate-900 text-slate-400 text-[10px] font-mono uppercase tracking-widest border-b border-slate-800">
                <span class="flex items-center gap-2"><Terminal size={14}/> ${lang}</span>
              </div>
              <pre class="p-6 overflow-x-auto text-[13px] text-blue-100 font-mono leading-relaxed"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
            </div>
          `;
        });
      });

      html = html.replace(/\[([^\]]+?\.(pdf|txt|jpg|jpeg|png|md))(?:,\s*([^\]]+))?\]/gi, (match, filename, ext, details) => {
        const detailStr = details ? `, ${details}` : '';
        return `<span class="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold italic bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/50">(${filename}${detailStr})</span>`;
      });

      contentRef.current.innerHTML = html;
    }
  }, [message.text]);

  return (
    <div className={`group flex w-full mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex w-full max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-6`}>
        <div className={`flex-shrink-0 w-12 h-12 rounded-[18px] flex items-center justify-center shadow-md transition-all ${
          isUser ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
        }`}>
          {isUser ? <User size={24} strokeWidth={2.5} /> : <Bot size={24} strokeWidth={2.5} />}
        </div>
        <div className={`flex flex-col flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-3 mb-2.5 px-1">
            <span className="text-[12px] font-black tracking-widest text-slate-400 uppercase">{isUser ? 'השאלה שלך' : 'מענה בינה מלאכותית'}</span>
          </div>
          <div className={`relative w-full ${isUser ? 'text-right' : 'text-right'}`}>
            <div ref={contentRef} className={`leading-[1.8] text-[16px] whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200 ${isUser ? 'font-medium opacity-90' : 'font-normal'}`} />
            {!isUser && !message.isStreaming && (
              <div className="mt-5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 text-[11px] font-bold border border-slate-200 shadow-sm">{copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}<span>{copied ? 'הועתק' : 'העתקת התשובה'}</span></button>
              </div>
            )}
          </div>
          {message.isStreaming && (
            <div className="flex gap-2 mt-5 px-3">
              <span className="w-2.5 h-2.5 bg-blue-600/40 rounded-full animate-bounce"></span>
              <span className="w-2.5 h-2.5 bg-blue-600/60 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2.5 h-2.5 bg-blue-600/80 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
