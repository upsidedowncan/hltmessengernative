import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { Platform, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

export interface AISettings {
  model: string;
  temperature: number;
  max_tokens: number;
  systemPrompt: string;
  provider: string;
}

export interface AIConversation {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  model: 'llama-3.3-70b',
  temperature: 0.7,
  max_tokens: 1024,
  systemPrompt: '',
  provider: 'wafer',
};

const SETTINGS_KEY = 'ai_settings_v1';
const CONVERSATIONS_KEY = 'ai_conversations_v1';
const MESSAGES_PREFIX = 'ai_messages_v1_';
const USAGE_KEY = 'ai_usage_stats_v1';

export const AIService = {
  async getSettings(): Promise<AISettings> {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      // Force systemPrompt to be empty to ensure we use the internal Mite prompt logic for chat
      return json ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(json), systemPrompt: '' } : DEFAULT_AI_SETTINGS;
    } catch {
      return DEFAULT_AI_SETTINGS;
    }
  },

  formatModelName(modelId: string): string {
    if (!modelId) return 'Default';
    // Remove @cf/ prefix
    let name = modelId.replace('@cf/', '');
    
    // Remove vendor prefix if present (e.g. meta/, openai/)
    if (name.includes('/')) {
      name = name.split('/').pop() || name;
    }

    // Replace hyphens and underscores with spaces
    name = name.replace(/[-_]/g, ' ');

    // Capitalize words and handle acronyms
    return name.split(' ').map(word => {
      const lower = word.toLowerCase();
      if (['gpt', 'oss', 'tts', 'xl', 'lora', 'api', 'ai', 'sdxl', 'hf', 'qwq', 'moe'].includes(lower)) return word.toUpperCase();
      if (lower === 'fp8') return 'FP8';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  },

  async saveSettings(settings: AISettings) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  isModelRestricted(provider: string, modelId: string) {
    if (provider !== 'wafer') return false;
    const lower = modelId.toLowerCase();
    return !(lower.includes('llama') || lower.includes('gpt-oss'));
  },

  async checkAndIncrementUsage(provider: string, modelId: string): Promise<boolean> {
    if (!this.isModelRestricted(provider, modelId)) return true;

    try {
      const today = new Date().toISOString().split('T')[0];
      const json = await AsyncStorage.getItem(USAGE_KEY);
      let data = json ? JSON.parse(json) : { date: today, counts: {} };

      if (data.date !== today) {
        data = { date: today, counts: {} };
      }

      const currentCount = data.counts[modelId] || 0;
      if (currentCount >= 1) return false;

      data.counts[modelId] = currentCount + 1;
      await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Usage check failed', e);
      return true;
    }
  },

  async checkUsage(provider: string, modelId: string): Promise<boolean> {
    if (!this.isModelRestricted(provider, modelId)) return true;

    try {
      const today = new Date().toISOString().split('T')[0];
      const json = await AsyncStorage.getItem(USAGE_KEY);
      let data = json ? JSON.parse(json) : { date: today, counts: {} };

      if (data.date !== today) {
        return true;
      }

      const currentCount = data.counts[modelId] || 0;
      return currentCount < 1;
    } catch (e) {
      return true;
    }
  },

  async getModels(provider: string = 'wafer') {
    try {
      const { data, error } = await supabase.functions.invoke(`ai-chat?task=models&provider=${provider}`, {
        method: 'GET',
      });
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("AIService getModels error:", e);
      if (provider === 'nebula') {
        return {
          data: [
            { id: '@cf/meta/llama-3.1-8b-instruct', object: 'model' },
            { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', object: 'model' },
            { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', object: 'model' },
            { id: '@cf/microsoft/phi-2', object: 'model' },
            { id: '@cf/black-forest-labs/flux-1-schnell', object: 'model' },
            { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', object: 'model' },
          ]
        };
      }
      return {
        data: [
          { id: 'llama-3.3-70b', object: 'model' },
          { id: 'llama3.1-8b', object: 'model' },
          { id: 'llama3.1-70b', object: 'model' },
        ]
      };
    }
  },

  async getConversations(): Promise<AIConversation[]> {
    try {
      const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
      const map = json ? JSON.parse(json) : {};
      return Object.values(map).sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) as AIConversation[];
    } catch {
      return [];
    }
  },

  async createConversation(): Promise<string> {
    const id = Date.now().toString();
    const newConv: AIConversation = {
      id,
      title: 'New Chat',
      updatedAt: new Date().toISOString(),
      preview: '',
    };
    
    const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    const map = json ? JSON.parse(json) : {};
    map[id] = newConv;
    await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(map));
    return id;
  },

  async deleteConversation(id: string) {
    const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
    const map = json ? JSON.parse(json) : {};
    if (map[id]) {
        delete map[id];
        await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(map));
    }
    await AsyncStorage.removeItem(`${MESSAGES_PREFIX}${id}`);
  },

  async saveMessages(conversationId: string, messages: any[]) {
    await AsyncStorage.setItem(`${MESSAGES_PREFIX}${conversationId}`, JSON.stringify(messages));
    
    // Messages are stored newest first (index 0)
    // Use index 0 for preview, unless it's a streaming placeholder, then try index 1
    let previewMsg = messages[0];
    if (previewMsg && previewMsg.is_streaming && messages.length > 1) {
        previewMsg = messages[1];
    }

    if (previewMsg && !previewMsg.is_streaming) {
        const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
        const map = json ? JSON.parse(json) : {};
        if (map[conversationId]) {
            map[conversationId].updatedAt = new Date().toISOString();
            map[conversationId].preview = previewMsg.content.substring(0, 50).replace(/\n/g, ' ');
            await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(map));
        }
    }
  },

  async getMessages(conversationId: string): Promise<any[]> {
     try {
       const json = await AsyncStorage.getItem(`${MESSAGES_PREFIX}${conversationId}`);
       return json ? JSON.parse(json) : [];
     } catch {
       return [];
     }
  },

  async getConversation(conversationId: string): Promise<AIConversation | null> {
      const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
      const map = json ? JSON.parse(json) : {};
      return map[conversationId] || null;
  },

  async updateConversationTitle(conversationId: string, title: string) {
      const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
      const map = json ? JSON.parse(json) : {};
      if (map[conversationId]) {
          map[conversationId].title = title;
          await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(map));
      }
  },

  async generateTitle(messages: any[]): Promise<string> {
      // Find the first user message (messages are usually newest first, so reverse to find first)
      const firstUserMsg = [...messages].reverse().find(m => m.sender_id === 'user');
      const content = firstUserMsg ? firstUserMsg.content : '';
      
      if (!content) return 'New Chat';

      const systemPrompt = "You are a helpful assistant. Generate a short, concise title (3-5 words) for this conversation based on the user's input. Do not use quotes. Return ONLY the title.";

      return new Promise((resolve) => {
          let result = '';
          this.streamChat(
              [{ sender_id: 'user', content: content }],
              { 
                  model: 'gpt-oss-120b', 
                  temperature: 0.5, 
                  max_tokens: 20, 
                  systemPrompt: systemPrompt,
                  provider: 'wafer'
              },
              (chunk) => { result += chunk; },
              () => resolve(result.trim().replace(/^["']|["']$/g, '')),
              (err) => {
                  console.error("Title gen error", err);
                  resolve('New Chat');
              }
          );
      });
  },

  async streamChat(
    messages: any[],
    settings: AISettings,
    onChunk: (content: string) => void,
    onComplete: () => void,
    onError: (err: any) => void
  ) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectUrl = supabase.supabaseUrl;
      const provider = settings.provider || 'wafer';

      const allowed = await this.checkAndIncrementUsage(provider, settings.model);
      if (!allowed) {
        onError(new Error("Daily limit reached for this model (1 message/day)."));
        return;
      }

      const functionUrl = `${projectUrl}/functions/v1/ai-chat?task=chat&provider=${provider}`;

      // @ts-ignore
      const supabaseKey = supabase.supabaseKey;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', functionUrl);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (supabaseKey) xhr.setRequestHeader('apikey', supabaseKey);
      
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : (supabaseKey ? `Bearer ${supabaseKey}` : '');
      if (authHeader) xhr.setRequestHeader('Authorization', authHeader);
      
      // Required for Supabase Functions if not using the JS client
      // Assuming anon key is available via supabase client internals or env, 
      // but typically Authorization header is enough for authenticated users if RLS is set up,
      // or we need the anon key. For now, we rely on the session token.

      let finalSystemPrompt = settings.systemPrompt;

      // If no specific system prompt is passed (normal chat), generate the Mite prompt with context
      if (!finalSystemPrompt) {
          let contextInfo = "";
          try {
             if (session?.user) {
                 const [profileRes, friendsRes] = await Promise.all([
                     supabase.from('profiles').select('username, full_name').eq('id', session.user.id).single(),
                     supabase.rpc('get_friends')
                 ]);
                 
                 if (profileRes.data) {
                     contextInfo += `\nUser: ${profileRes.data.full_name} (@${profileRes.data.username})`;
                 }
                 if (friendsRes.data && Array.isArray(friendsRes.data)) {
                     const friends = friendsRes.data.map((f: any) => `${f.full_name} (@${f.username})`).join(', ');
                     contextInfo += `\nFriends: ${friends}`;
                 }
             }
          } catch (e) {
              console.log("Context fetch error", e);
          }
          
          const { width } = Dimensions.get('window');
          const maxEmbedWidth = Math.floor(width * 0.75 - 32); // 75% width minus padding
          finalSystemPrompt = `You are Mite, an intelligent AI assistant by HLT Messenger. You are helpful, witty, and concise.\n${contextInfo}\n\nUser Platform: ${Platform.OS}\n\nSPECIAL CAPABILITY: VISUALIZATIONS\nIf the user asks to visualize something, generate valid HTML/CSS/JS code.\n1. For simple inline animations, charts, or small UI elements, wrap the code in <VISUALIZATION_EMBED>...</VISUALIZATION_EMBED> tags.\n2. For games, landing pages, interactive websites, complex apps, or simulations, ALWAYS use <VISUALIZATION_FULL>...</VISUALIZATION_FULL> tags.\nCRITICAL: The content inside these tags must be ONLY valid HTML code. Do not include any conversational text, explanations, or markdown inside these tags. The HTML should be self-contained and MUST include <meta name="viewport" content="width=device-width, initial-scale=1.0"> in the head.\nIMPORTANT LAYOUT RULES:\n- For <VISUALIZATION_EMBED>, the available width is approximately ${maxEmbedWidth}px.\n- Ensure all elements are responsive (max-width: 100%).\n- Do not hardcode widths larger than ${maxEmbedWidth}px.\n\nSPECIAL CAPABILITY: IMAGE GENERATION\nIf the user asks to generate an image, output a JSON block wrapped in <IMAGE_GEN> tags.\nExample:\n<IMAGE_GEN>\n{\n  "prompt": "A futuristic city with flying cars",\n  "model": "@cf/black-forest-labs/flux-1-schnell"\n}\n</IMAGE_GEN>\nAvailable models: @cf/black-forest-labs/flux-1-schnell, @cf/stabilityai/stable-diffusion-xl-base-1.0\n\nSPECIAL CAPABILITY: PYTHON EXECUTION\nYou can write and execute Python code by wrapping it in <PYTHON_EXEC>...</PYTHON_EXEC> tags.\nThe code will be executed AUTOMATICALLY. You do not need to ask the user to run it.\nThe output will be returned to you in the next message.\nIf the output contains an error, fix the code and try again.\nIf the output is successful, proceed with your task.\n\nYou are running in a Vercel Serverless environment. You only have write access to the current working directory (which is /tmp/sandbox). Always use relative filenames (e.g., open('data.txt', 'w')) and never absolute paths outside of /tmp.\n\nAVAILABLE LIBRARIES:\n- numpy (as np): Math & Matrix operations\n- PIL (Image, ImageDraw): Image processing\n- requests: Web scraping & APIs\n- BeautifulSoup (bs4): HTML parsing\n- os, sys, io: File operations\n\nAny files saved to the current directory will be automatically detected and returned to the user as individual downloads.\nTo show an image, save it (e.g. img.save('out.png')). Do not use plt.show().\nIf you generate a file, output a JSON object with the 'code' and the expected 'filename'. Example: <PYTHON_EXEC>{"code": "...", "filename": "plot.png"}</PYTHON_EXEC>\n\nIf the user asks to create a file (e.g. 'create a shell script', 'make a text file'), DO NOT just print the code. Instead, write a Python script to create that file using open('filename', 'w').\n\nDESIGN REQUIREMENTS:\n- Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) for styling.\n- UI Guidelines: Create modern, clean, and polished interfaces. Avoid generic 'vibe coded' looks.\n- Typography: Use modern sans-serif fonts (Inter, system-ui, -apple-system). Do NOT use Arial.\n- Aesthetics: Avoid generic 'AI' gradients (neon purple/blue). Use subtle, professional color palettes, soft shadows, and rounded corners.\n- Structure: Ensure clear visual hierarchy, ample whitespace, and highlight key terms.`;
      }

      const body = JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: finalSystemPrompt },
          ...messages.map(m => ({ 
            role: m.role || (m.sender_id === 'ai' ? 'assistant' : 'user'), 
            content: m.content 
          }))
        ],
        temperature: settings.temperature,
        max_completion_tokens: settings.max_tokens,
        stream: true
      });

      let lastIndex = 0;
      let buffer = '';

      xhr.onprogress = () => {
        const currIndex = xhr.responseText.length;
        if (lastIndex === currIndex) return;
        
        const chunk = xhr.responseText.substring(lastIndex, currIndex);
        lastIndex = currIndex;
        buffer += chunk;

        // Parse SSE format (data: {...})
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.substring(6));
              let content = null;
              if (provider === 'nebula') {
                content = json.response;
              } else {
                content = json.choices?.[0]?.delta?.content;
              }
              if (content !== undefined && content !== null) onChunk(content);
            } catch (e) { /* ignore partial json */ }
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onComplete();
        } else {
          let errorMessage = `Request failed with status ${xhr.status}`;
          try {
             if (xhr.responseText) {
                 const json = JSON.parse(xhr.responseText);
                 if (json.error) errorMessage = typeof json.error === 'string' ? json.error : JSON.stringify(json.error);
                 else errorMessage = xhr.responseText;
             }
          } catch (e) {
             if (xhr.responseText) errorMessage = xhr.responseText;
          }
          onError(new Error(errorMessage));
        }
      };

      xhr.onerror = (e) => onError(e);
      xhr.send(body);

    } catch (e) {
      onError(e);
    }
  },

  async generateSpeech(text: string): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectUrl = supabase.supabaseUrl;
      const functionUrl = `${projectUrl}/functions/v1/ai-chat?task=chat&provider=nebula`;
      
      // Strip think tags and trim
      const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (!cleanText) return null;

      // @ts-ignore
      const supabaseKey = supabase.supabaseKey;

      const body = {
        model: '@cf/myshell-ai/melotts',
        prompt: cleanText
      };

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : (supabaseKey ? `Bearer ${supabaseKey}` : ''),
          ...(supabaseKey ? { 'apikey': supabaseKey } : {})
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Speech generation failed:', response.status, errText);
        throw new Error('Speech generation failed');
      }

      const contentType = response.headers.get('content-type') || '';
      let extension = 'mp3';
      if (contentType.includes('wav')) extension = 'wav';
      else if (contentType.includes('ogg')) extension = 'ogg';

      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Received empty audio blob');

      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const uri = `${FileSystem.cacheDirectory}speech_${Date.now()}.${extension}`;
          await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
          resolve(uri);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      });

    } catch (e) {
      console.error('Generate speech error', e);
      return null;
    }
  },

  async generateImage(prompt: string, model: string = '@cf/black-forest-labs/flux-1-schnell'): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!prompt || !prompt.trim()) return null;

      // Ensure correct model ID for Flux
      if (model.includes('flux') && model.includes('schnell')) {
        model = '@cf/black-forest-labs/flux-1-schnell';
      }
      console.log(`[AIService] Generating image with model: ${model}`);

      const projectUrl = supabase.supabaseUrl;
      const functionUrl = `${projectUrl}/functions/v1/ai-chat?task=chat&provider=nebula`;
      
      // @ts-ignore
      const supabaseKey = supabase.supabaseKey;

      const body = {
        model: model,
        prompt: prompt,
      };

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : (supabaseKey ? `Bearer ${supabaseKey}` : ''),
          ...(supabaseKey ? { 'apikey': supabaseKey } : {})
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Image generation failed:', response.status, errText);
        throw new Error('Image generation failed');
      }

      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Received empty image blob');

      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(',')[1];
            const uri = `${FileSystem.cacheDirectory}image_${Date.now()}.png`;
            await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
            resolve(uri);
          } else {
            reject(new Error('Failed to convert blob to base64'));
          }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      });

    } catch (e) {
      console.error('Generate image error', e);
      return null;
    }
  },

  async clearAllData() {
    try {
      const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
      const map = json ? JSON.parse(json) : {};
      const keys = Object.keys(map).map(id => `${MESSAGES_PREFIX}${id}`);
      keys.push(CONVERSATIONS_KEY);
      await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.error('Failed to clear data', e);
    }
  },
};