import { useState, useRef, useEffect } from 'react';
import { db, auth, collection, addDoc, serverTimestamp, doc, updateDoc, increment } from '../firebase';
import { OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore';
import { Send, Loader2, Eye, Edit3, Image as ImageIcon, X, Hash, AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { LinkPreview } from './LinkPreview';
import { ScrapMention } from './ScrapMention';
import { ScrapSearchModal } from './ScrapSearchModal';
import { MentionDropdown } from './MentionDropdown';
import getCaretCoordinates from 'textarea-caret';
import { toast } from 'sonner';
import { Scrap } from '../types';

import { logActivity, ActivityType } from '../lib/analytics';

interface CommentFormProps {
  scrapId: string;
  parentId?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}

export function CommentForm({ scrapId, parentId, onSuccess, autoFocus }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [isMentionModalOpen, setIsMentionModalOpen] = useState(false);
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [images, setImages] = useState<Record<string, string>>({});
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const base64 = await compressImage(file);
      const imageId = `img_${Date.now()}`;
      
      // Update images map
      setImages(prev => ({ ...prev, [imageId]: base64 }));

      // Insert markdown tag at cursor position
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + `![image](${imageId})` + content.substring(end);
        setContent(newContent);
        
        // Focus back to textarea
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + `![image](${imageId})`.length, start + `![image](${imageId})`.length);
        }, 0);
      } else {
        setContent(prev => prev + `\n![image](${imageId})\n`);
      }
    } catch (error) {
      console.error('Compression error:', error);
      toast.error('画像の処理に失敗しました。');
    } finally {
      setIsCompressing(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !auth.currentUser) return;

    setIsSubmitting(true);
    const path = `scraps/${scrapId}/comments`;
    try {
      await addDoc(collection(db, path), {
        content: content.trim(),
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        authorPhoto: auth.currentUser.photoURL || '',
        createdAt: serverTimestamp(),
        ...(parentId ? { parentId } : {}),
        ...(Object.keys(images).length > 0 ? { images } : {}),
      });

      // Update scrap comment count
      await updateDoc(doc(db, 'scraps', scrapId), {
        commentCount: increment(1),
        updatedAt: serverTimestamp()
      });

      setContent('');
      setImages({});
      logActivity(ActivityType.ACTION, undefined, 'post_comment', { scrapId, parentId: parentId || null });
      toast.success('コメントを投稿しました');
      onSuccess?.();
    } catch (error) {
      toast.error('投稿に失敗しました。データサイズが大きすぎる可能性があります。');
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to render content with base64 images for preview
  const getPreviewContent = () => {
    let preview = content;
    Object.entries(images).forEach(([id, base64]) => {
      preview = preview.split(`(${id})`).join(`(${base64})`);
    });
    return preview;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMentioning) {
      if (e.key === 'Escape') {
        setIsMentioning(false);
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
        // We'll let MentionDropdown handle these via its window listener
        // But we must prevent default here to stop textarea from processing them
        e.preventDefault();
        return;
      }
    }

    if (e.key === '@') {
      const textarea = textareaRef.current;
      if (textarea) {
        const pos = textarea.selectionStart;
        const before = content.substring(0, pos);
        if (pos === 0 || /\s$/.test(before)) {
          const coords = getCaretCoordinates(textarea, pos);
          const rect = textarea.getBoundingClientRect();
          setMentionPosition({
            top: rect.top + coords.top - textarea.scrollTop,
            left: rect.left + coords.left - textarea.scrollLeft
          });
          setMentionStartIndex(pos);
          setIsMentioning(true);
          setMentionQuery('');
        }
      }
    }

    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(e as any);
      } else if (e.key === 'b') {
        e.preventDefault();
        insertMarkdown('**', '**');
      } else if (e.key === 'i') {
        e.preventDefault();
        insertMarkdown('*', '*');
      } else if (e.key === 'k') {
        e.preventDefault();
        insertMarkdown('[', '](url)');
      }
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (isMentioning) {
      const textarea = e.target;
      const pos = textarea.selectionStart;
      
      if (pos <= mentionStartIndex) {
        setIsMentioning(false);
        return;
      }

      const queryText = newContent.substring(mentionStartIndex + 1, pos);
      
      // If user types space or newline, stop mentioning
      if (/\s/.test(queryText)) {
        setIsMentioning(false);
      } else {
        setMentionQuery(queryText);
      }
    }
  };

  const insertMention = (scrap: Scrap) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const before = content.substring(0, mentionStartIndex);
    const after = content.substring(pos);
    const mention = `[${scrap.title}](/scraps/${scrap.id})`;
    
    setContent(before + mention + after);
    setIsMentioning(false);

    setTimeout(() => {
      textarea.focus();
      const newPos = before.length + mention.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };
  const insertMarkdown = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end);
    
    setContent(newText);

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus();
      if (start === end) {
        // No selection, place cursor between prefix and suffix
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      } else {
        // Had selection, place cursor after suffix
        textarea.setSelectionRange(start + prefix.length + selectedText.length + suffix.length, start + prefix.length + selectedText.length + suffix.length);
      }
    }, 0);
  };

  return (
    <div className="bg-white p-3 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm w-full">
      <div className="flex mb-4">
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              !isPreview ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">編集</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              isPreview ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">プレビュー</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence mode="wait">
          {isPreview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="min-h-[120px] p-4 rounded-xl border border-gray-100 bg-gray-50/50 prose prose-sm prose-blue max-w-none text-gray-800 text-[13px] sm:text-sm leading-relaxed prose-headings:font-black prose-h1:text-lg sm:prose-h1:text-xl prose-h2:text-base sm:prose-h2:text-lg prose-h3:text-sm sm:prose-h3:text-base prose-h4:text-[13px] sm:prose-h4:text-sm prose-p:text-inherit prose-li:text-inherit"
            >
              {content.trim() ? (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]} 
                  rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
                  components={{
                    p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>,
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 border border-gray-100 rounded-lg">
                        <table className="w-max min-w-full divide-y divide-gray-200">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-2 bg-gray-50 font-bold text-gray-700 whitespace-nowrap">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-2 whitespace-nowrap">{children}</td>
                    ),
                    a: ({ node, ...props }) => {
                      const isUrl = props.href && (props.href.startsWith('http://') || props.href.startsWith('https://'));
                      const isScrapMention = props.href && props.href.startsWith('/scraps/');
                      
                      if (isScrapMention && props.href) {
                        const scrapId = props.href.split('/').pop() || '';
                        return <ScrapMention scrapId={scrapId} className="my-1" />;
                      }

                      if (isUrl && props.href) {
                        return (
                          <span className="block not-prose my-4">
                            <LinkPreview url={props.href} />
                          </span>
                        );
                      }
                      return (
                        <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />
                      );
                    },
                    img: ({ node, ...props }) => {
                      if (!props.src || props.src === "") return null;
                      return (
                        <img 
                          {...props} 
                          className="max-w-full h-auto rounded-xl shadow-sm my-4 border border-gray-100" 
                          referrerPolicy="no-referrer"
                        />
                      );
                    }
                  }}
                >
                  {getPreviewContent()}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-400 italic">プレビューする内容がありません</p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              <TextareaAutosize
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                placeholder={parentId ? "返信を入力..." : "コメントを入力... (Markdown対応)"}
                minRows={parentId ? 4 : 8}
                maxRows={20}
                autoFocus={autoFocus}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                maxLength={50000}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all font-bold text-sm disabled:opacity-50"
            >
              {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              <span className="hidden sm:inline">{isCompressing ? '圧縮中...' : '写真を添付'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMentionModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all font-bold text-sm"
            >
              <AtSign className="w-4 h-4" />
              <span className="hidden sm:inline">メンション</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">コメントを投稿</span>
          </button>
        </div>
      </form>

      <ScrapSearchModal
        isOpen={isMentionModalOpen}
        onClose={() => setIsMentionModalOpen(false)}
        onSelect={(scrap) => {
          const textarea = textareaRef.current;
          if (textarea) {
            const pos = textarea.selectionStart;
            const before = content.substring(0, pos);
            // If the last character is '@', replace it
            if (before.endsWith('@')) {
              setMentionStartIndex(pos - 1);
              insertMention(scrap);
            } else {
              insertMarkdown(`[${scrap.title}](/scraps/${scrap.id})`, '');
            }
          } else {
            insertMarkdown(`[${scrap.title}](/scraps/${scrap.id})`, '');
          }
          setIsMentionModalOpen(false);
        }}
      />

      {isMentioning && (
        <MentionDropdown
          searchTerm={mentionQuery}
          position={mentionPosition}
          onSelect={insertMention}
          onClose={() => setIsMentioning(false)}
        />
      )}
    </div>
  );
}
