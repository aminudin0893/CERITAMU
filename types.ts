export interface Scene {
  id: string;
  sceneNumber: number;
  description: string;
  dialogue?: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
}

export interface ScriptBreakdownResponse {
  scenes: {
    description: string;
    dialogue: string;
  }[];
}