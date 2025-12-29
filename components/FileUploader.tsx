
import React, { useRef } from 'react';
import { Attachment } from '../types';
import { Upload, FileText, X, CheckCircle2 } from 'lucide-react';

interface FileUploaderProps {
  attachments: Attachment[];
  onUpload: (newAttachments: Attachment[]) => void;
  onRemove: (name: string) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ attachments, onUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const promise = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          let extractedText = '';

          if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
            try {
              extractedText = await file.text();
            } catch (err) {
              console.error("Failed to extract text for search:", err);
            }
          }

          newAttachments.push({
            name: file.name,
            mimeType: file.type,
            data: base64Data,
            size: file.size,
            extractedText
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
      
      await promise;
    }

    onUpload(newAttachments);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="space-y-6">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[32px] hover:bg-white dark:hover:bg-slate-900/40 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all group"
        >
          <input 
            type="file" 
            multiple 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.txt,.jpg,.jpeg,.png,.md"
          />
          <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-[22px] flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
            <Upload size={28} />
          </div>
          <div className="text-center">
            <p className="text-base font-black text-slate-800 dark:text-slate-200">גררו קבצים לכאן</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1 uppercase tracking-wide">PDF, תמונות, טקסט או קוד</p>
          </div>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {attachments.map((file) => (
            <div key={file.name} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText size={18} className="text-blue-500 flex-shrink-0" />
                <div className="flex flex-col overflow-hidden text-right">
                  <span className="text-[11px] font-black truncate text-slate-800 dark:text-slate-200">{file.name}</span>
                  <span className="text-[9px] text-slate-400 font-medium uppercase">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
              <button 
                onClick={() => onRemove(file.name)}
                className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {attachments.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xs text-slate-400 font-bold italic">טרם נוספו חומרי לימוד למאגר זה.</p>
          </div>
        )}
      </div>
      
      {attachments.length > 0 && (
        <div className="mt-8 p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 flex items-center gap-4 text-[12px] text-blue-700 dark:text-blue-400 rounded-3xl">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center flex-shrink-0"><CheckCircle2 size={18} /></div>
          <p className="font-bold leading-relaxed">המודל מוכן לנתח את {attachments.length} הקבצים שהעלית. פשוט שאל שאלה בצ'אט!</p>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
