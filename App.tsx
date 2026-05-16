import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, Palette, SaveAll, Dices, FolderOpen, Plus, Key, Eye, EyeOff,
  Sparkles, Loader2, FileText, Users, Wand2, Trash2, RefreshCw, 
  Download, Check, X, User, ArrowRight, Book, ImageIcon, Play, Pause, Music, Mic, Maximize2,
  RectangleVertical, RectangleHorizontal, Square, History, Pencil, Upload, ImagePlus, BookOpenText, ChevronLeft, ChevronRight, Volume2,
  Settings2, StopCircle, FileDown, RotateCcw
} from 'lucide-react';
import { generateScriptContent, generateStoryboardImage, generateSpeech, editStoryboardImage, setGeminiApiKey } from './services/geminiService';
import { jsPDF } from "jspdf";

// --- Types & Constants ---
const stylePresets: Record<string, string> = {
  "Watercolor (Buku Anak Klasik)": "soft watercolor style, children's book illustration, gentle colors, whimsical, hand-painted texture, white background",
  "3D Disney/Pixar Style": "3d render, cute character design, pixar style, bright lighting, high detail, expressive",
  "Ghibli Anime Style": "studio ghibli style, hand drawn anime, detailed background, vibrant colors, nostalgic",
  "Crayon & Pencil": "crayon and colored pencil drawing, textured, childlike, scribbly, on textured paper",
  "Vector Flat Art": "modern flat vector art, minimal, clean lines, bold colors, geometric shapes",
  "Comic Book / Graphic Novel": "comic book style, bold outlines, cel shaded, dynamic poses",
  "Paper Cutout (Craft)": "layered paper cutout art, craft style, depth of field, shadows, textured paper, whimsical",
  "Pixel Art (Retro Game)": "pixel art style, 8-bit, retro game aesthetic, blocky, vibrant colors",
  "Oil Painting (Artistik)": "oil painting style, textured brush strokes, artistic, rich colors, masterpiece"
};

// --- Audio Voices Configuration ---
const INDO_VOICES = [
    { id: 'budi', label: 'Budi (Pria Dewasa - Tenang)', geminiVoice: 'Zephyr', gender: 'Male', age: 'Adult' },
    { id: 'siti', label: 'Siti (Wanita Dewasa - Lembut)', geminiVoice: 'Kore', gender: 'Female', age: 'Adult' },
    { id: 'pak_raden', label: 'Pak Raden (Bapak - Berwibawa)', geminiVoice: 'Fenrir', gender: 'Male', age: 'Adult' },
    { id: 'ibu_ratu', label: 'Ibu Ratu (Wanita - Elegan)', geminiVoice: 'Kore', gender: 'Female', age: 'Adult' },
    { id: 'udin', label: 'Udin (Anak Laki - Ceria)', geminiVoice: 'Puck', gender: 'Male', age: 'Child' },
    { id: 'laras', label: 'Laras (Anak Perempuan - Manis)', geminiVoice: 'Kore', gender: 'Female', age: 'Child' }, 
    { id: 'raka', label: 'Raka (Remaja - Semangat)', geminiVoice: 'Zephyr', gender: 'Male', age: 'Teen' },
    { id: 'kakek_jati', label: 'Kakek Jati (Lansia - Berat)', geminiVoice: 'Charon', gender: 'Male', age: 'Old' },
    { id: 'mbah_dukun', label: 'Mbah Dukun (Misterius/Seram)', geminiVoice: 'Charon', gender: 'Male', age: 'Old' },
    { id: 'si_kancil', label: 'Si Kancil (Hewan/Jenaka)', geminiVoice: 'Puck', gender: 'Male', age: 'Child' },
];

const AUDIO_MOODS = [
    "Normal (Biasa)", "Ceria (Happy)", "Sedih (Sad)", "Tegang (Suspense)", "Berbisik (Whisper)", "Semangat (Excited)", "Mengantuk (Sleepy)", "Marah (Angry)"
];

const AUDIO_AGES = [
    "Anak-anak (Child)", "Remaja (Teen)", "Dewasa (Adult)", "Lansia (Elderly)"
];

const genresList = ["Fabel (Hewan)", "Petualangan", "Fantasi", "Edukasi/Sains", "Dongeng Klasik", "Kehidupan Sehari-hari", "Misteri Anak"];
const predefinedMoods = ["Ceria & Menyenangkan", "Tenang & Damai", "Tegang & Misterius", "Sedih & Haru", "Ajaib & Fantastis", "Lucu & Jenaka"];
const compositionTypes = [
  "Full Page Illustration", "Double Page Spread (Wide)", "Spot Illustration", "Vignette", "Close Up", "Action Scene"
];
const colorOptions = [
    { hex: '#3B82F6' }, // Blue
    { hex: '#EF4444' }, // Red
    { hex: '#10B981' }, // Green
    { hex: '#F59E0B' }, // Yellow
    { hex: '#8B5CF6' }, // Purple
    { hex: '#EC4899' }, // Pink
    { hex: '#6366F1' }, // Indigo
    { hex: '#F97316' }, // Orange
];

// --- Helper for WAV conversion ---
function pcmToWavBlob(base64Pcm: string, sampleRate: number = 24000): Blob {
    const binaryString = atob(base64Pcm);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const buffer = new ArrayBuffer(44 + len);
    const view = new DataView(buffer);
    
    // RIFF
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + len, true);
    writeString(view, 8, 'WAVE');
    // fmt
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    // data
    writeString(view, 36, 'data');
    view.setUint32(40, len, true);
    
    const wavBytes = new Uint8Array(buffer);
    wavBytes.set(bytes, 44);
    
    return new Blob([wavBytes], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// --- Main Component ---
const App: React.FC = () => {
  // UI State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [workflowStep, setWorkflowStep] = useState<'input' | 'concept_review' | 'pages_review' | 'audio_generation' | 'read'>('input');
  const [activeTab, setActiveTab] = useState<'concept' | 'pages' | 'read'>('concept');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingConceptImage, setIsGeneratingConceptImage] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showHeaderColorPicker, setShowHeaderColorPicker] = useState(false);
  const [activeRefineId, setActiveRefineId] = useState<number | null>(null);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isRefiningCover, setIsRefiningCover] = useState(false);
  const [bookPage, setBookPage] = useState(0); // 0 = Cover closed
  const [turnDirection, setTurnDirection] = useState<'next' | 'prev'>('next');
  const [isEditingMoral, setIsEditingMoral] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);

  // API Key State
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);

  // Data State
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    logline: '',
    pageCount: '8',
    mood: predefinedMoods[0],
    coreMessage: '',
    genres: [] as string[],
    characterList: [] as {id: number, name: string, desc: string}[],
    stylePreset: 'Watercolor (Buku Anak Klasik)',
    visualStyle: '',
    defaultAspectRatio: '16:9' as '1:1' | '16:9' | '3:4' | '4:3' | '9:16'
  });

  const [generatedData, setGeneratedData] = useState({
    concept: null as any,
    characterProfiles: [] as any[],
    locationProfiles: [] as any[],
    elementProfiles: [] as any[],
    pages: [] as any[],
    audio: {
        isGeneratingNarration: false,
        narrationAudio: null as string | null
    }
  });

  const [audioSettings, setAudioSettings] = useState({
      narrationText: '',
      characterId: 'siti', // Default to Siti (Kore)
      mood: 'Normal (Biasa)',
      age: 'Dewasa (Adult)'
  });
  
  // Audio Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const isPausedManualRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setGeminiApiKey(savedKey);
    }
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('gemini_api_key', tempApiKey);
    setGeminiApiKey(tempApiKey);
    setShowApiKeyModal(false);
  };

  // --- Input Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleGenre = (genre: string) => {
      setFormData(prev => {
          const genres = prev.genres.includes(genre) 
              ? prev.genres.filter(g => g !== genre)
              : [...prev.genres, genre];
          return { ...prev, genres };
      });
  };

  const addCharacterInput = () => {
      setFormData(prev => ({
          ...prev,
          characterList: [...prev.characterList, { id: Date.now(), name: '', desc: '' }]
      }));
  };

  const updateCharacterInput = (id: number, field: 'name' | 'desc', value: string) => {
      setFormData(prev => ({
          ...prev,
          characterList: prev.characterList.map(c => c.id === id ? { ...c, [field]: value } : c)
      }));
  };

  const removeCharacterInput = (id: number) => {
      setFormData(prev => ({
          ...prev,
          characterList: prev.characterList.filter(c => c.id !== id)
      }));
  };
  
  const handleRandomizeProject = async () => {
      setIsRandomizing(true);
      try {
           const prompt = `
            Role: Creative Children's Book Author.
            Task: Generate a UNIQUE, CREATIVE, and RANDOM children's story concept in INDONESIAN.
            Do not repeat generic stories. Be imaginative!
            
            Output JSON: {
                "title": "Creative Title",
                "logline": "Interesting short summary (1-2 sentences)",
                "mood": "Choose one: Ceria, Sedih, Tegang, Lucu, Ajaib, Misterius",
                "genre": "Choose one: Fabel, Petualangan, Fantasi, Edukasi, Misteri, Sci-Fi Anak",
                "characterName": "Main character name",
                "characterDesc": "Short visual description of main character",
                "moralMessage": "A short positive moral lesson"
            }
           `;
           
           const result = await generateScriptContent(prompt);
           
           if(result && result.title) {
                setFormData(prev => ({
                  ...prev,
                  title: result.title,
                  logline: result.logline,
                  pageCount: '8',
                  genres: [result.genre || "Petualangan"],
                  mood: result.mood || "Ceria & Menyenangkan",
                  coreMessage: result.moralMessage || "",
                  characterList: [{ id: Date.now(), name: result.characterName || "Tokoh", desc: result.characterDesc || "Deskripsi..." }]
              }));
           } else {
               throw new Error("AI Failed");
           }
      } catch(e) {
          // Static Fallback if AI fails
          const randomTitles = ["Petualangan Si Kancil Luar Angkasa", "Misteri Hutan Pelangi", "Robot Kecil yang Ingin Punya Hati"];
          const randomLoglines = ["Seekor kancil menemukan roket tua dan tidak sengaja meluncur ke bulan.", "Tiga sahabat mencari harta karun yang ternyata adalah resep kue nenek.", "Robot pembersih sampah menemukan bunga terakhir di bumi."];
          const idx = Math.floor(Math.random() * randomTitles.length);
          
          setFormData(prev => ({
              ...prev,
              title: randomTitles[idx],
              logline: randomLoglines[idx],
              pageCount: '8',
              genres: [genresList[Math.floor(Math.random() * genresList.length)]],
              mood: predefinedMoods[Math.floor(Math.random() * predefinedMoods.length)],
              characterList: [{ id: Date.now(), name: 'Tokoh Utama', desc: 'Kecil, lincah, berwarna cerah' }]
          }));
      } finally {
          setIsRandomizing(false);
      }
  };

  const handleSaveProject = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ formData, generatedData }));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `${formData.title.replace(/\s+/g, '_') || 'project'}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              if(data.formData) setFormData(data.formData);
              if(data.generatedData) setGeneratedData(data.generatedData);
              
              // Smart Workflow Restoration
              if (data.generatedData?.pages?.length > 0) {
                  setWorkflowStep('pages_review');
                  setActiveTab('pages');
              } else if (data.generatedData?.concept) {
                  setWorkflowStep('concept_review');
                  setActiveTab('concept');
              } else {
                  setWorkflowStep('input');
              }

          } catch(e) { alert("Error loading file"); }
      };
      reader.readAsText(file);
  };

  // --- Logic Handlers (Concept) ---
  const generateConcept = async () => {
      setIsGenerating(true);
      try {
          const chars = formData.characterList.map(c => `${c.name} (${c.desc})`).join('; ');
          const prompt = `
            Role: Professional Storybook Editor.
            Task: Create a detailed story concept.
            Language: INDONESIAN (Output).
            Input:
            Title: ${formData.title}
            Logline: ${formData.logline}
            Genre: ${formData.genres.join(', ')}
            Mood: ${formData.mood}
            Core Message: ${formData.coreMessage || "Generate a heartwarming moral lesson based on the story."}
            Characters Hint: ${chars}
            
            Output JSON format:
            {
                "title": "Final Polished Title",
                "blurb": "Back cover synopsis",
                "moralMessage": "A short, meaningful moral lesson found in the story",
                "plotOutline": ["Beginning...", "Inciting Incident...", "Rising Action...", "Climax...", "Resolution..."],
                "characters": [
                    { "name": "Name", "detailedDescription": "Visual description for illustrator..." }
                ]
            }
          `;
          
          const result = await generateScriptContent(prompt);
          if (result) {
              if (result.moralMessage && !formData.coreMessage) {
                  setFormData(prev => ({ ...prev, coreMessage: result.moralMessage }));
              } else if (result.moralMessage) {
                  setFormData(prev => ({ ...prev, coreMessage: result.moralMessage }));
              }

              setGeneratedData(prev => ({
                  ...prev,
                  concept: {
                      title: result.title || formData.title,
                      blurb: result.blurb || formData.logline,
                      plotOutline: result.plotOutline || []
                  },
                  characterProfiles: (result.characters || []).map((c: any, i: number) => ({
                      id: i + 1,
                      name: c.name,
                      detailedDescription: c.detailedDescription,
                      prompt: null,
                      imageUrl: null,
                      isGeneratingImage: false,
                      refImageUrls: [],
                      imageHistory: []
                  }))
              }));
              setWorkflowStep('concept_review');
              setActiveTab('concept');
          }
      } catch (e) {
          alert("Gagal membuat konsep cerita. Coba lagi.");
      }
      setIsGenerating(false);
  };

  const regenerateConceptImage = async () => {
    if (!generatedData.concept) return;
    setIsGeneratingConceptImage(true);
    try {
        const styleInstruction = formData.stylePreset === 'Custom' 
            ? "Custom Art Style" 
            : (stylePresets[formData.stylePreset] || stylePresets["Watercolor (Buku Anak Klasik)"]);
            
        const refImages: string[] = [];
        const charNames: string[] = [];

        generatedData.characterProfiles.forEach((char:any) => {
            if (char.imageUrl) {
                refImages.push(char.imageUrl);
                charNames.push(char.name);
            }
        });

        let charContext = "";
        if (charNames.length > 0) {
            charContext = `Featuring main characters: ${charNames.join(", ")}. Ensure character consistency with provided reference images.`;
        }

        const imagePrompt = `BOOK COVER ILLUSTRATION. Title: "${generatedData.concept.title}". Text: "Oleh: ${formData.author}". Style: ${styleInstruction}. ${formData.visualStyle}. ${charContext} High quality, detailed, visually appealing. The cover must explicitly display the title "${generatedData.concept.title}" and the text "Oleh: ${formData.author}" using typography that matches the illustration style.`;
        
        const imageUrl = await generateStoryboardImage(imagePrompt, refImages, formData.defaultAspectRatio);
        
        if (imageUrl) {
            setGeneratedData(prev => ({
                ...prev,
                concept: { 
                    ...prev.concept, 
                    imageUrl,
                    imageHistory: [imageUrl, ...(prev.concept.imageHistory || [])]
                }
            }));
        }
    } catch (error) {
        console.error(error);
    } finally {
        setIsGeneratingConceptImage(false);
    }
  };

  // Auto-generate cover if missing when entering Pages tab
  useEffect(() => {
    if (activeTab === 'pages' && generatedData.concept && !generatedData.concept.imageUrl && !isGeneratingConceptImage) {
        regenerateConceptImage();
    }
  }, [activeTab]);

  const handleRefineCover = async () => {
      if (!refinePrompt.trim()) return;
      if(!generatedData.concept.imageUrl) return;

      setIsGeneratingConceptImage(true);
      setIsRefiningCover(false);
      
      try {
        const newUrl = await editStoryboardImage(generatedData.concept.imageUrl, refinePrompt);
        if(newUrl) {
             setGeneratedData(prev => ({
                 ...prev, 
                 concept: { 
                     ...prev.concept, 
                     imageUrl: newUrl, 
                     imageHistory: [newUrl, ...(prev.concept.imageHistory || [])]
                }
            }));
        }
      } catch(e) { console.error(e); }
      setRefinePrompt("");
      setIsGeneratingConceptImage(false);
  };

  const handleGoToRead = () => {
      setWorkflowStep('read');
      setActiveTab('read');
      setBookPage(0); // Reset to cover
  };

  const handlePlotEdit = (index: number, val: string) => {
      setGeneratedData(prev => {
          const newPlot = [...prev.concept.plotOutline];
          newPlot[index] = val;
          return { ...prev, concept: { ...prev.concept, plotOutline: newPlot } };
      });
  };

  const removePlotPoint = (index: number) => {
      setGeneratedData(prev => ({
          ...prev,
          concept: { ...prev.concept, plotOutline: prev.concept.plotOutline.filter((_: any, i: number) => i !== index) }
      }));
  };

  const addPlotPoint = () => {
      setGeneratedData(prev => ({
          ...prev,
          concept: { ...prev.concept, plotOutline: [...prev.concept.plotOutline, ""] }
      }));
  };
  
  const generateCasting = async () => {
      setIsGenerating(true);
      const prompt = `
        Role: Visual Development Artist.
        Context: Children's Book "${formData.title}".
        Plot: ${generatedData.concept.plotOutline.join(' ')}
        Task: Create detailed character visual profiles.
        Output JSON: { "characters": [{ "name": "...", "detailedDescription": "..." }] }
      `;
      const result = await generateScriptContent(prompt);
      if(result && result.characters) {
          setGeneratedData(prev => ({
              ...prev,
              characterProfiles: result.characters.map((c: any, i: number) => ({
                  id: prev.characterProfiles.length + i + 1,
                  name: c.name,
                  detailedDescription: c.detailedDescription,
                  prompt: null,
                  imageUrl: null,
                  isGeneratingImage: false,
                  refImageUrls: [],
                  imageHistory: []
              }))
          }));
      }
      setIsGenerating(false);
  };

  const removeCastingItem = (id: number, type: string) => {
      if(type === 'character') {
          setGeneratedData(prev => ({
              ...prev,
              characterProfiles: prev.characterProfiles.filter(c => c.id !== id)
          }));
      }
  };
  
  const addCastingItem = (type: string) => {
       if(type === 'character') {
          setGeneratedData(prev => ({
              ...prev,
              characterProfiles: [...prev.characterProfiles, {
                  id: Date.now(),
                  name: "New Character",
                  detailedDescription: "Description...",
                  imageUrl: null,
                  isGeneratingImage: false,
                  refImageUrls: [],
                  imageHistory: []
              }]
          }));
      }
  };

  const handleRefineProfile = async (id: number, type: string) => {
      if (!refinePrompt.trim()) return;
      const listKey = 'characterProfiles';
      // @ts-ignore
      const item = generatedData[listKey].find(i => i.id === id);
      if(!item || !item.imageUrl) return;

      // @ts-ignore
      setGeneratedData(prev => ({...prev, [listKey]: prev[listKey].map(i => i.id === id ? { ...i, isGeneratingImage: true } : i)}));
      setActiveRefineId(null);
      
      try {
        const newUrl = await editStoryboardImage(item.imageUrl, refinePrompt);
        if(newUrl) {
             // @ts-ignore
             setGeneratedData(prev => ({...prev, [listKey]: prev[listKey].map(i => i.id === id ? { ...i, imageUrl: newUrl, isGeneratingImage: false } : i)}));
        }
      } catch(e) { console.error(e); }
      setRefinePrompt("");
      // @ts-ignore
      setGeneratedData(prev => ({...prev, [listKey]: prev[listKey].map(i => i.id === id ? { ...i, isGeneratingImage: false } : i)}));
  };

  const handleProfileEdit = (id: number, type: string, field: string, value: string) => {
      if(type === 'character') {
          setGeneratedData(prev => ({
              ...prev,
              characterProfiles: prev.characterProfiles.map(c => c.id === id ? { ...c, [field]: value } : c)
          }));
      }
  };

  const handleCharacterFileUpload = (e: React.ChangeEvent<HTMLInputElement>, charId: number, type: 'reference' | 'final') => {
        const file = e.target.files?.[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target?.result as string;
            
            setGeneratedData(prev => ({
                ...prev,
                characterProfiles: prev.characterProfiles.map(c => {
                    if (c.id !== charId) return c;
                    
                    if (type === 'reference') {
                        return { ...c, refImageUrls: [base64] }; // Store as single item array for simplicity
                    } else {
                        // For final, we replace current image and add to history
                        return { 
                            ...c, 
                            imageUrl: base64, 
                            imageHistory: [base64, ...(c.imageHistory || [])],
                            isGeneratingImage: false
                        };
                    }
                })
            }));
        };
        reader.readAsDataURL(file);
        // Reset input
        e.target.value = ''; 
  };
  
  const removeCharacterReference = (charId: number) => {
      setGeneratedData(prev => ({
          ...prev,
          characterProfiles: prev.characterProfiles.map(c => c.id === charId ? { ...c, refImageUrls: [] } : c)
      }));
  };

  // --- Provided Functions ---
  const generateImage = async (id: number, type: 'character' | 'location' | 'element') => {
    const listKey = type === 'character' ? 'characterProfiles' : type === 'location' ? 'locationProfiles' : 'elementProfiles';
    // @ts-ignore
    const item = generatedData[listKey].find(i => i.id === id);
    if (!item) return;

    let promptToUse = item.prompt;
    if (!promptToUse) {
        const styleInstruction = formData.stylePreset === 'Custom' 
            ? "Custom Style" 
            : (stylePresets[formData.stylePreset] || stylePresets["Watercolor (Buku Anak Klasik)"]);

        if(type === 'character') promptToUse = `Illustration Style: ${styleInstruction}. Character Design Sheet: ${item.name}. ${item.detailedDescription}. Full body shot, expressive, isolated on white background, consistent character design.`;
        if(type === 'location') promptToUse = `Illustration Style: ${styleInstruction}. Setting/Background Design: ${item.name}. ${item.detailedDescription}. Atmospheric, wide shot, detailed scenery, book background art.`;
        if(type === 'element') promptToUse = `Illustration Style: ${styleInstruction}. Key Item Illustration: ${item.name}. ${item.detailedDescription}. Isolated on white background, prop design.`;
    }

    if (!promptToUse) return;

    setGeneratedData(prev => ({
        ...prev, 
        // @ts-ignore
        [listKey]: prev[listKey].map(i => i.id === id ? { 
            ...i, 
            isGeneratingImage: true,
            prompt: promptToUse 
        } : i)
    }));
    
    try {
        let finalPrompt = `${promptToUse} NO TEXT, TEXTLESS. High quality illustration.`;
        const imageUrl = await generateStoryboardImage(finalPrompt, item.refImageUrls || [], "1:1");

        if (imageUrl) {
            setGeneratedData(prev => ({...prev, [listKey]: (prev as any)[listKey].map((i:any) => i.id === id ? { 
                ...i, 
                imageUrl: imageUrl,
                imageHistory: [imageUrl, ...(i.imageHistory || [])],
                isGeneratingImage: false 
            } : i)}));
        } else {
            throw new Error("Failed generation");
        }
    } catch (error) {
        setGeneratedData(prev => ({...prev, [listKey]: (prev as any)[listKey].map((i:any) => i.id === id ? { ...i, isGeneratingImage: false } : i)}));
    }
  };

  const generatePages = async () => {
    setIsGenerating(true);
    // @ts-ignore
    const pageCountVal = parseInt(formData.pageCount) || 8;

    const charactersContext = generatedData.characterProfiles.map(c => `- ID ${c.id}: ${c.name} (${c.detailedDescription})`).join('\n');
    const locationsContext = generatedData.locationProfiles.map(l => `- ID ${l.id}: ${l.name} (${l.detailedDescription})`).join('\n');
    const structureContext = generatedData.concept.plotOutline.join('\n');

    const prompt = `
    Role: Children's Book Author & Illustrator.
    Task: Write the full story and break it down into pages with illustration descriptions.
    OUTPUT: INDONESIAN for 'storyText' and 'illustrationDesc'.
    
    Story Context (Structure): ${structureContext}
    Target Pages: Approx ${pageCountVal} pages.
    
    Assets:
    ${charactersContext}
    ${locationsContext}
    
    Instructions:
    1. Write the story text (storyText) for each page. Keep it rhythmic and engaging.
    2. Describe the illustration (illustrationDesc) matching the text.
    3. Suggest a 'composition' (Full Page, Spot Art, Spread).
    
    Output Format (JSON):
    {
        "pages": [
            {
                "pageNumber": 1,
                "storyText": "Text to read...",
                "illustrationDesc": "Visual description...",
                "composition": "Full Page Illustration",
                "mood": "Cheerful",
                "characterIds": [1],
                "locationId": 1
            }
        ]
    }
    `;

    try {
        const result = await generateScriptContent(prompt);

        if (result && result.pages) {
            const processedPages = result.pages.map((p: any, idx: number) => ({
                id: idx + 1,
                pageNumber: p.pageNumber,
                storyText: p.storyText,
                illustrationDesc: p.illustrationDesc,
                composition: p.composition,
                mood: p.mood,
                prompt: null,
                isGeneratingPrompt: false,
                imageUrl: null,
                imageHistory: [],
                isGeneratingImage: false,
                aspectRatio: formData.defaultAspectRatio,
                characterRefIds: Array.isArray(p.characterIds) ? p.characterIds : [],
                locationRefId: p.locationId ? p.locationId.toString() : "",
                elementRefIds: []
            }));

            setGeneratedData(prev => ({ ...prev, pages: processedPages }));
            setWorkflowStep('pages_review');
            setActiveTab('pages');
        } else {
            console.error("API Error: Result or pages missing", result);
            alert("Gagal membuat halaman cerita. Format data tidak sesuai. Silakan coba lagi.");
        }
    } catch (e) {
        console.error("Generate Pages Error:", e);
        alert("Terjadi kesalahan saat membuat halaman.");
    } finally {
        setIsGenerating(false);
    }
  };

  const generatePagePrompt = async (pageId: number) => {
    setGeneratedData(prev => ({ ...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, isGeneratingPrompt: true } : p) }));

    try {
        const page = generatedData.pages.find(p => p.id === pageId);
        if (!page) return;
        
        const chars = generatedData.characterProfiles.filter(c => page.characterRefIds.includes(c.id)).map(c => c.name).join(', ');
        const loc = generatedData.locationProfiles.find(l => l.id.toString() === page.locationRefId)?.name || "Background";
        
        const styleInstruction = formData.stylePreset === 'Custom' 
            ? "Custom Style" 
            : (stylePresets[formData.stylePreset] || stylePresets["Watercolor (Buku Anak Klasik)"]);

        const promptForAI = `
        Role: Prompt Engineer for Illustration.
        Task: Create English Image Prompt.
        Input (Indonesian): ${page.illustrationDesc}.
        Context: Characters: ${chars}. Location: ${loc}. Mood: ${page.mood}.
        Style: ${styleInstruction}.
        Composition: ${page.composition}.
        
        Output JSON: {"imagePrompt": "Full English prompt..."}
        `;

        const result = await generateScriptContent(promptForAI);

        if (result && result.imagePrompt) {
            setGeneratedData(prev => ({ ...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, prompt: result.imagePrompt, isGeneratingPrompt: false } : p) }));
        } else {
             const fallbackPrompt = `Style: ${styleInstruction}. Illustration of ${chars} in ${loc}. Action: ${page.illustrationDesc}. Mood: ${page.mood}. Composition: ${page.composition}.`;
             setGeneratedData(prev => ({ ...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, prompt: fallbackPrompt, isGeneratingPrompt: false } : p) }));
        }
    } catch (e) {
        setGeneratedData(prev => ({ ...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, isGeneratingPrompt: false } : p) }));
    }
  };

  const generatePageImage = async (pageId: number) => {
    const page = generatedData.pages.find(p => p.id === pageId);
    if (!page || !page.prompt) return;
    setGeneratedData(prev => ({...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, isGeneratingImage: true } : p)}));

    try {
        const refImages: string[] = [];
        page.characterRefIds.forEach((cId: number) => {
            const char = generatedData.characterProfiles.find(c => c.id === cId);
            if (char?.imageUrl) refImages.push(char.imageUrl);
        });

        let promptText = `ILLUSTRATION: ${page.prompt}. NO TEXT, TEXTLESS.`;
        if (refImages.length > 0) promptText += ` Consistent character features from reference.`;

        const imageUrl = await generateStoryboardImage(promptText, refImages, page.aspectRatio);

        if (imageUrl) {
            setGeneratedData(prev => ({...prev, pages: prev.pages.map(p => p.id === pageId ? { 
                ...p, 
                imageUrl: imageUrl,
                imageHistory: [imageUrl, ...(p.imageHistory || [])],
                isGeneratingImage: false 
            } : p)}));
        } else {
            throw new Error("Failed");
        }
    } catch (error) {
        setGeneratedData(prev => ({...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, isGeneratingImage: false } : p)}));
    }
  };

  const handleRefinePage = async (pageId: number) => {
      if (!refinePrompt.trim()) return;
      const page = generatedData.pages.find(p => p.id === pageId);
      if(!page || !page.imageUrl) return;

      setGeneratedData(prev => ({...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, isGeneratingImage: true } : p)}));
      setActiveRefineId(null);
      
      try {
        const newUrl = await editStoryboardImage(page.imageUrl, refinePrompt);
        if(newUrl) {
             setGeneratedData(prev => ({...prev, pages: prev.pages.map(p => p.id === pageId ? { 
                 ...p, 
                 imageUrl: newUrl, 
                 imageHistory: [newUrl, ...(p.imageHistory || [])],
                 isGeneratingImage: false 
            } : p)}));
        }
      } catch(e) { console.error(e); }
      setRefinePrompt("");
      setGeneratedData(prev => ({...prev, pages: prev.pages.map(p => p.id === pageId ? { ...p, isGeneratingImage: false } : p)}));
  };

  const handleRestoreImage = (pageId: number, url: string) => {
      setGeneratedData(prev => ({
          ...prev,
          pages: prev.pages.map(p => p.id === pageId ? {
              ...p,
              imageUrl: url,
              // Note: We don't add to history here to avoid duplicates when just switching views, 
              // or we could behave like a stack. For now, simple switch is fine.
          } : p)
      }));
  };

  const handlePageEdit = (id: number, field: string, value: any) => {
      setGeneratedData(prev => ({
          ...prev,
          pages: prev.pages.map(p => p.id === id ? { ...p, [field]: value } : p)
      }));
  };

  const handleDeletePage = (id: number) => {
      if(confirm("Hapus halaman?")) {
          setGeneratedData(prev => ({
              ...prev,
              pages: prev.pages.filter(p => p.id !== id)
          }));
      }
  };

  const generateNarration = async () => {
    setGeneratedData(prev => ({ ...prev, audio: { ...prev.audio, isGeneratingNarration: true } }));
    try {
        const textToSay = audioSettings.narrationText || generatedData.pages.map(p => p.storyText).join(". \n\n");
        
        // Find mapped Gemini Voice
        const selectedChar = INDO_VOICES.find(v => v.id === audioSettings.characterId);
        const voiceName = selectedChar ? selectedChar.geminiVoice : 'Kore';

        const rawBase64Audio = await generateSpeech(textToSay, voiceName);

        if (rawBase64Audio) {
            const wavBlob = pcmToWavBlob(rawBase64Audio, 24000); 
            const wavUrl = URL.createObjectURL(wavBlob);
            setGeneratedData(prev => ({ ...prev, audio: { ...prev.audio, narrationAudio: wavUrl, isGeneratingNarration: false } }));
            // Clear current buffers when new audio is generated
            audioBufferRef.current = null;
            pausedAtRef.current = 0;
        }
    } catch (e) {
        alert("Gagal membuat narasi suara.");
        setGeneratedData(prev => ({ ...prev, audio: { ...prev.audio, isGeneratingNarration: false } }));
    }
  };

  const playNarration = async () => {
      if (!generatedData.audio.narrationAudio) return;
      
      // If already playing, this acts as Pause toggle
      if (isPlaying) {
          handlePauseAudio();
          return;
      }

      try {
          if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioContextRef.current;

          // Decode buffer if not exists
          let buffer = audioBufferRef.current;
          if (!buffer) {
              const response = await fetch(generatedData.audio.narrationAudio);
              const arrayBuffer = await response.arrayBuffer();
              buffer = await ctx.decodeAudioData(arrayBuffer);
              audioBufferRef.current = buffer;
          }

          if (buffer) {
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);

              // Start from where we paused (or 0 if stopped/new)
              const offset = pausedAtRef.current;
              source.start(0, offset);
              
              startedAtRef.current = ctx.currentTime - offset;
              audioSourceRef.current = source;
              isPausedManualRef.current = false;
              setIsPlaying(true);

              source.onended = () => {
                  if (!isPausedManualRef.current) {
                      setIsPlaying(false);
                      pausedAtRef.current = 0; // Reset if finished naturally
                  }
              };
          }
      } catch (e) {
          console.error("Playback error", e);
      }
  };
  
  const handlePauseAudio = () => {
      if (audioSourceRef.current && audioContextRef.current) {
          isPausedManualRef.current = true; // Signal that this is a manual pause
          const elapsed = audioContextRef.current.currentTime - startedAtRef.current;
          pausedAtRef.current = elapsed;
          try {
            audioSourceRef.current.stop();
          } catch(e) {}
          audioSourceRef.current = null;
      }
      setIsPlaying(false);
  };

  const handleStopAudio = () => {
      if (audioSourceRef.current) {
          isPausedManualRef.current = true; 
          try {
            audioSourceRef.current.stop();
          } catch(e) {}
          audioSourceRef.current = null;
      }
      pausedAtRef.current = 0; // Reset position to start
      setIsPlaying(false);
  };
  
  const handleStartOver = () => {
      if (confirm("Apakah Anda yakin ingin memulai dari awal? Semua perubahan yang belum disimpan akan hilang.")) {
          // Stop any audio playing
          handleStopAudio();
          
          setFormData({
            title: '',
            author: '',
            logline: '',
            pageCount: '8',
            mood: predefinedMoods[0],
            coreMessage: '',
            genres: [],
            characterList: [{id: Date.now(), name: '', desc: ''}],
            stylePreset: 'Watercolor (Buku Anak Klasik)',
            visualStyle: '',
            defaultAspectRatio: '16:9'
          });
          
          setGeneratedData({
            concept: null,
            characterProfiles: [],
            locationProfiles: [],
            elementProfiles: [],
            pages: [],
            audio: {
                isGeneratingNarration: false,
                narrationAudio: null
            }
          });
          
          // Reset UI States
          setWorkflowStep('input');
          setActiveTab('concept');
          setBookPage(0);
          setIsGenerating(false);
          setIsGeneratingConceptImage(false);
          setFullscreenImage(null);
          setShowHeaderColorPicker(false);
          setActiveRefineId(null);
          setRefinePrompt("");
          setIsEditingTitle(false);
          setIsRefiningCover(false);
          setIsEditingMoral(false);
          setIsGeneratingPDF(false);
      }
  };

  const handleDownloadPDF = () => {
    setIsGeneratingPDF(true);
    setTimeout(() => { // Timeout to allow state update to render loader if needed
        try {
            // Determine PDF format based strictly on aspect ratio (Paper size matches Cover)
            let pdfWidth = 210;
            let pdfHeight = 297; 
            let orientation: 'p' | 'l' = 'p';
            
            // Helper to calculate height based on width and desired ratio
            const getDims = (width: number, ratio: number) => ({ w: width, h: width / ratio });

            switch(formData.defaultAspectRatio) {
                case '1:1':
                    ({ w: pdfWidth, h: pdfHeight } = getDims(210, 1));
                    orientation = 'p';
                    break;
                case '16:9':
                    ({ w: pdfWidth, h: pdfHeight } = getDims(297, 16/9));
                    orientation = 'l';
                    break;
                case '9:16':
                    ({ w: pdfWidth, h: pdfHeight } = getDims(210, 9/16));
                    orientation = 'p';
                    break;
                case '4:3':
                    ({ w: pdfWidth, h: pdfHeight } = getDims(280, 4/3));
                    orientation = 'l';
                    break;
                case '3:4':
                    ({ w: pdfWidth, h: pdfHeight } = getDims(210, 3/4));
                    orientation = 'p';
                    break;
                default:
                    ({ w: pdfWidth, h: pdfHeight } = getDims(297, 16/9));
                    orientation = 'l';
            }

            const doc = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Helper to get RGB from Hex for PDF fill
            const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : { r: 0, g: 0, b: 0 };
            };
            
            const pColor = hexToRgb(primaryColor);

            // 1. Cover Page (Full Bleed)
            if (generatedData.concept.imageUrl) {
                doc.addImage(generatedData.concept.imageUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            } else {
                doc.setFillColor(pColor.r, pColor.g, pColor.b);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(30);
                doc.text(generatedData.concept.title, pageWidth / 2, pageHeight / 3, { align: 'center' });
                doc.setFontSize(16);
                doc.text(formData.author || "Created with AI Storybook", pageWidth / 2, pageHeight / 2, { align: 'center' });
            }

            // 2. Story Pages
            generatedData.pages.forEach((page, index) => {
                doc.addPage([pdfWidth, pdfHeight], orientation);
                
                // Layout: Image Top 75%, Text Bottom 25% (Inset Image)
                const margin = 10;
                const imageSlotHeight = pageHeight * 0.70;
                
                // White Background
                doc.setFillColor(255, 255, 255);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');

                if (page.imageUrl) {
                    // Scale image to fit within imageSlotHeight while keeping ratio
                    // Since page matches ratio, imgW will be smaller than pageWidth
                    const imgH = imageSlotHeight;
                    const imgW = imgH * (pageWidth / pageHeight); 
                    
                    const imgX = (pageWidth - imgW) / 2;
                    const imgY = margin;

                    doc.addImage(page.imageUrl, 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');
                } else {
                     doc.setFillColor(240, 240, 240);
                     doc.rect(margin, margin, pageWidth - (margin*2), imageSlotHeight, 'F');
                }

                // Text Area
                doc.setTextColor(20, 20, 20);
                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                
                const textY = margin + imageSlotHeight + 10;
                const textMaxWidth = pageWidth - (margin * 4); // More padding for text
                const textLines = doc.splitTextToSize(page.storyText, textMaxWidth);
                
                doc.text(textLines, pageWidth / 2, textY + 5, { align: 'center' });
                
                // Page Number
                doc.setFontSize(9);
                doc.setTextColor(150, 150, 150);
                doc.text(`${page.pageNumber}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            });

            // 3. Back Cover
            doc.addPage([pdfWidth, pdfHeight], orientation);
            doc.setFillColor(255, 255, 255); // White Plain Page
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            doc.setTextColor(20, 20, 20); // Black Text
            
            // Use formData.coreMessage which is editable
            if (formData.coreMessage) {
                doc.setFontSize(16);
                doc.setFont("helvetica", "italic");
                const moralLines = doc.splitTextToSize(`"${formData.coreMessage}"`, pageWidth * 0.7);
                doc.text(moralLines, pageWidth / 2, pageHeight / 2, { align: 'center' });
            } else {
                doc.setFontSize(16);
                doc.text("TAMAT", pageWidth / 2, pageHeight / 2, { align: 'center' });
            }

            doc.save(`${formData.title.replace(/\s+/g, '_')}_Storybook.pdf`);
        } catch (error) {
            console.error("PDF Generation Error", error);
            alert("Gagal membuat PDF. Pastikan semua gambar telah dimuat.");
        } finally {
            setIsGeneratingPDF(false);
        }
    }, 100);
  };

  // Book navigation helpers
  const totalBookPages = generatedData.pages.length + 2; // Cover + Back Cover + Pages
  const handleNextPage = () => {
      if (bookPage < generatedData.pages.length + 1) {
          setTurnDirection('next');
          setBookPage(prev => prev + 1);
      }
  };
  const handlePrevPage = () => {
      if (bookPage > 0) {
          setTurnDirection('prev');
          setBookPage(prev => prev - 1);
      }
  };

  const isInputMode = workflowStep === 'input' && !isGenerating;

  return (
    <div className={`flex flex-col h-screen font-sans overflow-hidden ${isDarkMode ? 'bg-[#18181B] text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;600&family=Patrick+Hand&display=swap');
        
        .font-hand { font-family: 'Patrick Hand', cursive; }
        .font-fredoka { font-family: 'Fredoka', sans-serif; }
        
        ::selection {
          background-color: ${primaryColor}40;
        }

        .text-accent { color: ${primaryColor} !important; }
        .bg-accent { background-color: ${primaryColor} !important; }
        .border-accent { border-color: ${primaryColor} !important; }
        
        .hover-bg-accent:hover { background-color: ${primaryColor} !important; color: white !important; }
        .hover-text-accent:hover { color: ${primaryColor} !important; }
        
        input:focus, select:focus, textarea:focus {
             border-color: ${primaryColor} !important;
             ring-color: ${primaryColor} !important;
        }

        @media print {
            @page { margin: 1cm; size: portrait; }
            body { -webkit-print-color-adjust: exact; }
        }

        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
            animation: fadeIn 0.5s ease-out forwards;
        }

        /* 3D Book Flip Animations */
        .perspective-book {
           perspective: 2000px;
        }

        .animate-book-flip-next {
           animation: bookFlipNext 0.6s ease-out forwards;
           transform-origin: left center;
        }

        .animate-book-flip-prev {
           animation: bookFlipPrev 0.6s ease-out forwards;
           transform-origin: left center;
        }

        @keyframes bookFlipNext {
            0% { 
                transform: rotateY(90deg); 
                opacity: 0.5;
                filter: brightness(0.7);
            }
            100% { 
                transform: rotateY(0deg); 
                opacity: 1; 
                filter: brightness(1);
            }
        }

        @keyframes bookFlipPrev {
            0% { 
                transform: rotateY(-90deg); 
                opacity: 0.5;
                filter: brightness(0.7);
            }
            100% { 
                transform: rotateY(0deg); 
                opacity: 1; 
                filter: brightness(1);
            }
        }
      `}</style>

      {/* API KEY MODAL */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl p-8 border ${isDarkMode ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-fredoka font-bold flex items-center gap-2">
                        <Key className="w-5 h-5 text-accent"/> Manual Gemini Key
                    </h3>
                    <button onClick={() => setShowApiKeyModal(false)} className="p-2 opacity-50 hover:opacity-100 hover:bg-black/5 rounded-full"><X className="w-5 h-5"/></button>
                </div>
                
                <p className="text-sm opacity-60 mb-6">Gunakan API Key Gemini Anda sendiri untuk menghindari kuota publik.</p>
                
                <div className="space-y-4">
                    <div className="relative">
                        <input 
                            type={showApiKey ? "text" : "password"} 
                            placeholder="Masukkan GEMINI_API_KEY..." 
                            value={tempApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                            className={`w-full p-4 pr-12 rounded-xl border outline-none focus:ring-2 focus:ring-accent transition-all ${isDarkMode ? 'bg-black/20 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-black'}`}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowApiKey(prev => !prev)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
                        >
                            {showApiKey ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                        </button>
                    </div>
                    
                    <button 
                        onClick={saveApiKey}
                        className="w-full py-4 rounded-xl bg-accent text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/20 hover:opacity-90 transition-all"
                    >
                        <Check className="w-5 h-5"/> Simpan API Key
                    </button>
                </div>
            </div>
        </div>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 backdrop-blur-md" onClick={() => setFullscreenImage(null)}>
            <div className="relative max-w-5xl max-h-full">
                <img src={fullscreenImage} className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded-xl" onClick={(e) => e.stopPropagation()} />
                <button className="absolute -top-4 -right-4 bg-white text-black p-2 rounded-full shadow-lg" onClick={() => setFullscreenImage(null)}><X className="w-6 h-6"/></button>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className={`transition-all duration-500 z-40 border-b print:hidden
          ${isInputMode ? 'hidden' : `block relative ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`}`}>
         <div className="w-full">
            <div className="max-w-7xl mx-auto w-full p-4 flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <BookOpen className="w-6 h-6 text-accent mr-2" />
                    <span className="font-fredoka font-bold text-lg tracking-wide hidden md:block">YOURAI <span className="text-accent">STORYBOOK</span></span>
                    
                    <div className="h-6 w-px bg-current opacity-20 mx-4"></div>

                    <div className="flex gap-1">
                        <button onClick={() => setActiveTab('concept')} className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${activeTab === 'concept' ? 'bg-accent text-white' : 'opacity-60 hover:opacity-100'}`}>KONSEP CERITA</button>
                        <button 
                            onClick={() => {
                                if (workflowStep === 'pages_review' || workflowStep === 'audio_generation' || workflowStep === 'read' || generatedData.pages.length > 0) {
                                    setActiveTab('pages');
                                    // Ensure workflowStep is not stuck in input if pages exist
                                    if (workflowStep === 'input') setWorkflowStep('pages_review');
                                }
                            }} 
                            disabled={(workflowStep === 'concept_review' || workflowStep === 'input') && generatedData.pages.length === 0} 
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all ${activeTab === 'pages' ? 'bg-accent text-white' : 'opacity-60 hover:opacity-100 disabled:opacity-30'}`}
                        >
                            MEMBUAT ILUSTRASI
                        </button>
                        <button 
                            onClick={() => {
                                if (workflowStep === 'read' || generatedData.pages.length > 0) {
                                    setActiveTab('read');
                                    // Force step update to ensure read mode is accessible
                                    setWorkflowStep('read');
                                }
                            }} 
                            disabled={workflowStep !== 'read' && generatedData.pages.length === 0} 
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all flex items-center gap-1 ${activeTab === 'read' ? 'bg-accent text-white' : 'opacity-60 hover:opacity-100 disabled:opacity-30'}`}
                        >
                            <BookOpenText className="w-3 h-3"/> MULAI BERCERITA
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setShowHeaderColorPicker(!showHeaderColorPicker)} className="w-8 h-8 rounded-full border border-current opacity-50 hover:opacity-100 transition-all flex items-center justify-center" style={{ backgroundColor: primaryColor }}><Palette className="w-4 h-4 text-white"/></button>
                    {showHeaderColorPicker && (
                         <div className={`absolute top-16 right-4 p-3 rounded-lg shadow-xl grid grid-cols-4 gap-2 z-50 w-48 ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`}>
                             {colorOptions.map((c) => (
                                 <button key={c.hex} onClick={() => { setPrimaryColor(c.hex); setShowHeaderColorPicker(false); }} className={`w-8 h-8 rounded-full border-2 ${primaryColor === c.hex ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c.hex }} />
                             ))}
                         </div>
                    )}
                    <button onClick={() => setShowApiKeyModal(true)} className="p-2 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition-all" title="Manual Gemini Key"><Key className="w-5 h-5"/></button>
                    <button onClick={handleSaveProject} className="p-2 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition-all" title="Simpan Project"><SaveAll className="w-5 h-5"/></button>
                    
                    {/* DOWNLOAD PDF BUTTON MOVED TO HEADER */}
                    {activeTab === 'read' && (
                        <button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide transition-all bg-accent text-white flex items-center gap-2 hover:opacity-90">
                            {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileDown className="w-4 h-4"/>}
                            Unduh PDF
                        </button>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* INPUT MODE */}
      {isInputMode && (
          <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? 'bg-[#09090B]' : 'bg-[#F8FAFC]'}`}>
            <div className="flex-1 flex items-center justify-center p-4 print:hidden overflow-hidden">
              <div className={`max-w-6xl w-full rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden h-[90vh] border ${isDarkMode ? 'bg-[#18181B] border-[#27272A]' : 'bg-white border-slate-200'}`}>
                  
                  <div className={`w-full md:w-1/3 p-8 flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-[#27272A]' : 'bg-slate-50'}`}>
                      <div className="absolute top-0 right-0 p-32 bg-accent opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                      <div className="relative z-10 flex flex-col h-full">
                          <div className="mb-6">
                              <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest border border-accent/20">YOURAI <span className="text-accent">STORYBOOK</span></span>
                          </div>
                          
                          <h1 className={`font-fredoka font-bold mb-6 leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              <span className="text-4xl md:text-5xl block">UBAH IDE</span>
                              <span className="text-4xl md:text-5xl text-accent block">JADI CERITA</span>
                          </h1>
                          
                          <p className={`text-sm leading-relaxed mb-8 text-lg ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                              Tulis ide cerita kreatifmu, AI akan bantu menyempurnakan naskahnya, serta membuat ilustrasi kreatifnya sesuai seleramu.
                              <br />
                              Mari berkarya bersama.
                          </p>

                          <div className="mt-auto space-y-4">
                                <button onClick={handleRandomizeProject} disabled={isRandomizing} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-[#3F3F46] hover:bg-[#52525B]' : 'bg-white border border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                                    {isRandomizing ? <Loader2 className="w-4 h-4 text-accent animate-spin"/> : <Dices className="w-4 h-4 text-accent"/>} 
                                    <span className="text-xs uppercase tracking-widest">{isRandomizing ? "Sedang Mencari Ide..." : "Ide Acak (Random)"}</span>
                                </button>
                                <button onClick={() => setShowApiKeyModal(true)} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-[#3F3F46] hover:bg-[#52525B]' : 'bg-white border border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                                    <Key className="w-4 h-4 text-accent"/> <span className="text-xs uppercase tracking-widest text-[10px]">Manual API Key</span>
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-[#3F3F46] hover:bg-[#52525B]' : 'bg-white border border-slate-200 hover:bg-slate-50 shadow-sm'}`}>
                                    <FolderOpen className="w-4 h-4 text-accent"/> <span className="text-xs uppercase tracking-widest">Buka Project</span>
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleLoadProject} className="hidden" accept=".json" />
                          </div>
                          
                          <div className="mt-6 flex gap-2 justify-center">
                              {colorOptions.slice(0,5).map((c) => (
                                  <button key={c.hex} onClick={() => setPrimaryColor(c.hex)} className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${primaryColor === c.hex ? 'ring-2 ring-offset-2 ring-offset-black ring-white' : ''}`} style={{ backgroundColor: c.hex }} />
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="w-full md:w-2/3 flex flex-col h-full p-8 md:p-10 overflow-y-auto">
                      <div className="space-y-6 max-w-2xl mx-auto w-full">
                          <div>
                              <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-1 block">Judul Buku</label>
                              <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full bg-transparent border-b-2 border-slate-200 focus:border-accent outline-none py-2 text-2xl font-fredoka font-bold placeholder-opacity-30" placeholder="Judul Cerita..." />
                          </div>
                          
                          <div>
                              <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Ide Cerita / Sinopsis</label>
                              <textarea name="logline" value={formData.logline} onChange={handleInputChange} rows={3} className={`w-full rounded-xl p-4 text-sm focus:ring-2 focus:ring-accent outline-none resize-none transition-all ${isDarkMode ? 'bg-[#27272A]' : 'bg-slate-50'}`} placeholder="Ceritakan ide dasarnya..." />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Jumlah Halaman</label>
                                  <select name="pageCount" value={formData.pageCount} onChange={handleInputChange} className={`w-full rounded-lg p-3 text-sm font-bold outline-none border ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`}>
                                      {[4, 8, 12, 16, 24, 32].map(n => <option key={n} value={n}>{n} Halaman</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Suasana (Mood)</label>
                                  <select name="mood" value={formData.mood} onChange={handleInputChange} className={`w-full rounded-lg p-3 text-sm font-bold outline-none border ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`}>
                                      {predefinedMoods.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                              </div>
                          </div>

                          <div>
                                <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Pesan Moral</label>
                                <input type="text" name="coreMessage" value={formData.coreMessage} onChange={handleInputChange} className={`w-full rounded-lg p-3 text-sm outline-none border ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`} placeholder="Apa yang dipelajari pembaca?" />
                           </div>

                          <div>
                              <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Genre</label>
                              <div className="flex flex-wrap gap-2">
                                  {genresList.map(g => (
                                      <button key={g} onClick={() => toggleGenre(g)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all ${formData.genres.includes(g) ? 'bg-accent text-white border-accent' : 'bg-transparent opacity-60 border-current hover:opacity-100'}`}>{g}</button>
                                  ))}
                              </div>
                          </div>

                          <div>
                              <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Karakter Utama</label>
                              <div className="space-y-2">
                                  {formData.characterList.map((char, idx) => (
                                      <div key={char.id} className={`flex gap-2 p-2 rounded-lg items-center ${isDarkMode ? 'bg-[#27272A]' : 'bg-slate-50'}`}>
                                          <div className="w-6 h-6 bg-accent/20 text-accent rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                          <input placeholder="Nama" value={char.name} onChange={(e) => updateCharacterInput(char.id, 'name', e.target.value)} className="bg-transparent text-sm font-bold w-1/3 outline-none" />
                                          <input placeholder="Ciri-ciri fisik..." value={char.desc} onChange={(e) => updateCharacterInput(char.id, 'desc', e.target.value)} className="bg-transparent text-sm flex-1 outline-none opacity-80" />
                                          <button onClick={() => removeCharacterInput(char.id)} className="text-red-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                                      </div>
                                  ))}
                                  <button onClick={addCharacterInput} className="text-xs font-bold text-accent flex items-center gap-1 hover:underline"><Plus className="w-3 h-3"/> Tambah Karakter</button>
                              </div>
                          </div>

                          <div>
                              <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Gaya Ilustrasi</label>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                  {Object.keys(stylePresets).map(s => (
                                      <button 
                                        key={s} 
                                        onClick={() => setFormData(prev => ({ ...prev, stylePreset: s }))} 
                                        className={`p-3 rounded-lg text-left text-[10px] md:text-xs font-bold border transition-all relative overflow-hidden group ${
                                            formData.stylePreset === s 
                                            ? 'bg-accent text-white border-accent shadow-md ring-1 ring-accent' 
                                            : isDarkMode 
                                                ? 'bg-[#27272A] border-[#3F3F46] hover:border-accent text-zinc-400 hover:text-white' 
                                                : 'bg-white border-slate-200 hover:border-accent text-slate-500 hover:text-slate-900'
                                        }`}
                                      >
                                          <span className="relative z-10">{s}</span>
                                          {formData.stylePreset === s && <div className="absolute top-0 right-0 p-1"><Check className="w-3 h-3"/></div>}
                                      </button>
                                  ))}
                                  <button 
                                    onClick={() => setFormData(prev => ({ ...prev, stylePreset: 'Custom' }))} 
                                    className={`p-3 rounded-lg text-left text-[10px] md:text-xs font-bold border transition-all relative overflow-hidden ${
                                        formData.stylePreset === 'Custom' 
                                        ? 'bg-accent text-white border-accent shadow-md ring-1 ring-accent' 
                                        : isDarkMode 
                                            ? 'bg-[#27272A] border-[#3F3F46] hover:border-accent text-zinc-400 hover:text-white' 
                                            : 'bg-white border-slate-200 hover:border-accent text-slate-500 hover:text-slate-900'
                                    }`}
                                  >
                                      Custom Style
                                  </button>
                              </div>

                              <textarea name="visualStyle" value={formData.visualStyle} onChange={handleInputChange} rows={2} className={`w-full rounded-lg p-3 text-xs outline-none border resize-none ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`} placeholder="Detail gaya visual tambahan (opsional)..." />
                          </div>

                          <button onClick={generateConcept} disabled={isGenerating} className="w-full py-4 rounded-xl bg-accent text-white font-bold text-lg shadow-lg hover:shadow-accent/50 hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5" />}
                              Mulai Membuat Buku
                          </button>
                      </div>
                  </div>
              </div>
            </div>
            {/* Input Mode Footer */}
            <div className="w-full py-3 text-center text-white text-[10px] font-bold uppercase tracking-widest z-50 shadow-lg print:hidden shrink-0" style={{ backgroundColor: primaryColor }}>
                APLIKASI INI DIBUAT OLEH AIGENSEE ©2025
            </div>
          </div>
      )}

      {/* MAIN APP CONTENT */}
      <div className={`flex-1 overflow-hidden relative flex flex-col print:hidden ${isDarkMode ? 'bg-[#18181B]' : 'bg-slate-50'}`}>
        
        {isGenerating && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
             <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce-small">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <h3 className="text-black font-fredoka font-bold text-xl">Sedang Berimajinasi...</h3>
                <p className="text-slate-500 text-sm mt-2">Menulis cerita & menyiapkan kuas.</p>
             </div>
          </div>
        )}

        {generatedData.concept && !isInputMode && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-64">
                    
                    {/* TAB 1: PLOT & CHARACTERS (Concept) */}
                    {activeTab === 'concept' && (
                        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
                            
                            {/* Header / Title Section */}
                            <div className="text-center space-y-2 mb-8">
                                {isEditingTitle ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <input
                                            autoFocus
                                            value={generatedData.concept.title}
                                            onChange={(e) => setGeneratedData(prev => ({...prev, concept: {...prev.concept, title: e.target.value}}))}
                                            onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                                            onBlur={() => setIsEditingTitle(false)}
                                            className={`text-3xl md:text-5xl font-fredoka font-bold text-center bg-transparent border-b-2 outline-none w-full max-w-2xl px-2 ${isDarkMode ? 'border-white text-white' : 'border-slate-900 text-slate-900'}`}
                                        />
                                        <button
                                            onClick={() => setIsEditingTitle(false)}
                                            className="p-2 bg-accent text-white rounded-full hover:scale-110 transition-transform"
                                        >
                                            <Check className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-3 group relative cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                                         <h2 className="text-4xl md:text-5xl font-fredoka font-bold leading-tight border-b-2 border-transparent hover:border-accent/20 transition-all">
                                            {generatedData.concept.title}
                                        </h2>
                                        <button
                                            className={`p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all ${isDarkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-black/5 text-slate-400'}`}
                                        >
                                            <Pencil className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                                
                                <div className="flex justify-center gap-2 mt-4">
                                    <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-bold uppercase">{formData.genres[0]}</span>
                                    <span className="px-3 py-1 bg-slate-500/10 text-slate-500 rounded-full text-xs font-bold uppercase">{formData.pageCount} Halaman</span>
                                </div>
                            </div>

                            {/* Plot Structure - EDITABLE */}
                            <div className={`rounded-3xl p-8 shadow-xl ${isDarkMode ? 'bg-[#27272A]' : 'bg-white'}`}>
                                <h3 className="text-xl font-bold font-fredoka mb-6 flex items-center gap-2"><FileText className="w-5 h-5 text-accent"/> Struktur Cerita (Plot Outline)</h3>
                                <div className="space-y-4">
                                    {generatedData.concept.plotOutline.map((part: string, i: number) => (
                                        <div key={i} className="flex gap-4 items-start group relative">
                                            <div className="w-8 h-8 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0 mt-1">{i+1}</div>
                                            <textarea 
                                                value={part}
                                                onChange={(e) => handlePlotEdit(i, e.target.value)}
                                                className={`w-full p-3 rounded-lg border bg-transparent resize-y min-h-[80px] text-sm leading-relaxed outline-none focus:border-accent transition-all ${isDarkMode ? 'border-white/10 focus:bg-white/5' : 'border-slate-200 focus:bg-slate-50'}`}
                                                placeholder={`Bagian cerita ${i+1}...`}
                                            />
                                            {/* Delete Plot Button */}
                                            <button 
                                                onClick={() => removePlotPoint(i)}
                                                className="absolute -right-3 -top-3 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-md"
                                                title="Hapus bagian ini"
                                            >
                                                <X className="w-3 h-3"/>
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {/* Add Plot Button */}
                                    <button 
                                        onClick={addPlotPoint}
                                        className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${isDarkMode ? 'border-white/10 hover:border-accent hover:text-accent' : 'border-slate-200 hover:border-accent hover:text-accent'}`}
                                    >
                                        <Plus className="w-4 h-4"/> Tambah Bagian Cerita
                                    </button>
                                </div>
                            </div>
                            
                            {/* Moral Message Section (Redesigned) */}
                            <div className={`rounded-3xl p-8 shadow-xl ${isDarkMode ? 'bg-[#27272A]' : 'bg-white'}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold font-fredoka flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-accent"/> Pesan Moral
                                    </h3>
                                    <button
                                        onClick={() => setIsEditingMoral(!isEditingMoral)}
                                        className={`p-2 rounded-full transition-all ${isEditingMoral ? 'bg-accent text-white' : 'hover:bg-black/5 text-slate-400'}`}
                                    >
                                        {isEditingMoral ? <Check className="w-4 h-4"/> : <Pencil className="w-4 h-4"/>}
                                    </button>
                                </div>
                                <div className={`p-1 rounded-xl transition-all ${isEditingMoral ? 'ring-2 ring-accent' : ''}`}>
                                     <textarea
                                        name="coreMessage"
                                        value={formData.coreMessage}
                                        onChange={handleInputChange}
                                        disabled={!isEditingMoral}
                                        rows={3}
                                        className={`w-full p-4 rounded-xl outline-none font-medium text-lg text-center resize-none transition-all
                                            ${!isEditingMoral ? 'bg-accent text-white border-transparent' : (isDarkMode ? 'bg-black/20 text-white' : 'bg-slate-50 text-slate-900')}
                                        `}
                                        placeholder="Apa yang dipelajari pembaca?"
                                     />
                                </div>
                            </div>

                            {/* Character Section (Moved here) */}
                            <div className="pt-8 border-t border-dashed border-current border-opacity-20">
                                <div className="flex justify-between items-end mb-6">
                                     <h3 className="text-xl font-bold font-fredoka flex items-center gap-2"><Users className="w-5 h-5 text-accent"/> Tokoh Cerita (Characters)</h3>
                                </div>

                                {generatedData.characterProfiles.length === 0 ? (
                                    <div className={`p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center ${isDarkMode ? 'border-[#3F3F46]' : 'border-slate-200'}`}>
                                        <Users className="w-12 h-12 mb-4 opacity-20"/>
                                        <p className="opacity-60 mb-4 max-w-md">Karakter belum dibuat. Klik tombol di bawah untuk mendesain penampilan karakter secara otomatis berdasarkan cerita.</p>
                                        <button onClick={generateCasting} className="bg-accent text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 hover:opacity-90 transition-all">
                                            <Wand2 className="w-4 h-4"/> Generate Karakter
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                                        {generatedData.characterProfiles.map((item) => {
                                            const isRefining = activeRefineId === item.id;
                                            const hasRefImage = item.refImageUrls && item.refImageUrls.length > 0;

                                            return (
                                            <div key={item.id} className={`rounded-2xl overflow-hidden shadow-lg border relative group flex flex-col ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-100'}`}>
                                                {/* Card Header with Delete */}
                                                <div className={`p-3 border-b flex justify-between items-center ${isDarkMode ? 'bg-black/10 border-[#3F3F46]' : 'bg-slate-50 border-slate-100'}`}>
                                                     <input 
                                                        value={item.name}
                                                        onChange={(e) => handleProfileEdit(item.id, 'character', 'name', e.target.value)}
                                                        className="font-bold text-sm bg-transparent outline-none w-full border-b border-transparent focus:border-accent/50 mr-2"
                                                        placeholder="Nama Tokoh"
                                                     />
                                                     <button onClick={() => removeCastingItem(item.id, 'character')} className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all" title="Hapus Karakter">
                                                         <Trash2 className="w-3.5 h-3.5"/>
                                                     </button>
                                                </div>

                                                <div className="aspect-square bg-slate-100 relative overflow-hidden group">
                                                    {item.imageUrl ? (
                                                        <>
                                                        <img src={item.imageUrl} className={`w-full h-full object-cover cursor-pointer transition-all ${item.isGeneratingImage ? 'blur-sm scale-105' : ''}`} onClick={() => setFullscreenImage(item.imageUrl)} />
                                                        
                                                        {/* Loading Overlay for Regeneration/Refine */}
                                                        {item.isGeneratingImage && (
                                                             <div className="absolute inset-0 bg-black/50 z-20 flex flex-col items-center justify-center backdrop-blur-[2px] animate-fadeIn">
                                                                 <div className="bg-white/10 p-3 rounded-full backdrop-blur-md mb-2">
                                                                     <Loader2 className="w-6 h-6 animate-spin text-white"/>
                                                                 </div>
                                                                 <span className="text-white text-xs font-bold tracking-wider shadow-sm">Memperbarui...</span>
                                                             </div>
                                                        )}

                                                        {!isRefining && !item.isGeneratingImage && (
                                                            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                                                                <button onClick={() => { setActiveRefineId(item.id); setRefinePrompt(""); }} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg" title="Refine / Edit"><Sparkles className="w-4 h-4"/></button>
                                                                <button onClick={() => generateImage(item.id, 'character')} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg" title="Regenerate"><RefreshCw className="w-4 h-4"/></button>
                                                                <label htmlFor={`upload-final-${item.id}`} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg cursor-pointer" title="Ganti dengan Upload"><Upload className="w-4 h-4"/></label>
                                                                <a href={item.imageUrl} download={`character-${item.name}.png`} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg" title="Download"><Download className="w-4 h-4"/></a>
                                                            </div>
                                                        )}
                                                        </>
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 relative overflow-hidden p-6 text-center">
                                                            {item.isGeneratingImage ? (
                                                                 <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center">
                                                                     <Loader2 className="w-8 h-8 animate-spin text-accent mb-2"/>
                                                                     <span className="text-xs font-bold text-accent animate-pulse">Sedang Menggambar...</span>
                                                                 </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-3">
                                                                    <User className="w-12 h-12 text-slate-300"/>
                                                                    
                                                                    {hasRefImage && (
                                                                        <div className="relative mb-1">
                                                                            <img src={item.refImageUrls[0]} className="w-16 h-16 object-cover rounded-lg border-2 border-accent shadow-md" />
                                                                            <button 
                                                                                onClick={() => removeCharacterReference(item.id)}
                                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm hover:scale-110"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                            <span className="text-[9px] font-bold text-accent block mt-1">Menggunakan Referensi</span>
                                                                        </div>
                                                                    )}

                                                                    <button 
                                                                        onClick={() => generateImage(item.id, 'character')} 
                                                                        className="bg-accent text-white font-bold py-2 px-6 rounded-full text-xs shadow-lg hover:scale-105 hover:shadow-accent/30 transition-all flex items-center gap-2"
                                                                    >
                                                                        <Wand2 className="w-3.5 h-3.5"/> BUAT TOKOH
                                                                    </button>

                                                                    <div className="flex gap-2 mt-2">
                                                                        <label htmlFor={`upload-ref-${item.id}`} className="text-[10px] font-bold text-slate-400 border border-slate-300 rounded-lg px-2 py-1 flex items-center gap-1 cursor-pointer hover:bg-slate-200 hover:text-slate-600 transition-all">
                                                                            <ImagePlus className="w-3 h-3"/> Ref
                                                                        </label>
                                                                        <label htmlFor={`upload-final-${item.id}`} className="text-[10px] font-bold text-slate-400 border border-slate-300 rounded-lg px-2 py-1 flex items-center gap-1 cursor-pointer hover:bg-slate-200 hover:text-slate-600 transition-all">
                                                                            <Upload className="w-3 h-3"/> Upload Jadi
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Hidden Inputs for File Upload */}
                                                    <input 
                                                        type="file" 
                                                        id={`upload-ref-${item.id}`} 
                                                        className="hidden" 
                                                        accept="image/*" 
                                                        onChange={(e) => handleCharacterFileUpload(e, item.id, 'reference')}
                                                    />
                                                    <input 
                                                        type="file" 
                                                        id={`upload-final-${item.id}`} 
                                                        className="hidden" 
                                                        accept="image/*" 
                                                        onChange={(e) => handleCharacterFileUpload(e, item.id, 'final')}
                                                    />

                                                    {/* Refine Overlay */}
                                                    {isRefining && (
                                                        <div className="absolute inset-x-0 bottom-0 p-4 bg-black/80 backdrop-blur-md z-20 animate-fadeIn">
                                                            <div className="flex flex-col gap-2">
                                                                <label className="text-xs font-bold text-white uppercase flex items-center gap-2"><Sparkles className="w-3 h-3 text-accent"/> Refine</label>
                                                                <div className="flex gap-2">
                                                                    <input 
                                                                        autoFocus
                                                                        placeholder="Edit..." 
                                                                        value={refinePrompt}
                                                                        onChange={(e) => setRefinePrompt(e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && handleRefineProfile(item.id, 'character')}
                                                                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-accent"
                                                                    />
                                                                    <button onClick={() => handleRefineProfile(item.id, 'character')} className="bg-accent text-white px-2 py-1 rounded-lg font-bold text-xs"><Check className="w-3 h-3"/></button>
                                                                    <button onClick={() => setActiveRefineId(null)} className="bg-white/10 text-white px-2 py-1 rounded-lg font-bold text-xs"><X className="w-3 h-3"/></button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4 flex flex-col flex-1">
                                                    {/* Editable Description */}
                                                    <textarea 
                                                        value={item.detailedDescription}
                                                        onChange={(e) => handleProfileEdit(item.id, 'character', 'detailedDescription', e.target.value)}
                                                        className={`w-full text-xs p-2 rounded border outline-none resize-none h-24 ${isDarkMode ? 'bg-[#18181B] border-[#3F3F46]' : 'bg-slate-50 border-slate-200'}`}
                                                        placeholder="Deskripsi visual karakter..."
                                                    />
                                                </div>
                                            </div>
                                            );
                                        })}
                                        <button onClick={() => addCastingItem('character')} className={`rounded-2xl border-2 border-dashed flex items-center justify-center h-[300px] hover:border-accent hover:text-accent transition-all ${isDarkMode ? 'border-[#3F3F46]' : 'border-slate-200'}`}>
                                            <div className="text-center">
                                                <Plus className="w-8 h-8 mx-auto mb-2"/>
                                                <span className="font-bold text-sm">Tambah Karakter</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* Combined Format & Author Section */}
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                                {/* Format Ilustrasi */}
                                <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`}>
                                    <h3 className="text-xs font-bold uppercase opacity-50 tracking-wider mb-4 text-center">Format Ilustrasi</h3>
                                    <div className="flex justify-center gap-4">
                                        <button 
                                            onClick={() => setFormData(prev => ({ ...prev, defaultAspectRatio: '3:4' }))} 
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${formData.defaultAspectRatio === '3:4' ? 'bg-accent/10 border-accent text-accent' : 'border-transparent hover:bg-black/5'}`}
                                        >
                                            <RectangleVertical className="w-5 h-6" />
                                            <span className="text-[9px] font-bold">Portrait</span>
                                        </button>
                                        <button 
                                            onClick={() => setFormData(prev => ({ ...prev, defaultAspectRatio: '1:1' }))} 
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${formData.defaultAspectRatio === '1:1' ? 'bg-accent/10 border-accent text-accent' : 'border-transparent hover:bg-black/5'}`}
                                        >
                                            <Square className="w-6 h-6" />
                                            <span className="text-[9px] font-bold">Square</span>
                                        </button>
                                        <button 
                                            onClick={() => setFormData(prev => ({ ...prev, defaultAspectRatio: '16:9' }))} 
                                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${formData.defaultAspectRatio === '16:9' ? 'bg-accent/10 border-accent text-accent' : 'border-transparent hover:bg-black/5'}`}
                                        >
                                            <RectangleHorizontal className="w-8 h-5" />
                                            <span className="text-[9px] font-bold">Landscape</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Author Section */}
                                <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`}>
                                    <span className="text-xs opacity-50 font-bold uppercase tracking-widest mb-4">Penulis Cerita</span>
                                    <div className="relative w-full">
                                        <input
                                            type="text"
                                            name="author"
                                            value={formData.author}
                                            onChange={handleInputChange}
                                            className={`w-full text-center py-3 px-6 rounded-xl font-fredoka font-bold text-lg outline-none border-2 transition-all placeholder-opacity-30 ${isDarkMode ? 'text-white placeholder-white' : 'text-slate-900 placeholder-slate-900'}`}
                                            style={{ 
                                                backgroundColor: `${primaryColor}10`, 
                                                borderColor: `${primaryColor}30` 
                                            }}
                                            placeholder="Nama Penulis..."
                                        />
                                        <Pencil className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* CONTINUE BUTTON */}
                            <div className="mt-12 mb-24">
                                <button 
                                    onClick={generatePages} 
                                    disabled={isGenerating} 
                                    className="w-full py-5 rounded-2xl bg-accent text-white font-fredoka font-bold text-xl shadow-xl shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin"/>
                                            <span>Sedang Menyusun Halaman...</span>
                                        </>
                                    ) : (
                                        <>
                                            <BookOpen className="w-6 h-6" />
                                            <span>Lanjut Buat Ilustrasi</span>
                                            <ArrowRight className="w-6 h-6 opacity-60" />
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-xs opacity-40 mt-4 font-bold uppercase tracking-widest">Langkah selanjutnya: AI akan memecah cerita menjadi halaman & ilustrasi</p>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: PAGES */}
                    {activeTab === 'pages' && (
                        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-64 px-4">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold font-fredoka">Halaman Buku <span className="text-accent opacity-50">({generatedData.pages.length} Halaman)</span></h2>
                            </div>

                            {/* Moved Cover Art Section Here - UPDATED LAYOUT */}
                            <div 
                                className={`rounded-3xl p-8 shadow-xl flex flex-col items-center text-center mb-12 border transition-colors duration-500`}
                                style={{ 
                                    backgroundColor: `${primaryColor}${isDarkMode ? '1A' : '15'}`, // Hex opacity: 1A=10%, 15=~8%
                                    borderColor: `${primaryColor}30`
                                }}
                            >
                                
                                <h3 className="text-sm font-bold uppercase opacity-50 tracking-wider mb-6">Cover Art</h3>
                                
                                {/* Large Centered Cover */}
                                <div className={`w-full max-w-7xl mx-auto shadow-2xl rounded-xl relative group`}>
                                     <div className={`${formData.defaultAspectRatio === '16:9' ? 'aspect-video' : formData.defaultAspectRatio === '3:4' ? 'aspect-[3/4]' : formData.defaultAspectRatio === '4:3' ? 'aspect-[4/3]' : formData.defaultAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'} rounded-xl overflow-hidden border-4 border-white/10 relative bg-slate-200`}>
                                         {generatedData.concept.imageUrl ? (
                                             <img src={generatedData.concept.imageUrl} className="w-full h-full object-cover" onClick={() => setFullscreenImage(generatedData.concept.imageUrl)} />
                                         ) : (
                                             <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                                                 <ImageIcon className="w-12 h-12"/>
                                                 <span className="text-sm">Belum ada cover</span>
                                             </div>
                                         )}
                                         
                                         {/* Loading Overlay */}
                                         {isGeneratingConceptImage && (
                                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                                                 <Loader2 className="w-10 h-10 animate-spin text-accent mb-2"/>
                                                 <span className="text-xs font-bold uppercase tracking-widest">Menggambar Cover...</span>
                                            </div>
                                         )}

                                         {/* Controls Overlay (Top Right) */}
                                         {!isRefiningCover && !isGeneratingConceptImage && generatedData.concept.imageUrl && (
                                             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                                                 <button onClick={() => setFullscreenImage(generatedData.concept.imageUrl)} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg"><Maximize2 className="w-4 h-4"/></button>
                                                 <button onClick={() => { setIsRefiningCover(true); setRefinePrompt(""); }} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg" title="Refine / Edit"><Sparkles className="w-4 h-4"/></button>
                                                 <button onClick={regenerateConceptImage} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg" title="Regenerate"><RefreshCw className="w-4 h-4"/></button>
                                                 <a href={generatedData.concept.imageUrl} download={`cover-${formData.title}.png`} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur shadow-lg" title="Download"><Download className="w-4 h-4"/></a>
                                             </div>
                                         )}

                                         {/* Big Generate Button (Only if no image) */}
                                         {!isGeneratingConceptImage && !generatedData.concept.imageUrl && (
                                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                                 <button onClick={regenerateConceptImage} className="bg-white text-black font-bold py-2 px-6 rounded-full flex items-center gap-2 hover:scale-105 transition-all">
                                                     <RefreshCw className="w-4 h-4"/> Buat Cover
                                                 </button>
                                             </div>
                                         )}

                                         {/* Refine Input Overlay */}
                                         {isRefiningCover && (
                                            <div className="absolute inset-x-0 bottom-0 p-4 bg-black/90 backdrop-blur-md z-30 animate-fadeIn border-t border-white/10">
                                                <div className="flex flex-col gap-2 max-w-2xl mx-auto">
                                                    <label className="text-xs font-bold text-white uppercase flex items-center gap-2"><Sparkles className="w-3 h-3 text-accent"/> Refine Cover Image</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            autoFocus
                                                            placeholder="Contoh: Tambahkan bintang, ubah warna langit..." 
                                                            value={refinePrompt}
                                                            onChange={(e) => setRefinePrompt(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleRefineCover()}
                                                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                                                        />
                                                        <button onClick={handleRefineCover} className="bg-accent text-white px-3 py-2 rounded-lg font-bold text-xs hover:bg-opacity-80"><Check className="w-4 h-4"/></button>
                                                        <button onClick={() => setIsRefiningCover(false)} className="bg-white/10 text-white px-3 py-2 rounded-lg font-bold text-xs hover:bg-white/20"><X className="w-4 h-4"/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                     </div>
                                </div>
                                
                                {/* Narration / Blurb Below Cover */}
                                <div className="mt-8 max-w-3xl mx-auto">
                                     <h2 className="text-4xl font-bold font-fredoka mb-2">{generatedData.concept.title}</h2>
                                     {formData.author && (
                                         <p className="text-xl font-hand font-bold opacity-60 mb-6">Oleh: {formData.author}</p>
                                     )}
                                     <p className="text-lg opacity-80 leading-relaxed">{generatedData.concept.blurb}</p>
                                </div>
                            </div>

                            {generatedData.pages.length === 0 ? (
                                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                                    <FileText className="w-16 h-16 mb-4"/>
                                    <p className="text-xl font-bold">Belum ada halaman.</p>
                                    <p className="text-sm">Silakan kembali ke tab 'Plot & Cast' dan klik 'Lanjut' untuk membuat halaman.</p>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {generatedData.pages.map((page, idx) => {
                                        const isRefining = activeRefineId === page.id;
                                        const activeCharacters = generatedData.characterProfiles.filter(c => page.characterRefIds.includes(c.id));
                                        const aspectRatioClass = page.aspectRatio === '16:9' ? 'aspect-video' : page.aspectRatio === '3:4' ? 'aspect-[3/4]' : 'aspect-square';

                                        return (
                                            <div key={page.id} className="relative">
                                                {/* Page Number Indicator */}
                                                <div className="absolute -left-12 top-0 hidden xl:flex flex-col items-center">
                                                    <div className="w-8 h-8 rounded-full bg-accent text-white font-bold flex items-center justify-center text-sm mb-2">{page.pageNumber}</div>
                                                    <div className="w-0.5 h-full bg-accent/20"></div>
                                                </div>

                                                <div className={`rounded-2xl overflow-hidden shadow-lg border ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-100'}`}>
                                                    {/* Page Layout Container */}
                                                    <div className="flex flex-col lg:flex-row gap-0 min-h-[500px]">
                                                        
                                                        {/* Illustration Side */}
                                                        <div className={`relative w-full lg:w-2/3 ${aspectRatioClass} group border-b lg:border-b-0 lg:border-r border-white/10 mx-auto ${page.imageUrl ? 'bg-black' : 'bg-white'}`}>
                                                            {page.imageUrl ? (
                                                                <>
                                                                    <img src={page.imageUrl} className="w-full h-full object-cover" onClick={() => setFullscreenImage(page.imageUrl)} />
                                                                    
                                                                    {/* Image Controls Overlay */}
                                                                    {!isRefining && (
                                                                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                                                                            <button onClick={() => setFullscreenImage(page.imageUrl)} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent backdrop-blur"><Maximize2 className="w-4 h-4"/></button>
                                                                            <button onClick={() => { setActiveRefineId(page.id); setRefinePrompt(""); }} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent hover:text-white backdrop-blur" title="Refine / Edit"><Sparkles className="w-4 h-4"/></button>
                                                                            <button onClick={() => generatePageImage(page.id)} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent" title="Redraw Fully"><RefreshCw className="w-4 h-4"/></button>
                                                                            <a href={page.imageUrl} download={`page-${page.pageNumber}.png`} className="bg-black/60 text-white p-2 rounded-full hover:bg-accent"><Download className="w-4 h-4"/></a>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {/* History Icons (Bottom Left) */}
                                                                    {!isRefining && page.imageHistory && page.imageHistory.length > 0 && (
                                                                        <div className="absolute bottom-4 left-4 z-20 flex gap-2 items-center">
                                                                            {page.imageHistory
                                                                            .filter((histImg: string) => histImg !== page.imageUrl)
                                                                            .slice(0, 4) // Limit to 4 most recent
                                                                            .map((histImg: string, i: number) => (
                                                                                <img 
                                                                                    key={i}
                                                                                    src={histImg} 
                                                                                    onClick={() => handleRestoreImage(page.id, histImg)}
                                                                                    className="w-10 h-10 rounded-md border-2 border-white/30 bg-black object-cover cursor-pointer hover:scale-110 hover:border-accent shadow-lg transition-all"
                                                                                    title="Restore previous version"
                                                                                />
                                                                            ))}
                                                                            {page.imageHistory.filter((img: string) => img !== page.imageUrl).length > 4 && (
                                                                                <div className="w-10 h-10 rounded-md bg-black/50 border-2 border-white/30 flex items-center justify-center text-xs font-bold text-white">
                                                                                    +{page.imageHistory.filter((img: string) => img !== page.imageUrl).length - 4}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Refine Input Overlay */}
                                                                    {isRefining && (
                                                                        <div className="absolute inset-x-0 bottom-0 p-4 bg-black/90 backdrop-blur-md z-20 animate-fadeIn border-t border-white/10">
                                                                            <div className="flex flex-col gap-2 max-w-2xl mx-auto">
                                                                                <label className="text-xs font-bold text-white uppercase flex items-center gap-2"><Sparkles className="w-3 h-3 text-accent"/> Refine Image (Edit)</label>
                                                                                <div className="flex gap-2">
                                                                                    <input 
                                                                                        autoFocus
                                                                                        placeholder="Contoh: Tambahkan topi merah, hapus awan..." 
                                                                                        value={refinePrompt}
                                                                                        onChange={(e) => setRefinePrompt(e.target.value)}
                                                                                        onKeyDown={(e) => e.key === 'Enter' && handleRefinePage(page.id)}
                                                                                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent"
                                                                                    />
                                                                                    <button onClick={() => handleRefinePage(page.id)} className="bg-accent text-white px-3 py-2 rounded-lg font-bold text-xs hover:bg-opacity-80"><Check className="w-4 h-4"/></button>
                                                                                    <button onClick={() => setActiveRefineId(null)} className="bg-white/10 text-white px-3 py-2 rounded-lg font-bold text-xs hover:bg-white/20"><X className="w-4 h-4"/></button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {page.isGeneratingImage && (
                                                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-30">
                                                                            <Loader2 className="w-12 h-12 animate-spin text-accent mb-4"/>
                                                                            <span className="text-sm font-bold tracking-widest uppercase">Sedang Melukis...</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
                                                                    {page.isGeneratingImage ? (
                                                                        <div className="flex flex-col items-center gap-2">
                                                                            <Loader2 className="w-10 h-10 animate-spin text-accent"/>
                                                                            <span className="text-xs font-bold text-accent">Menyiapkan Kanvas...</span>
                                                                        </div>
                                                                    ) : (
                                                                        <button 
                                                                            onClick={() => generatePageImage(page.id)} 
                                                                            disabled={!page.prompt} 
                                                                            className={`flex flex-col items-center gap-4 transition-all duration-300 group/btn ${!page.prompt ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                                                                        >
                                                                            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-xl ${
                                                                                page.prompt 
                                                                                ? 'bg-accent text-white scale-105 group-hover/btn:scale-110 group-hover/btn:shadow-accent/50 ring-4 ring-white dark:ring-[#27272A]' 
                                                                                : 'border-4 border-dashed border-slate-300 dark:border-zinc-700'
                                                                            }`}>
                                                                                {page.prompt ? <Wand2 className="w-10 h-10 animate-pulse"/> : <ImageIcon className="w-8 h-8"/>}
                                                                            </div>
                                                                            <span className={`text-sm font-bold uppercase tracking-widest px-6 py-2 rounded-full transition-all ${
                                                                                page.prompt 
                                                                                ? 'bg-accent text-white shadow-lg group-hover/btn:-translate-y-1' 
                                                                                : ''
                                                                            }`}>
                                                                                {page.prompt ? "Buat Ilustrasi" : "Menunggu Prompt"}
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Text & Control Side */}
                                                        <div className="p-6 md:p-8 flex flex-col w-full lg:w-1/3 border-l border-white/5">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <label className="text-xs font-bold uppercase opacity-50 block">Teks Cerita (Story Text)</label>
                                                                <button onClick={() => handleDeletePage(page.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-500/10 transition-all" title="Hapus Halaman"><Trash2 className="w-4 h-4"/></button>
                                                            </div>
                                                            
                                                            <div className="mb-6">
                                                                <textarea 
                                                                    value={page.storyText} 
                                                                    onChange={(e) => handlePageEdit(page.id, 'storyText', e.target.value)}
                                                                    className={`w-full p-4 rounded-xl font-hand text-xl leading-relaxed focus:ring-2 focus:ring-accent outline-none resize-none min-h-[150px] ${isDarkMode ? 'bg-[#18181B] text-white border border-white/10' : 'text-slate-800 border'}`}
                                                                    style={!isDarkMode ? { backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}40` } : {}}
                                                                    placeholder="Tulis cerita di sini..."
                                                                />
                                                            </div>

                                                            <div className="mb-6">
                                                                <label className="text-[10px] font-bold uppercase opacity-50 mb-1 block">Komposisi</label>
                                                                <select value={page.composition} onChange={(e) => handlePageEdit(page.id, 'composition', e.target.value)} className={`w-full text-xs p-2.5 rounded-lg border outline-none ${isDarkMode ? 'bg-[#18181B] border-[#3F3F46]' : 'bg-slate-50 border-slate-200'}`}>
                                                                    {compositionTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                                                </select>
                                                            </div>

                                                            <div className="mt-auto pt-6 border-t border-dashed border-current border-opacity-20">
                                                                {/* Active Characters Badge */}
                                                                {activeCharacters.length > 0 && (
                                                                    <div className="mb-4">
                                                                        <span className="text-[10px] font-bold uppercase opacity-50 mb-2 block flex items-center gap-1"><Users className="w-3 h-3"/> Karakter di scene ini:</span>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {activeCharacters.map(char => (
                                                                                <span key={char.id} className="text-[10px] px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold border border-accent/20 flex items-center gap-1">
                                                                                    {char.name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="text-[10px] font-bold uppercase opacity-50">Deskripsi Visual (AI Prompt)</span>
                                                                </div>
                                                                
                                                                <p className="text-xs opacity-60 italic mb-4 line-clamp-3 hover:line-clamp-none cursor-help transition-all leading-relaxed">{page.illustrationDesc}</p>

                                                                <button onClick={() => generatePagePrompt(page.id)} className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 mb-3 border ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-accent hover:border-accent' : 'bg-slate-100 border-slate-200 hover:bg-accent hover:text-white hover:border-accent'}`}>
                                                                    {page.isGeneratingPrompt ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
                                                                    {page.prompt ? "Regenerate Visual Prompt" : "Generate Visual Prompt"}
                                                                </button>

                                                                {page.prompt && (
                                                                    <div className={`text-[10px] p-3 rounded-lg opacity-50 font-mono overflow-hidden h-12 hover:h-auto transition-all ${isDarkMode ? 'bg-black' : 'bg-slate-100'}`}>
                                                                        {page.prompt}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Back Cover Preview */}
                                    {generatedData.pages.length > 0 && (
                                        <div className={`rounded-3xl p-8 shadow-xl flex flex-col items-center text-center mt-12 border transition-colors duration-500 bg-white border-slate-200`}>
                                            <h3 className="text-sm font-bold uppercase opacity-50 tracking-wider mb-6">Back Cover (Penutup)</h3>
                                            
                                            <div className={`w-full max-w-7xl mx-auto shadow-2xl rounded-xl relative group`}>
                                                <div className={`${formData.defaultAspectRatio === '16:9' ? 'aspect-video' : formData.defaultAspectRatio === '3:4' ? 'aspect-[3/4]' : formData.defaultAspectRatio === '4:3' ? 'aspect-[4/3]' : formData.defaultAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'} rounded-xl overflow-hidden border-4 border-slate-100 relative bg-white flex flex-col items-center justify-center p-12`}>
                                                     <p className="font-hand text-3xl italic opacity-80 text-slate-800 leading-relaxed text-center">
                                                         "{formData.coreMessage || "Tamat."}"
                                                     </p>
                                                     {formData.author && (
                                                         <p className="mt-8 font-fredoka font-bold text-sm uppercase tracking-widest opacity-40 text-slate-900">
                                                             Oleh: {formData.author}
                                                         </p>
                                                     )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CONTINUE TO READ BUTTON */}
                            {generatedData.pages.length > 0 && (
                                <div className="mt-20 mb-32 flex flex-col items-center animate-fadeIn">
                                    <div className="w-full max-w-2xl text-center mb-6">
                                        <h3 className="text-2xl font-bold font-fredoka mb-2">Halaman Sudah Siap?</h3>
                                        <p className="opacity-60">Jika semua ilustrasi dan teks sudah sesuai, lanjut ke mode membaca untuk menikmati cerita.</p>
                                    </div>
                                    <button 
                                        onClick={handleGoToRead} 
                                        className="w-full max-w-xl py-5 rounded-2xl bg-accent text-white font-fredoka font-bold text-xl shadow-xl shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                                    >
                                        <BookOpenText className="w-6 h-6" />
                                        <span>Lanjut: Mulai Bercerita</span>
                                        <ArrowRight className="w-6 h-6 opacity-60" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: READ (SINGLE PAGE & AUDIO) */}
                    {activeTab === 'read' && (
                        <div className="flex flex-col items-center justify-center min-h-[80vh] w-full animate-fadeIn pb-48 px-4">
                            
                            {/* Audio Generator Panel (Sticky Top) */}
                            <div className={`w-full max-w-4xl mx-auto mb-10 p-6 rounded-3xl shadow-lg border flex flex-col gap-6 ${isDarkMode ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-white border-slate-200'}`}>
                                
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center shrink-0">
                                            <Volume2 className="w-6 h-6"/>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm uppercase tracking-wide opacity-60">Narator Cerita</h3>
                                            <p className="font-fredoka font-bold text-xl leading-none">{formData.title}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto justify-end">
                                        {generatedData.audio.narrationAudio && (
                                            <>
                                                <button onClick={playNarration} className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-all shadow-lg bg-accent text-white hover:bg-opacity-90`}>
                                                    {isPlaying ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                                                    {isPlaying ? "Pause" : "Play"}
                                                </button>
                                                <button onClick={handleStopAudio} disabled={!isPlaying && pausedAtRef.current === 0} className="px-4 py-2 rounded-full bg-red-500 text-white font-bold text-sm flex items-center gap-2 hover:bg-red-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <StopCircle className="w-4 h-4"/> Stop
                                                </button>
                                                <a href={generatedData.audio.narrationAudio} download="story.wav" className="p-2 opacity-50 hover:opacity-100 hover:bg-black/5 rounded-full transition-all border border-current" title="Download Audio"><Download className="w-5 h-5"/></a>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-dashed border-current border-opacity-20">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-2 block flex items-center gap-1"><User className="w-3 h-3"/> Suara Karakter</label>
                                        <div className="relative">
                                            <select 
                                                value={audioSettings.characterId} 
                                                onChange={(e) => setAudioSettings(prev => ({ ...prev, characterId: e.target.value }))}
                                                className={`w-full p-3 pr-8 rounded-xl font-bold text-sm outline-none appearance-none cursor-pointer transition-all ${isDarkMode ? 'bg-black/20 hover:bg-black/30' : 'bg-slate-100 hover:bg-slate-200'}`}
                                            >
                                                {INDO_VOICES.map(v => (
                                                    <option key={v.id} value={v.id}>{v.label}</option>
                                                ))}
                                            </select>
                                            <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none rotate-90"/>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-2 block flex items-center gap-1"><Settings2 className="w-3 h-3"/> Ekspresi Suara (Mood)</label>
                                        <div className="relative">
                                            <select 
                                                value={audioSettings.mood} 
                                                onChange={(e) => setAudioSettings(prev => ({ ...prev, mood: e.target.value }))}
                                                className={`w-full p-3 pr-8 rounded-xl font-bold text-sm outline-none appearance-none cursor-pointer transition-all ${isDarkMode ? 'bg-black/20 hover:bg-black/30' : 'bg-slate-100 hover:bg-slate-200'}`}
                                            >
                                                {AUDIO_MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none rotate-90"/>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-2 block flex items-center gap-1"><History className="w-3 h-3"/> Usia Suara</label>
                                        <div className="relative">
                                            <select 
                                                value={audioSettings.age} 
                                                onChange={(e) => setAudioSettings(prev => ({ ...prev, age: e.target.value }))}
                                                className={`w-full p-3 pr-8 rounded-xl font-bold text-sm outline-none appearance-none cursor-pointer transition-all ${isDarkMode ? 'bg-black/20 hover:bg-black/30' : 'bg-slate-100 hover:bg-slate-200'}`}
                                            >
                                                {AUDIO_AGES.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                            <ChevronRight className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none rotate-90"/>
                                        </div>
                                    </div>
                                </div>
                                
                                {!generatedData.audio.narrationAudio && (
                                    <button onClick={generateNarration} disabled={generatedData.audio.isGeneratingNarration} className="w-full py-3 bg-accent text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-accent/20">
                                         {generatedData.audio.isGeneratingNarration ? <Loader2 className="w-4 h-4 animate-spin"/> : <Mic className="w-4 h-4"/>}
                                         Generate Audio Narasi ({generatedData.pages.length} Halaman)
                                    </button>
                                )}
                            </div>

                            {/* READER CONTAINER WITH 3D FLIP */}
                            <div className="perspective-book w-full flex justify-center">
                                <div 
                                    key={bookPage}
                                    className={`relative h-[80vh] md:h-[85vh] w-auto max-w-full shadow-2xl rounded-2xl overflow-hidden group ${formData.defaultAspectRatio === '16:9' ? 'aspect-video' : formData.defaultAspectRatio === '3:4' ? 'aspect-[3/4]' : formData.defaultAspectRatio === '4:3' ? 'aspect-[4/3]' : formData.defaultAspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'} bg-slate-100 border-4 border-white/20 ${turnDirection === 'next' ? 'animate-book-flip-next' : 'animate-book-flip-prev'}`}
                                >
                                    
                                    {/* CONTENT SWITCHER */}
                                    {bookPage === 0 ? (
                                        // COVER PAGE
                                        <div className="w-full h-full relative">
                                            {generatedData.concept.imageUrl && (
                                                <img src={generatedData.concept.imageUrl} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                    ) : bookPage <= generatedData.pages.length ? (
                                        // STORY PAGE
                                        (() => {
                                            const page = generatedData.pages[bookPage - 1];
                                            return (
                                                <div className="w-full h-full flex flex-col bg-white">
                                                    <div className="flex-1 relative overflow-hidden bg-slate-100">
                                                        {page?.imageUrl ? (
                                                            <img src={page.imageUrl} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                <ImageIcon className="w-16 h-16"/>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="h-[20%] min-h-[120px] px-12 py-4 flex items-center justify-center text-center bg-white border-t relative z-10">
                                                        <p className="font-hand text-2xl leading-relaxed">{page?.storyText}</p>
                                                        <div className="absolute bottom-2 right-4 text-xs font-bold text-slate-300">{bookPage}</div>
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        // BACK COVER (WHITE)
                                        <div className="w-full h-full bg-white text-slate-900 flex flex-col items-center justify-center p-10 text-center border-l">
                                            <div className="flex-1 flex flex-col items-center justify-center">
                                                {formData.coreMessage ? (
                                                    <p className="font-hand text-3xl italic opacity-80 max-w-lg leading-relaxed">"{formData.coreMessage}"</p>
                                                ) : (
                                                    <p className="font-hand text-xl opacity-50">Tamat.</p>
                                                )}
                                                
                                                {formData.author && (
                                                    <p className="mt-8 font-fredoka font-bold text-sm uppercase tracking-widest opacity-40">
                                                        Oleh: {formData.author}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                             {/* Navigation Controls */}
                             <div className="flex items-center gap-6 mt-8">
                                <button onClick={handlePrevPage} disabled={bookPage === 0} className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-50 hover:bg-slate-50 text-slate-800 transition-all">
                                    <ChevronLeft className="w-6 h-6"/>
                                </button>
                                <span className="font-bold text-sm opacity-50">
                                    {bookPage === 0 ? 'Cover' : bookPage > generatedData.pages.length ? 'Back Cover' : `Halaman ${bookPage}`}
                                </span>
                                <button onClick={handleNextPage} disabled={bookPage > generatedData.pages.length} className="w-12 h-12 rounded-full bg-accent text-white shadow-lg shadow-accent/30 flex items-center justify-center disabled:opacity-50 hover:scale-105 transition-all">
                                    <ChevronRight className="w-6 h-6"/>
                                </button>
                             </div>
                        </div>
                    )}
                </div>
                
                <div className="w-full py-3 text-center text-white text-[10px] font-bold uppercase tracking-widest z-40 shadow-lg print:hidden shrink-0" style={{ backgroundColor: primaryColor }}>
                    APLIKASI INI DIBUAT OLEH AIGENSEE ©2025
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default App;