import React, { useState, useEffect } from 'react';
import { Search, X, Sparkles } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  placeholder?: string;
  isSearching?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search emails by subject, recipient, sender, or content...',
  isSearching = false,
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [localValue, onChange, value]);

  return (
    <div className="relative flex-1 max-w-xl">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
        <Search className="w-4 h-4" />
      </div>

      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-24 py-2 bg-slate-900/90 border border-slate-800 focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500 rounded-xl text-xs text-slate-200 placeholder-slate-400 transition-all outline-none"
      />

      <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center space-x-1.5">
        {isSearching ? (
          <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : localValue ? (
          <button
            onClick={() => {
              setLocalValue('');
              onChange('');
            }}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-md"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-[10px] text-blue-400 font-medium border border-blue-500/20">
          <Sparkles className="w-2.5 h-2.5" />
          <span>Elasticsearch</span>
        </span>
      </div>
    </div>
  );
};
