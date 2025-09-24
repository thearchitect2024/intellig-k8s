import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  } catch {
    return timestamp;
  }
}

export function detectLogLevel(line: string): 'error' | 'warn' | 'info' | 'debug' | null {
  const lowerLine = line.toLowerCase();
  
  if (lowerLine.includes('error') || lowerLine.includes('err') || lowerLine.includes('exception') || lowerLine.includes('fatal')) {
    return 'error';
  }
  if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
    return 'warn';
  }
  if (lowerLine.includes('info')) {
    return 'info';
  }
  if (lowerLine.includes('debug') || lowerLine.includes('trace')) {
    return 'debug';
  }
  
  return null;
}

export function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve();
  }
}

export function encodeCredentials(credentials: any): string {
  return btoa(JSON.stringify(credentials));
}
