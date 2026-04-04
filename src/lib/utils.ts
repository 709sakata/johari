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
