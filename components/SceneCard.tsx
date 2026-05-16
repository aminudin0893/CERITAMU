import React, { useState } from 'react';
import { ImageIcon, RefreshCw, Trash2, MessageSquare, Eye, Loader2 } from 'lucide-react';
import { Scene } from '../types';

interface SceneCardProps {
  scene: Scene;
  onGenerateImage: (id: string, description: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, field: keyof Scene, value: string) => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, onGenerateImage, onDelete, onUpdate }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-600 transition-all duration-300 shadow-lg flex flex-col group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Area */}
      <div className="relative aspect-video bg-zinc-950 w-full border-b border-zinc-800">
        {scene.isGeneratingImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-400 bg-zinc-950/80 backdrop-blur-sm z-10">
            <Loader2 className="w-10 h-10 animate-spin mb-2" />
            <span className="text-xs font-medium tracking-wider uppercase">Rendering Scene...</span>
          </div>
        ) : null}

        {scene.imageUrl ? (
          <img 
            src={scene.imageUrl} 
            alt={`Scene ${scene.sceneNumber}`} 
            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 p-8 text-center">
            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No visualization yet</p>
          </div>
        )}

        {/* Generate Button Overlay */}
        <div className={`absolute bottom-4 right-4 transition-opacity duration-200 ${isHovered || !scene.imageUrl ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => onGenerateImage(scene.id, scene.description)}
            disabled={scene.isGeneratingImage}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg backdrop-blur-md border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scene.imageUrl ? <RefreshCw className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span>{scene.imageUrl ? 'Regenerate' : 'Visualize'}</span>
          </button>
        </div>
        
        {/* Scene Number Badge */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-md border border-white/10">
          SCENE {scene.sceneNumber}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col gap-4 flex-grow">
        {/* Visual Description Input */}
        <div className="space-y-1">
          <label className="flex items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <Eye className="w-3 h-3 mr-1.5" /> Visual Action
          </label>
          <textarea
            value={scene.description}
            onChange={(e) => onUpdate(scene.id, 'description', e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md p-2.5 text-sm text-zinc-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none min-h-[80px]"
            placeholder="Describe the visual action..."
          />
        </div>

        {/* Dialogue Input */}
        <div className="space-y-1">
          <label className="flex items-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <MessageSquare className="w-3 h-3 mr-1.5" /> Audio / Dialogue
          </label>
          <textarea
            value={scene.dialogue}
            onChange={(e) => onUpdate(scene.id, 'dialogue', e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-md p-2.5 text-sm text-zinc-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none min-h-[60px]"
            placeholder="Dialogue or sound effects..."
          />
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-2 flex justify-between items-center border-t border-zinc-800/50">
           <span className="text-[10px] text-zinc-600">ID: {scene.id.split('-').pop()}</span>
           <button 
            onClick={() => onDelete(scene.id)}
            className="text-zinc-500 hover:text-red-400 p-1.5 rounded-md hover:bg-red-400/10 transition-colors"
            title="Delete Scene"
           >
             <Trash2 className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default SceneCard;