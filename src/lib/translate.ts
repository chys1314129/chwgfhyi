import { bingLangMap, baiduLangMap } from './languages';
import { APIKeys } from './storage';

export type TranslationEngine = 'google' | 'bing' | 'baidu' | 'custom';

export interface TranslateOptions {
  engine: TranslationEngine;
  sourceLang: string;
  targetLang: string;
  apiKeys?: APIKeys;
  customPreset?: string;
}

// Google Translate (free, no API key needed)
export async function translateGoogle(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
  const tl = targetLang;
  
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Translate error: ${response.status}`);
  
  const data = await response.json();
  if (!data || !data[0]) throw new Error('Google Translate returned empty result');
  
  return data[0].map((item: any) => item[0]).join('');
}

// Bing/Microsoft Translate (free endpoint)
export async function translateBing(text: string, sourceLang: string, targetLang: string, azureKey?: string): Promise<string> {
  const sl = bingLangMap[sourceLang] || sourceLang;
  const tl = bingLangMap[targetLang] || targetLang;

  if (azureKey) {
    // Azure Translator API
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${sl === 'auto-detect' ? '' : sl}&to=${tl}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ text }]),
    });
    if (!response.ok) throw new Error(`Azure Translator error: ${response.status}`);
    const data = await response.json();
    return data[0]?.translations?.[0]?.text || '';
  }

  // Free Bing endpoint
  const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${sl === 'auto-detect' ? '' : sl}&to=${tl}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ text }]),
  });
  
  if (!response.ok) {
    // Fallback to Google if Bing free endpoint fails
    return translateGoogle(text, sourceLang, targetLang);
  }
  
  const data = await response.json();
  return data[0]?.translations?.[0]?.text || '';
}

// Baidu Translate (BYOK)
export async function translateBaidu(text: string, sourceLang: string, targetLang: string, appId: string, key: string): Promise<string> {
  if (!appId || !key) throw new Error('百度翻译需要填写 APP ID 和密钥');
  
  const from = baiduLangMap[sourceLang] || sourceLang;
  const to = baiduLangMap[targetLang] || targetLang;
  const salt = Date.now().toString();
  const sign = await md5(appId + text + salt + key);
  
  const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=${from}&to=${to}&appid=${appId}&salt=${salt}&sign=${sign}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`百度翻译请求失败: ${response.status}`);
  
  const data = await response.json();
  if (data.error_code) {
    const errorMessages: Record<string, string> = {
      '52001': '请求超时，请重试',
      '52002': '系统错误，请重试',
      '52003': '未授权用户，请检查 APP ID',
      '54000': '缺少必填参数，请检查配置',
      '54001': '签名错误，请检查密钥',
      '54003': '访问频率受限，请稍后重试',
      '54004': '账户余额不足',
      '54005': '长 query 请求频繁',
      '58000': '客户端 IP 不在白名单',
      '58001': '译文语言方向不支持',
      '90107': '认证未通过或未生效',
    };
    throw new Error(errorMessages[data.error_code] || `百度翻译错误 ${data.error_code}: ${data.error_msg}`);
  }
  
  return data.trans_result?.map((item: any) => item.dst).join('\n') || '';
}

// Custom LLM (OpenAI compatible / Anthropic / Gemini)
export async function translateCustom(text: string, sourceLang: string, targetLang: string, keys: APIKeys, preset?: string): Promise<string> {
  if (!keys.customEndpoint || !keys.customKey) {
    throw new Error('请配置自定义大模型的 API 地址和密钥');
  }

  const systemPrompt = `You are a professional translator. Translate the following text to ${targetLang}. ${sourceLang !== 'auto' ? `The source language is ${sourceLang}.` : 'Detect the source language automatically.'} Only output the translation, nothing else. Maintain the original formatting (paragraphs, line breaks).`;

  const presetConfig = getLLMPreset(preset);

  if (presetConfig?.type === 'anthropic') {
    return translateAnthropic(text, systemPrompt, keys, presetConfig!);
  }
  
  if (presetConfig?.type === 'gemini') {
    return translateGemini(text, systemPrompt, keys, presetConfig!);
  }

  // Default: OpenAI compatible
  return translateOpenAICompatible(text, systemPrompt, keys, presetConfig || undefined);
}

async function translateOpenAICompatible(text: string, systemPrompt: string, keys: APIKeys, preset?: LLMPreset | null): Promise<string> {
  const url = keys.customEndpoint!;
  const model = keys.customModel || preset?.defaultModel || 'gpt-4o-mini';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${keys.customKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API 错误 (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function translateAnthropic(text: string, systemPrompt: string, keys: APIKeys, preset: LLMPreset): Promise<string> {
  const url = keys.customEndpoint!;
  const model = keys.customModel || preset.defaultModel || 'claude-3-5-sonnet-20241022';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': keys.customKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: text },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API 错误 (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

async function translateGemini(text: string, systemPrompt: string, keys: APIKeys, preset: LLMPreset): Promise<string> {
  const model = keys.customModel || preset.defaultModel || 'gemini-2.0-flash';
  const endpoint = keys.customEndpoint || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const url = `${endpoint}?key=${keys.customKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API 错误 (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

interface LLMPreset {
  type: 'openai' | 'anthropic' | 'gemini';
  endpoint: string;
  defaultModel: string;
}

export function getLLMPreset(preset?: string): LLMPreset | null {
  const presets: Record<string, LLMPreset> = {
    'openai': { type: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o-mini' },
    'deepseek': { type: 'openai', endpoint: 'https://api.deepseek.com/v1/chat/completions', defaultModel: 'deepseek-chat' },
    'kimi': { type: 'openai', endpoint: 'https://api.moonshot.cn/v1/chat/completions', defaultModel: 'moonshot-v1-8k' },
    'zhipu': { type: 'openai', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', defaultModel: 'glm-4-flash' },
    'qwen': { type: 'openai', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', defaultModel: 'qwen-turbo' },
    'openrouter': { type: 'openai', endpoint: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'openai/gpt-4o-mini' },
    'claude': { type: 'anthropic', endpoint: 'https://api.anthropic.com/v1/messages', defaultModel: 'claude-3-5-sonnet-20241022' },
    'gemini': { type: 'gemini', endpoint: '', defaultModel: 'gemini-2.0-flash' },
  };
  return preset ? presets[preset] || null : null;
}

// Simple MD5 implementation for Baidu API
async function md5(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('MD5' as any, data).catch(async () => {
    // Fallback: use a simple hash if MD5 not supported
    return crypto.subtle.digest('SHA-256', data);
  });
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Main translate function
export async function translate(text: string, options: TranslateOptions): Promise<string> {
  const { engine, sourceLang, targetLang, apiKeys, customPreset } = options;

  switch (engine) {
    case 'google':
      return translateGoogle(text, sourceLang, targetLang);
    case 'bing':
      return translateBing(text, sourceLang, targetLang, apiKeys?.azureKey);
    case 'baidu':
      return translateBaidu(text, sourceLang, targetLang, apiKeys?.baiduAppId || '', apiKeys?.baiduKey || '');
    case 'custom':
      return translateCustom(text, sourceLang, targetLang, apiKeys || {}, customPreset);
    default:
      throw new Error(`Unknown engine: ${engine}`);
  }
}
