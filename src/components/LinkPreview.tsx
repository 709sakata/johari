import { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

export function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error();
        const json = await response.json();
        if (isMounted) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchPreview();
    return () => { isMounted = false; };
  }, [url]);

  if (loading) return (
    <div className="p-4 border border-gray-100 rounded-2xl bg-gray-50/50 flex items-center gap-3 animate-pulse">
      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
      <span className="text-xs text-gray-400 font-medium">リンクを読み込み中...</span>
    </div>
  );

  // Fallback data if fetch failed
  const displayData = data || { url, title: url };

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block group overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all"
    >
      <div className="flex flex-col sm:flex-row">
        {displayData.image && displayData.image !== "" && (
          <div className="sm:w-48 h-32 sm:h-auto overflow-hidden bg-gray-50 flex-shrink-0">
            <img 
              src={displayData.image} 
              alt={displayData.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        <div className="p-4 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <ExternalLink className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest truncate">
              {new URL(url).hostname}
            </span>
          </div>
          <h4 className="text-sm font-black text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {displayData.title || url}
          </h4>
          {displayData.description && (
            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {displayData.description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
