
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
      const reader = new FileReader();
      
      const promise = new Promise<void>((resolve) => {
        reader.onload = () => {
          const base64Data = (reader.result as string).split(',')[1];
          newAttachments.push({
            name: file.name,
            mimeType: file.type,
            data: base64Data,
            size: file.size
          });
          resolve();
        };
      });
      
      reader.readAsDataURL(file);
      await promise;
    }

    onUpload(newAttachments);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-4">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-white hover:border-blue-400 transition-all group"
        >
          <input 
            type="file" 
            multiple 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.txt,.jpg,.jpeg,.png,.md"
          />
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload size={20} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">העלאת חומרים</p>
            <p className="text-[10px] text-slate-400">PDF, תמונות, טקסט</p>
          </div>
        </button>

        <div className="space-y-2">
          {attachments.map((file) => (
            <div key={file.name} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 group hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="text-blue-500">
                  <FileText size={16} />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-medium truncate text-slate-700">{file.name}</span>
                  <span className="text-[9px] text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
              </div>
              <button 
                onClick={() => onRemove(file.name)}
                className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {attachments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-slate-400 italic">טרם הועלו קבצים</p>
            </div>
          )}
        </div>
      </div>
      
      {attachments.length > 0 && (
        <div className="mt-auto p-4 bg-blue-50/50 flex items-center gap-2 text-[11px] text-blue-700">
          <CheckCircle2 size={14} />
          <span>המודל מנתח את החומרים בזמן אמת</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
