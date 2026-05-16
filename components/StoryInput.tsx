import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';

interface StoryInputProps {
  onGenerate: (text: string) => void;
  isLoading: boolean;
}

const StoryInput: React.FC<StoryInputProps> = ({ onGenerate, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onGenerate(input);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 shadow-xl backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="story-input" className="text-sm font-medium text-zinc-300 uppercase tracking-wider">
          Story Concept / Script
        </label>
        <textarea
          id="story-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="E.g., A futuristic detective stands in the rain looking at a neon sign. He enters a crowded noodle bar and sits down next to a mysterious woman..."
          className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-lg p-4 text-zinc-200 placeholder-zinc-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
          disabled={isLoading}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`
              flex items-center px-6 py-3 rounded-lg font-semibold text-white transition-all
              ${!input.trim() || isLoading 
                ? 'bg-zinc-700 cursor-not-allowed opacity-50' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg hover:shadow-indigo-500/25'}
            `}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing Script...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 mr-2" />
                Generate Scenes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoryInput;