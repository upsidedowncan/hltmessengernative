import AsyncStorage from '@react-native-async-storage/async-storage';

const PYTHON_URL_KEY = 'python_backend_url';
const DEFAULT_URL = 'https://hltpyexec.vercel.app';

export interface PythonExecutionResult {
  output: string;
  error?: string;
  status: 'Success' | 'Error';
  files: string[];
  history: Array<{
    time: string;
    status: string;
    code: string;
  }>;
}

export interface PythonFile {
  name: string;
  type: 'html' | 'image' | 'text' | 'other';
  url: string;
}

export type ContentBlock = 
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language: string; filename?: string }
  | { type: 'image_gen'; content: string; prompt: string; model: string }
  | { type: 'python_exec'; content: string; filename?: string }
  | { type: 'visualization_embed'; content: string }
  | { type: 'visualization_full'; content: string };

export const PythonExecutionService = {
  async getBackendUrl(): Promise<string> {
    try {
      const url = await AsyncStorage.getItem(PYTHON_URL_KEY);
      return url ? url.replace('/api/execute', '') : DEFAULT_URL;
    } catch {
      return DEFAULT_URL;
    }
  },

  async executeCode(code: string): Promise<PythonExecutionResult> {
    const baseUrl = await this.getBackendUrl();
    const executeUrl = `${baseUrl}/api/execute`;
    
    try {
      const response = await fetch(executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        output: data.output || '',
        error: data.error,
        status: data.status || 'Success',
        files: data.files || [],
        history: data.history || [],
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : 'Failed to execute code',
        status: 'Error',
        files: [],
        history: [],
      };
    }
  },

  async getFiles(): Promise<PythonFile[]> {
    const baseUrl = await this.getBackendUrl();
    const filesUrl = `${baseUrl}/api/files`;
    
    try {
      const response = await fetch(filesUrl);
      const data = await response.json();
      
      return (data.files || []).map((filename: string): PythonFile => {
        const extension = filename.split('.').pop()?.toLowerCase() || '';
        let type: PythonFile['type'] = 'other';
        
        if (['html', 'htm'].includes(extension)) type = 'html';
        else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) type = 'image';
        else if (['txt', 'md', 'json', 'py', 'js', 'css'].includes(extension)) type = 'text';
        
        return {
          name: filename,
          type,
          url: `${baseUrl}/api/download?file=${encodeURIComponent(filename)}`,
        };
      });
    } catch {
      return [];
    }
  },

  getFileDownloadUrl(filename: string): Promise<string> {
    return this.getBackendUrl().then(baseUrl => 
      `${baseUrl}/api/download?file=${encodeURIComponent(filename)}`
    );
  },

  getFilePreviewUrl(filename: string): Promise<string> {
    return this.getBackendUrl().then(baseUrl => 
      `${baseUrl}/api/preview?file=${encodeURIComponent(filename)}`
    );
  },

  parseContentBlocks(content: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    
    // Special tag regex - matches any of the special tags
    const specialTagRegex = /<(PYTHON_EXEC|IMAGE_GEN|VISUALIZATION_EMBED|VISUALIZATION_FULL)>([\s\S]*?)<\/\1>/g;
    let lastIndex = 0;
    let match;

    while ((match = specialTagRegex.exec(content)) !== null) {
      // Add text before the special tag
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index).trim();
        if (textBefore) {
          blocks.push({
            type: 'text',
            content: textBefore,
          });
        }
      }

      const tagType = match[1];
      const rawContent = match[2].trim();
      
      if (rawContent) {
        if (tagType === 'PYTHON_EXEC') {
          // Parse Python execution block
          try {
            const jsonContent = JSON.parse(rawContent);
            if (jsonContent.code) {
              blocks.push({
                type: 'python_exec',
                content: jsonContent.code,
                filename: jsonContent.filename,
              });
            }
          } catch {
            // If JSON parsing fails, treat as raw Python code
            blocks.push({
              type: 'python_exec',
              content: rawContent,
            });
          }
        } else if (tagType === 'IMAGE_GEN') {
          // Parse image generation block
          try {
            const jsonContent = JSON.parse(rawContent);
            if (jsonContent.prompt) {
              blocks.push({
                type: 'image_gen',
                content: rawContent,
                prompt: jsonContent.prompt,
                model: jsonContent.model || '@cf/black-forest-labs/flux-1-schnell',
              });
            }
          } catch {
            // Invalid JSON, skip this block
            console.warn('Invalid IMAGE_GEN JSON:', rawContent);
          }
        } else if (tagType === 'VISUALIZATION_EMBED') {
          // Parse visualization embed block
          blocks.push({
            type: 'visualization_embed',
            content: rawContent,
          });
        } else if (tagType === 'VISUALIZATION_FULL') {
          // Parse visualization full block
          blocks.push({
            type: 'visualization_full',
            content: rawContent,
          });
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last special tag
    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex).trim();
      if (textAfter) {
        blocks.push({
          type: 'text',
          content: textAfter,
        });
      }
    }

    // If no special tags found, check for markdown code blocks
    if (blocks.length === 0) {
      const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
      lastIndex = 0;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          blocks.push({
            type: 'text',
            content: content.substring(lastIndex, match.index),
          });
        }

        const language = match[1] || '';
        const code = match[2].trim();
        
        if (code) {
          blocks.push({
            type: 'code',
            content: code,
            language: language.toLowerCase(),
          });
        }

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < content.length) {
        blocks.push({
          type: 'text',
          content: content.substring(lastIndex),
        });
      }
    }

    // If still no blocks, return entire content as text
    if (blocks.length === 0 && content.trim()) {
      blocks.push({
        type: 'text',
        content: content,
      });
    }

    return blocks;
  },

  // Legacy function for backward compatibility
  parsePythonCodeBlocks(content: string): Array<{
    type: 'code' | 'text';
    content: string;
    language?: string;
    filename?: string;
  }> {
    const blocks = this.parseContentBlocks(content);
    return blocks.map(block => {
      if (block.type === 'python_exec') {
        return {
          type: 'code',
          content: block.content,
          language: 'python',
          filename: block.filename,
        };
      }
      return block as any;
    }).filter(b => b.type !== 'image_gen');
  },

  hasPythonExecCode(content: string): boolean {
    return /<PYTHON_EXEC>[\s\S]*?<\/PYTHON_EXEC>/.test(content);
  },

  hasImageGenCode(content: string): boolean {
    return /<IMAGE_GEN>[\s\S]*?<\/IMAGE_GEN>/.test(content);
  },
};
