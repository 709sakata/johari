import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/g, '') // Keep alphanumeric and Japanese characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single one
    .substring(0, 100); // Limit length
}

/**
 * Handles automatic list continuation (unordered and ordered) in a textarea.
 * Returns true if the event was handled (and default prevented).
 */
export function handleListContinuation(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  content: string,
  setContent: (value: string) => void
): boolean {
  if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.shiftKey) return false;

  const textarea = e.currentTarget;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  
  const textBefore = content.substring(0, start);
  const lines = textBefore.split('\n');
  const currentLine = lines[lines.length - 1];
  
  const unorderedMatch = currentLine.match(/^(\s*[-*+])\s+(.*)/);
  const orderedMatch = currentLine.match(/^(\s*(\d+)\.)\s+(.*)/);
  
  if (unorderedMatch) {
    const prefix = unorderedMatch[1];
    const lineContent = unorderedMatch[2];
    
    if (lineContent.trim() === '') {
      // Empty list item - clear it to end the list
      e.preventDefault();
      const lineStart = start - currentLine.length;
      const newContent = content.substring(0, lineStart) + content.substring(start);
      setContent(newContent);
      setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
    } else {
      e.preventDefault();
      const insertion = '\n' + prefix + ' ';
      const newContent = content.substring(0, start) + insertion + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        const newPos = start + insertion.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
    return true;
  }
  
  if (orderedMatch) {
    const fullPrefix = orderedMatch[1];
    const num = parseInt(orderedMatch[2]);
    const lineContent = orderedMatch[3];
    
    if (lineContent.trim() === '') {
      // Empty list item - clear it to end the list
      e.preventDefault();
      const lineStart = start - currentLine.length;
      const newContent = content.substring(0, lineStart) + content.substring(start);
      setContent(newContent);
      setTimeout(() => textarea.setSelectionRange(lineStart, lineStart), 0);
    } else {
      e.preventDefault();
      const nextNum = num + 1;
      const nextPrefix = fullPrefix.replace(/\d+/, nextNum.toString());
      const insertion = '\n' + nextPrefix + ' ';
      const newContent = content.substring(0, start) + insertion + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        const newPos = start + insertion.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
    return true;
  }
  return false;
}
