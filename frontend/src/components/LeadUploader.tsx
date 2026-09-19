import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, Trash2, Download } from 'lucide-react';
import { emailApi } from '../lib/api';

interface LeadUploaderProps {
  onLeadsLoaded: (emails: string[]) => void;
  recipientsCount: number;
}

export const LeadUploader: React.FC<LeadUploaderProps> = ({
  onLeadsLoaded,
  recipientsCount,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await emailApi.parseLeads(file);
      setFileName(file.name);
      onLeadsLoaded(data.emails);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse lead list. Make sure it contains valid email addresses.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDownloadSample = () => {
    const csvContent = 'data:text/csv;charset=utf-8,email,name,company\nalice@techcorp.io,Alice Smith,TechCorp\nbob@innovate.ai,Bob Jones,Innovate AI\ncharlie@venturelabs.com,Charlie Brown,Venture Labs\ndavid@growthscale.org,David Miller,GrowthScale\nemma@nextgen.co,Emma Watson,NextGen';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'reachinbox_sample_leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClear = () => {
    setFileName(null);
    onLeadsLoaded([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <label className="font-medium text-slate-300 flex items-center space-x-1.5">
          <span>Recipient Lead List (CSV / TXT)</span>
          <span className="text-slate-400 font-normal">or enter emails below</span>
        </label>
        <button
          type="button"
          onClick={handleDownloadSample}
          className="text-blue-400 hover:text-blue-300 flex items-center space-x-1 text-[11px] font-medium"
        >
          <Download className="w-3 h-3" />
          <span>Sample CSV</span>
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-2 space-y-2">
            <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Parsing email addresses...</span>
          </div>
        ) : fileName && recipientsCount > 0 ? (
          <div className="flex items-center justify-between px-3 py-1">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-200">{fileName}</div>
                <div className="text-[11px] text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{recipientsCount} valid email leads detected</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
              title="Remove file"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
            <div className="p-2 rounded-xl bg-slate-800/80 text-blue-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-slate-300">
              Drop CSV or TXT file here, or <span className="text-blue-400 underline">browse</span>
            </p>
            <p className="text-[10px] text-slate-400">
              Supports CSV with email columns or plain text email lists
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg">{error}</p>}
    </div>
  );
};
