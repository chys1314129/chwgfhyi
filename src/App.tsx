import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Languages, ArrowLeftRight, Copy, Download, Upload, Settings, 
  Clock, Trash2, X, Play, Pause, RotateCcw, ChevronDown,
  Check, AlertCircle, Loader2, FileText, Sparkles
} from 'lucide-react';
import { chunkText, verifyReassembly } from './lib/chunk';
import { translate, TranslationEngine, TranslateOptions, getLLMPreset } from './lib/translate';
import { languages } from './lib/languages';
import { getHistory, saveHistory, deleteHistoryItem, clearHistory, getAPIKeys, saveAPIKeys, HistoryItem, APIKeys } from './lib/storage';

type AppView = 'translate' | 'settings' | 'history';

export default function App() {
  const [view, setView] = useState<AppView>('translate');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [engine, setEngine] = useState<TranslationEngine>('google');
  const [customPreset, setCustomPreset] = useState('openai');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [completedChunks, setCompletedChunks] = useState(0);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKeys>({});
  const [showLangDropdown, setShowLangDropdown] = useState<'source' | 'target' | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const translatedChunksRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(getHistory());
    setApiKeys(getAPIKeys());
  }, []);

  const swapLanguages = () => {
    if (sourceLang === 'auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleTranslate = async () => {
    if (!sourceText.trim() || isTranslating) return;
    
    setError('');
    setIsTranslating(true);
    setProgress(0);
    setTranslatedText('');
    translatedChunksRef.current = [];

    const chunks = chunkText(sourceText);
    setTotalChunks(chunks.length);
    setCompletedChunks(0);

    // Verify chunking
    if (!verifyReassembly(sourceText, chunks)) {
      setError('分块验证失败，请检查文本');
      setIsTranslating(false);
      return;
    }

    abortRef.current = new AbortController();
    const options: TranslateOptions = { engine, sourceLang, targetLang, apiKeys, customPreset };
    
    const results: string[] = new Array(chunks.length).fill('');
    let completed = 0;
    let hasError = false;

    // Translate chunks with concurrency limit
    const concurrency = 3;
    const queue = [...Array(chunks.length).keys()];
    
    const translateChunk = async (idx: number) => {
      if (abortRef.current?.signal.aborted) return;
      
      try {
        setCurrentChunkIndex(idx);
        const result = await translate(chunks[idx].text, options);
        results[idx] = result;
        translatedChunksRef.current = [...results];
        completed++;
        setCompletedChunks(completed);
        setProgress((completed / chunks.length) * 100);
        
        // Update displayed text progressively
        const displayText = results.join('');
        setTranslatedText(displayText);
      } catch (err: any) {
        hasError = true;
        setError(`片段 ${idx + 1} 翻译失败: ${err.message}`);
      }
    };

    const workers = Array(concurrency).fill(null).map(async () => {
      while (queue.length > 0) {
        if (abortRef.current?.signal.aborted) break;
        const idx = queue.shift();
        if (idx !== undefined) {
          await translateChunk(idx);
        }
      }
    });

    await Promise.all(workers);
    
    if (!hasError && !abortRef.current?.signal.aborted) {
      const finalText = results.join('');
      setTranslatedText(finalText);
      setProgress(100);
      
      // Save to history
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        sourceText: sourceText.slice(0, 500),
        translatedText: finalText.slice(0, 500),
        sourceLang,
        targetLang,
        engine,
        timestamp: Date.now(),
        charCount: sourceText.length,
      };
      saveHistory(historyItem);
      setHistory(getHistory());
    }

    setIsTranslating(false);
    setCurrentChunkIndex(-1);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsTranslating(false);
    setCurrentChunkIndex(-1);
  };

  const handleCopy = async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!translatedText) return;
    const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setSourceText(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveKeys = (keys: APIKeys) => {
    setApiKeys(keys);
    saveAPIKeys(keys);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-300/30 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-pink-300/30 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 pt-6 pb-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Languages className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">长文翻译助手</h1>
              <p className="text-xs text-gray-500">Long-form Translator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavButton icon={<Clock />} active={view === 'history'} onClick={() => setView(view === 'history' ? 'translate' : 'history')} />
            <NavButton icon={<Settings />} active={view === 'settings'} onClick={() => setView(view === 'settings' ? 'translate' : 'settings')} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {view === 'translate' && (
              <motion.div key="translate" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <TranslateView
                  sourceText={sourceText}
                  setSourceText={setSourceText}
                  translatedText={translatedText}
                  sourceLang={sourceLang}
                  setSourceLang={setSourceLang}
                  targetLang={targetLang}
                  setTargetLang={setTargetLang}
                  engine={engine}
                  setEngine={setEngine}
                  customPreset={customPreset}
                  setCustomPreset={setCustomPreset}
                  isTranslating={isTranslating}
                  progress={progress}
                  totalChunks={totalChunks}
                  completedChunks={completedChunks}
                  error={error}
                  copied={copied}
                  currentChunkIndex={currentChunkIndex}
                  showLangDropdown={showLangDropdown}
                  setShowLangDropdown={setShowLangDropdown}
                  onTranslate={handleTranslate}
                  onStop={handleStop}
                  onSwap={swapLanguages}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                  onFileUpload={handleFileUpload}
                  fileInputRef={fileInputRef}
                />
              </motion.div>
            )}
            {view === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <SettingsView apiKeys={apiKeys} onSaveKeys={handleSaveKeys} />
              </motion.div>
            )}
            {view === 'history' && (
              <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <HistoryView history={history} onDelete={(id) => { deleteHistoryItem(id); setHistory(getHistory()); }} onClear={() => { clearHistory(); setHistory([]); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// Nav Button Component
function NavButton({ icon, active, onClick }: { icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 ${
        active
          ? 'bg-white/80 shadow-lg shadow-black/5 text-blue-600 backdrop-blur-xl'
          : 'bg-white/40 text-gray-600 hover:bg-white/60 backdrop-blur-lg'
      }`}
    >
      {icon}
    </motion.button>
  );
}

// Translate View
interface TranslateViewProps {
  sourceText: string;
  setSourceText: (v: string) => void;
  translatedText: string;
  sourceLang: string;
  setSourceLang: (v: string) => void;
  targetLang: string;
  setTargetLang: (v: string) => void;
  engine: TranslationEngine;
  setEngine: (v: TranslationEngine) => void;
  customPreset: string;
  setCustomPreset: (v: string) => void;
  isTranslating: boolean;
  progress: number;
  totalChunks: number;
  completedChunks: number;
  error: string;
  copied: boolean;
  currentChunkIndex: number;
  showLangDropdown: 'source' | 'target' | null;
  setShowLangDropdown: (v: 'source' | 'target' | null) => void;
  onTranslate: () => void;
  onStop: () => void;
  onSwap: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function TranslateView(props: TranslateViewProps) {
  const {
    sourceText, setSourceText, translatedText,
    sourceLang, setSourceLang, targetLang, setTargetLang,
    engine, setEngine, customPreset, setCustomPreset,
    isTranslating, progress, totalChunks, completedChunks,
    error, copied, currentChunkIndex,
    showLangDropdown, setShowLangDropdown,
    onTranslate, onStop, onSwap, onCopy, onDownload, onFileUpload, fileInputRef
  } = props;

  return (
    <div className="space-y-4">
      {/* Engine Selector */}
      <GlassCard className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-700">引擎:</span>
          {(['google', 'bing', 'baidu', 'custom'] as TranslationEngine[]).map((e) => (
            <motion.button
              key={e}
              whileTap={{ scale: 0.95 }}
              onClick={() => setEngine(e)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-300 ${
                engine === e
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/50 text-gray-600 hover:bg-white/80'
              }`}
            >
              {e === 'google' ? '谷歌' : e === 'bing' ? '必应' : e === 'baidu' ? '百度' : '大模型'}
            </motion.button>
          ))}
          {engine === 'custom' && (
            <select
              value={customPreset}
              onChange={(e) => setCustomPreset(e.target.value)}
              className="px-2 py-1 rounded-lg text-xs bg-white/50 border border-white/30 text-gray-700"
            >
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="kimi">Kimi</option>
              <option value="zhipu">智谱</option>
              <option value="qwen">通义千问</option>
              <option value="openrouter">OpenRouter</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
            </select>
          )}
        </div>
      </GlassCard>

      {/* Language Selector */}
      <GlassCard className="p-3">
        <div className="flex items-center gap-2">
          <LangSelector
            label="源语言"
            value={sourceLang}
            onChange={setSourceLang}
            isOpen={showLangDropdown === 'source'}
            onToggle={() => setShowLangDropdown(showLangDropdown === 'source' ? null : 'source')}
            includeAuto
          />
          
          <motion.button
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={onSwap}
            disabled={sourceLang === 'auto'}
            className="w-10 h-10 rounded-2xl bg-white/60 flex items-center justify-center hover:bg-white/80 transition-all disabled:opacity-30"
          >
            <ArrowLeftRight className="w-4 h-4 text-gray-600" />
          </motion.button>

          <LangSelector
            label="目标语言"
            value={targetLang}
            onChange={setTargetLang}
            isOpen={showLangDropdown === 'target'}
            onToggle={() => setShowLangDropdown(showLangDropdown === 'target' ? null : 'target')}
          />
        </div>
      </GlassCard>

      {/* Source Text Area */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">原文</span>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl bg-white/50 hover:bg-white/80 transition-all"
              title="上传文件"
            >
              <Upload className="w-4 h-4 text-gray-600" />
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.srt,.json,.csv,.html,.xml"
              onChange={onFileUpload}
              className="hidden"
            />
            <span className="text-xs text-gray-400">{sourceText.length} 字</span>
          </div>
        </div>
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="在此粘贴或输入要翻译的长文..."
          className="w-full h-48 bg-transparent resize-none outline-none text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed"
        />
      </GlassCard>

      {/* Progress Bar */}
      {isTranslating && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <GlassCard className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">
                翻译中... {completedChunks}/{totalChunks} 片段
              </span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onStop}
                className="px-3 py-1 rounded-xl bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 transition-all"
              >
                停止
              </motion.button>
            </div>
            <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Translate Button */}
      {!isTranslating && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02 }}
          onClick={onTranslate}
          disabled={!sourceText.trim()}
          className="w-full py-4 rounded-3xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-semibold text-base shadow-xl shadow-purple-500/20 disabled:opacity-50 disabled:shadow-none transition-all duration-300"
        >
          <div className="flex items-center justify-center gap-2">
            <Play className="w-5 h-5" />
            <span>开始翻译</span>
          </div>
        </motion.button>
      )}

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-2xl bg-red-50/80 backdrop-blur-xl border border-red-200/50"
        >
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-600">{error}</span>
        </motion.div>
      )}

      {/* Translated Text */}
      {translatedText && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">译文</span>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onCopy}
                  className="p-2 rounded-xl bg-white/50 hover:bg-white/80 transition-all"
                  title="复制"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-600" />}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onDownload}
                  className="p-2 rounded-xl bg-white/50 hover:bg-white/80 transition-all"
                  title="下载"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </motion.button>
              </div>
            </div>
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {translatedText}
            </div>
            <div className="mt-2 text-xs text-gray-400">{translatedText.length} 字</div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}

// Language Selector Component
function LangSelector({ label, value, onChange, isOpen, onToggle, includeAuto }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  includeAuto?: boolean;
}) {
  const filteredLangs = includeAuto ? languages : languages.filter(l => l.code !== 'auto');
  const selected = languages.find(l => l.code === value);

  return (
    <div className="flex-1 relative">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-white/50 hover:bg-white/70 transition-all"
      >
        <div className="text-left">
          <div className="text-[10px] text-gray-400">{label}</div>
          <div className="text-sm font-medium text-gray-800 truncate">{selected?.nativeName || value}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 max-h-64 overflow-y-auto rounded-2xl bg-white/90 backdrop-blur-2xl shadow-2xl shadow-black/10 border border-white/50"
          >
            {filteredLangs.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { onChange(lang.code); onToggle(); }}
                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50/50 transition-colors flex items-center justify-between ${
                  value === lang.code ? 'text-blue-600 font-medium bg-blue-50/30' : 'text-gray-700'
                }`}
              >
                <span>{lang.nativeName}</span>
                <span className="text-xs text-gray-400">{lang.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Settings View
function SettingsView({ apiKeys, onSaveKeys }: { apiKeys: APIKeys; onSaveKeys: (k: APIKeys) => void }) {
  const [keys, setKeys] = useState<APIKeys>(apiKeys);

  const handleSave = () => {
    onSaveKeys(keys);
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600" />
          API 密钥配置
        </h2>
        <p className="text-xs text-gray-500 mb-4">密钥仅保存在浏览器本地，不会上传至服务器。</p>

        <div className="space-y-4">
          {/* Baidu */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              百度翻译
            </h3>
            <input
              type="text"
              placeholder="APP ID"
              value={keys.baiduAppId || ''}
              onChange={(e) => setKeys({ ...keys, baiduAppId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/40 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
            <input
              type="password"
              placeholder="密钥"
              value={keys.baiduKey || ''}
              onChange={(e) => setKeys({ ...keys, baiduKey: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/40 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
          </div>

          {/* Azure */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Azure 翻译 (可选，用于必应引擎)
            </h3>
            <input
              type="password"
              placeholder="Azure Key"
              value={keys.azureKey || ''}
              onChange={(e) => setKeys({ ...keys, azureKey: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/40 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
          </div>

          {/* Custom LLM */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              自定义大模型
            </h3>
            <input
              type="text"
              placeholder="API 地址 (如 https://api.openai.com/v1/chat/completions)"
              value={keys.customEndpoint || ''}
              onChange={(e) => setKeys({ ...keys, customEndpoint: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/40 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
            <input
              type="password"
              placeholder="API Key"
              value={keys.customKey || ''}
              onChange={(e) => setKeys({ ...keys, customKey: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/40 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
            <input
              type="text"
              placeholder="模型名称 (可选，如 gpt-4o-mini)"
              value={keys.customModel || ''}
              onChange={(e) => setKeys({ ...keys, customModel: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/40 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium shadow-lg shadow-blue-500/20"
        >
          保存配置
        </motion.button>
      </GlassCard>

      {/* Preset Info */}
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">🚀 大模型快捷预设</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
            { name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
            { name: 'Kimi', endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
            { name: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-flash' },
            { name: '通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-turbo' },
            { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-4o-mini' },
          ].map((p) => (
            <motion.button
              key={p.name}
              whileTap={{ scale: 0.95 }}
              onClick={() => setKeys({ ...keys, customEndpoint: p.endpoint, customModel: p.model })}
              className="px-3 py-2 rounded-xl bg-white/50 text-xs text-gray-700 hover:bg-white/80 transition-all text-left"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-[10px] text-gray-400 truncate">{p.model}</div>
            </motion.button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

// History View
function HistoryView({ history, onDelete, onClear }: { history: HistoryItem[]; onDelete: (id: string) => void; onClear: () => void }) {
  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            翻译历史
          </h2>
          {history.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClear}
              className="px-3 py-1.5 rounded-xl bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition-all"
            >
              清空全部
            </motion.button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无翻译历史</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-2xl bg-white/40 border border-white/30"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                      {item.engine}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-400">{item.charCount} 字</span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onDelete(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </motion.button>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{item.sourceText}</p>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.translatedText}</p>
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// Glass Card Component
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl bg-white/60 backdrop-blur-2xl border border-white/40 shadow-lg shadow-black/5 ${className}`}>
      {children}
    </div>
  );
}
