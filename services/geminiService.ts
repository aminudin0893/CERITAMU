import { GoogleGenAI, Modality } from "@google/genai";

// Initialize API Client
let currentApiKey = process.env.API_KEY || '';
let ai = new GoogleGenAI({ apiKey: currentApiKey });

export const setGeminiApiKey = (key: string) => {
    currentApiKey = key;
    ai = new GoogleGenAI({ apiKey: currentApiKey });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates text content (scripts, JSON data) using Gemini 3 Flash.
 * Used for generating Concepts and Shotlists.
 */
export const generateScriptContent = async (prompt: string): Promise<any> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        let text = response.text;
        if (!text) return null;

        // Robust JSON extraction
        // 1. Remove Markdown code blocks
        text = text.replace(/```json/gi, '').replace(/```/g, '');
        
        // 2. Find first valid bracket for Object or Array
        const firstOpenBrace = text.indexOf('{');
        const firstOpenBracket = text.indexOf('[');
        let startIndex = -1;
        
        if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
            startIndex = firstOpenBrace;
        } else if (firstOpenBracket !== -1) {
            startIndex = firstOpenBracket;
        }

        if (startIndex !== -1) {
            // Find the *last* valid closing bracket
            let endIndex = -1;
            // Iterate backwards to find the last closing char
            for (let i = text.length - 1; i >= startIndex; i--) {
                if (text[i] === '}' || text[i] === ']') {
                    endIndex = i;
                    break;
                }
            }
            
            if (endIndex !== -1 && endIndex >= startIndex) {
                text = text.substring(startIndex, endIndex + 1);
            }
        }

        // 3. Remove trailing commas
        text = text.replace(/,(\s*[}\]])/g, '$1');

        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("JSON Parse Error:", e, "\nOriginal Text:", text);
            return null;
        }
    } catch (error) {
        console.error("Gemini Script Gen Error:", error);
        return null; 
    }
};

/**
 * Generates an image using Gemini 2.5 Flash Image.
 * Supports text prompts and optional reference images.
 * Implements aggressive exponential backoff for 429 Rate Limit and 500 Internal errors.
 */
export const generateStoryboardImage = async (
  prompt: string,
  referenceImages: string[] = [],
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" = "16:9",
  retries = 3
): Promise<string | null> => {
  const parts: any[] = [{ text: prompt }];

  // Add reference images if provided (Limit to 3 to avoid payload issues)
  const safeRefImages = referenceImages.slice(0, 3);
  for (const ref of safeRefImages) {
    // Check if it's a data URI
    const match = ref.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      });
    }
  }

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        },
      });

      // Extract the image from the response
      const content = response.candidates?.[0]?.content;
      if (content?.parts) {
          for (const part of content.parts) {
              if (part.inlineData && part.inlineData.data) {
                  return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
              }
          }
      }
      // If success but no image, maybe filtered? Just return null.
      return null;

    } catch (error: any) {
      // Check for 429 Resource Exhausted / Rate Limit or 500 Internal Error
      const errString = JSON.stringify(error);
      const isRetryable = 
        errString.includes('429') || 
        errString.includes('RESOURCE_EXHAUSTED') || 
        errString.includes('Quota exceeded') ||
        errString.includes('500') ||
        errString.includes('Internal error') ||
        errString.includes('INTERNAL') ||
        error?.status === 429 || 
        error?.error?.code === 429 ||
        error?.status === 500 ||
        error?.error?.code === 500;
      
      if (isRetryable) {
        if (attempt < retries) {
            // Aggressive Backoff: 5s, 10s, 20s...
            const delay = Math.pow(2, attempt) * 5000; 
            console.warn(`Gemini Image Gen Error (${error?.status || 'Unknown'}). Retrying in ${delay/1000}s... (Attempt ${attempt + 1}/${retries})`);
            await sleep(delay);
            attempt++;
            continue;
        } else {
            console.error("Gemini Image Gen: Failed after max retries.", error);
            return null; // Return null gracefully so app doesn't crash
        }
      }
      
      console.error("Gemini Image Gen Error:", error);
      return null;
    }
  }
  return null;
};

/**
 * Edits an existing image based on a text prompt (Refine).
 * Implements aggressive exponential backoff for 429 Rate Limit and 500 Internal errors.
 */
export const editStoryboardImage = async (
  base64Image: string,
  prompt: string,
  aspectRatio: "1:1" | "3:4" | "4:3" | "16:9" | "9:16" = "16:9",
  retries = 3
): Promise<string | null> => {
    // Prepare parts: Image first, then text instruction
    const parts: any[] = [];
    
    const match = base64Image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (match) {
        parts.push({
            inlineData: {
                mimeType: match[1],
                data: match[2]
            }
        });
    } else {
        return null;
    }

    parts.push({ text: prompt });

    let attempt = 0;
    while (attempt <= retries) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts },
                config: {
                    imageConfig: { aspectRatio: aspectRatio }
                },
            });

            const content = response.candidates?.[0]?.content;
            if (content?.parts) {
                for (const part of content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                    }
                }
            }
            return null;
        } catch (error: any) {
            // Check for 429 Resource Exhausted / Rate Limit or 500 Internal Error
            const errString = JSON.stringify(error);
            const isRetryable = 
                errString.includes('429') || 
                errString.includes('RESOURCE_EXHAUSTED') || 
                errString.includes('Quota exceeded') ||
                errString.includes('500') ||
                errString.includes('Internal error') ||
                errString.includes('INTERNAL') ||
                error?.status === 429 || 
                error?.error?.code === 429 ||
                error?.status === 500 ||
                error?.error?.code === 500;
            
            if (isRetryable) {
                if (attempt < retries) {
                    const delay = Math.pow(2, attempt) * 5000; 
                    console.warn(`Gemini Edit Error (${error?.status || 'Unknown'}). Retrying in ${delay/1000}s... (Attempt ${attempt + 1}/${retries})`);
                    await sleep(delay);
                    attempt++;
                    continue;
                } else {
                    console.error("Gemini Image Edit: Failed after max retries.", error);
                    return null;
                }
            }
            console.error("Gemini Image Edit Error:", error);
            return null;
        }
    }
    return null;
};

/**
 * Generates speech (TTS) from text using Gemini 2.5 Flash TTS.
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    return null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};