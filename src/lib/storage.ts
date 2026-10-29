export interface HistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  engine: string;
  timestamp: number;
  charCount: number;
}

export interface APIKeys {
  baiduAppId?: string;
  baiduKey?: string;
  azureKey?: string;
  customEndpoint?: string;
  customKey?: string;
  customModel?: string;
}

const HISTORY_KEY = 'translator_history';
const KEYS_KEY = 'translator_api_keys';

export function getHistory(): HistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveHistory(item: HistoryItem): void {
  const history = getHistory();
  history.unshift(item);
  // Keep last 50 items
  if (history.length > 50) history.length = 50;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function deleteHistoryItem(id: string): void {
  const history = getHistory().filter(item => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function getAPIKeys(): APIKeys {
  try {
    const data = localStorage.getItem(KEYS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveAPIKeys(keys: APIKeys): void {
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
}
