import React, { useEffect, useRef, useState } from 'react';
import ePub, { Book as EpubBook, Rendition } from 'epubjs';
import { Book, Highlight, Bookmark } from '../types';
import { storage } from '../lib/storage';
import { ArrowLeft, ChevronLeft, ChevronRight, Settings, Type, Moon, Sun, Bookmark as BookmarkIcon, List, X, Trash2, Search as SearchIcon, Volume2, VolumeX, Loader2, Bold } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateSpeech } from '../services/ttsService';

interface ReaderProps {
  book: Book;
  onBack: () => void;
}

type Theme = 'light' | 'dark' | 'sepia';

// Recursive TOC Item Component
interface TOCItemProps {
  item: any;
  level?: number;
  currentChapterHref?: string | null;
  onNavigate: (href: string) => void;
}

const TOCItem: React.FC<TOCItemProps> = ({ item, level = 0, currentChapterHref, onNavigate }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.subitems && item.subitems.length > 0;
  const isActive = currentChapterHref && item.href && currentChapterHref.includes(item.href.split('#')[0]);

  return (
    <li>
      <div className="flex items-center group">
        <button 
          onClick={() => onNavigate(item.href)}
          className={`flex-1 text-left py-2 px-3 rounded-lg transition-colors truncate text-sm ${
            isActive 
              ? 'bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-900/30 dark:text-indigo-300' 
              : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          {item.label}
        </button>
        {hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-2 opacity-50 hover:opacity-100"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded || isActive ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      {hasChildren && (expanded || isActive) && (
        <ul className="space-y-1 mt-1">
          {item.subitems.map((subitem: any, i: number) => (
            <TOCItem key={i} item={subitem} level={level + 1} currentChapterHref={currentChapterHref} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
};

export function Reader({ book, onBack }: ReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<EpubBook | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fontSize, setFontSize] = useState(100);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [theme, setTheme] = useState<Theme>('light');
  const [currentCfi, setCurrentCfi] = useState<string>('');
  const [toc, setToc] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuTab, setMenuTab] = useState<'chapters' | 'bookmarks' | 'highlights' | 'search'>('chapters');
  const [currentChapterHref, setCurrentChapterHref] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [confirmDeleteHighlight, setConfirmDeleteHighlight] = useState<string | null>(null);
  
  const [highlights, setHighlights] = useState<Highlight[]>(book.highlights || []);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(book.bookmarks || []);
  const [selection, setSelection] = useState<{ cfiRange: string; x: number; y: number } | null>(null);
  const [activeFootnote, setActiveFootnote] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [maxProgress, setMaxProgress] = useState(0);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [furthestCfi, setFurthestCfi] = useState<string>('');
  
  const currentCfiRef = useRef(currentCfi);
  const progressRef = useRef(progress);

  useEffect(() => {
    currentCfiRef.current = currentCfi;
  }, [currentCfi]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Initialize EPUB
  useEffect(() => {
    if (!viewerRef.current) return;

    const epub = ePub(book.data);
    bookRef.current = epub;

    const rendition = epub.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      manager: 'default',
    });
    renditionRef.current = rendition;

    // Inject highlight styles into every chapter
    rendition.hooks.content.register((contents: any) => {
      contents.addStylesheetRules({
        '.hl-yellow': { 'fill': '#ffeb3b !important', 'fill-opacity': '0.3 !important', 'mix-blend-mode': 'multiply !important', 'cursor': 'pointer !important', 'pointer-events': 'auto !important' },
        '.hl-green': { 'fill': '#a5d6a7 !important', 'fill-opacity': '0.3 !important', 'mix-blend-mode': 'multiply !important', 'cursor': 'pointer !important', 'pointer-events': 'auto !important' },
        '.hl-blue': { 'fill': '#90caf9 !important', 'fill-opacity': '0.3 !important', 'mix-blend-mode': 'multiply !important', 'cursor': 'pointer !important', 'pointer-events': 'auto !important' },
        '.hl-red': { 'fill': '#ef9a9a !important', 'fill-opacity': '0.3 !important', 'mix-blend-mode': 'multiply !important', 'cursor': 'pointer !important', 'pointer-events': 'auto !important' },
        '.hl-custom': { 'cursor': 'pointer !important', 'pointer-events': 'auto !important' }
      });
    });

    const initBook = async () => {
      // Set default styles
      rendition.themes.default({
        'p': { 'font-family': 'Helvetica, Arial, sans-serif !important', 'font-size': '100% !important', 'line-height': '1.6 !important' },
        'h1, h2, h3, h4, h5, h6': { 'font-family': 'Georgia, serif !important' }
      });
      
      // Load saved progress or start from beginning
      await rendition.display(book.progress || undefined);
      if (book.progress) {
          setFurthestCfi(book.progress);
      }
      
      // Load TOC
      const navigation = await epub.loaded.navigation;
      setToc(navigation.toc);

      // Generate locations for progress tracking
      await epub.locations.generate(1000);
      const initialProgress = epub.locations.percentageFromCfi(book.progress || '');
      setProgress(initialProgress * 100);
      setMaxProgress(initialProgress * 100);
      
      // Restore highlights
      if (book.highlights) {
        book.highlights.forEach(h => {
          const colorMap: Record<string, string> = {
            '#ffeb3b': 'hl-yellow',
            '#a5d6a7': 'hl-green',
            '#90caf9': 'hl-blue',
            '#ef9a9a': 'hl-red'
          };
          const className = colorMap[h.color];
          const styles = className ? {} : { fill: h.color, 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply', 'cursor': 'pointer', 'pointer-events': 'auto' };
          
          rendition.annotations.add(
              'highlight', 
              h.cfiRange, 
              {}, 
              (e: any) => onHighlightClick(h.cfiRange), 
              className || 'hl-custom',
              styles
          );
        });
      }

      setIsReady(true);
      applyTheme(theme);
      applyFontSize(fontSize);
      applyFontWeight(fontWeight);
    };

    initBook();

    // Event listeners
    rendition.on('relocated', (location: any) => {
      setCurrentCfi(location.start.cfi);
      
      if (bookRef.current) {
        const p = bookRef.current.locations.percentageFromCfi(location.start.cfi);
        const pPercent = p * 100;
        setProgress(pPercent);
        
        storage.updateProgress(book.id, location.start.cfi, pPercent);
        setSelection(null);
        
        // Update furthest point if we moved forward
        if (pPercent > maxProgress) {
          setMaxProgress(pPercent);
          setFurthestCfi(location.start.cfi);
        }

        // Find current chapter
        const spineItem = bookRef.current.spine.get(location.start.cfi);
        if (spineItem) {
          setCurrentChapterHref(spineItem.href);
        }
      }
    });

    rendition.on('selected', (cfiRange: string, contents: any) => {
      const range = rendition.getRange(cfiRange);
      const rect = range.getBoundingClientRect();
      
      setSelection({
        cfiRange,
        x: rect.left + rect.width / 2,
        y: rect.top - 10 // Position above
      });
    });
    
    // Handle clicks (selection clear & footnotes)
    rendition.on('click', (e: any) => {
      setSelection(null);

      const link = e.target.closest('a');
      if (link) {
        const href = link.getAttribute('href');
        const epubType = link.getAttribute('epub:type');
        const role = link.getAttribute('role');
        const classList = link.classList;
        
        // Heuristic for footnotes
        const isFootnote = 
          epubType === 'noteref' || 
          role === 'doc-noteref' || 
          classList.contains('footnote') || 
          classList.contains('note') ||
          (href && (href.includes('fn') || href.includes('note')));

        if (isFootnote && href) {
          e.preventDefault();
          handleFootnote(href);
        }
      }
    });

    // Handle resize
    const handleResize = () => {
      if (renditionRef.current) {
        renditionRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);

    // Keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Periodic save fallback (every 60s)
    const saveInterval = setInterval(() => {
      if (currentCfiRef.current && renditionRef.current) {
        storage.updateProgress(book.id, currentCfiRef.current, progressRef.current);
      }
    }, 60000);

    // Save on tab close
    const handleBeforeUnload = () => {
      if (currentCfiRef.current) {
        storage.updateProgress(book.id, currentCfiRef.current, progressRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (bookRef.current) {
        bookRef.current.destroy();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      clearInterval(saveInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [book.id]);

  const handleFootnote = async (href: string) => {
    if (!bookRef.current) return;

    try {
      // 1. Resolve the href to find the target item
      // Note: href might be relative. 
      // We can try to find the item in the spine.
      let targetId = '';
      let targetItem = null;

      if (href.includes('#')) {
        const parts = href.split('#');
        targetId = parts[1];
        // If there is a path part, use it to find the item. 
        // If not (just #id), it's in the current chapter (or we assume so).
        if (parts[0]) {
           targetItem = bookRef.current.spine.get(parts[0]);
        }
      } else {
        // Just a link to a file? Unlikely for a footnote, but possible.
        targetItem = bookRef.current.spine.get(href);
      }

      // If we didn't find a target item from the href path, assume current chapter
      if (!targetItem) {
        // We can try to find the element in the current view
        const currentView = renditionRef.current?.getContents()[0];
        if (currentView && targetId) {
          const el = currentView.document.getElementById(targetId);
          if (el) {
            setActiveFootnote(el.innerHTML);
            return;
          }
        }
        // If not found in current view, it might be in the same spine item but not rendered? 
        // (Unlikely if flow is paginated and it's one file, but possible if split)
        // Let's fallback to loading the current spine item text if we can identify it.
        // For now, if we can't find it, we might fail or try to load the href as is.
      }

      // If we have a target item (external file or resolved path), load it
      if (targetItem) {
        // We need to load the document. 
        // book.load(url) loads the document.
        // targetItem.href gives the path.
        // However, we need to load it without displaying it.
        // We can use the internal `load` method or fetch it.
        // epub.js `load` might be bound to the book.
        
        // A safer way in epub.js v0.3:
        // item.load(book.load.bind(book)) -> returns document
        const doc = await targetItem.load(bookRef.current.load.bind(bookRef.current));
        
        if (targetId) {
          const el = doc.getElementById(targetId);
          if (el) {
            setActiveFootnote(el.innerHTML);
          } else {
            console.warn('Footnote element not found in target document', targetId);
          }
        } else {
          // No ID, maybe just show the whole body? Or first paragraph?
          setActiveFootnote(doc.body.innerHTML);
        }
      }

    } catch (err) {
      console.error('Failed to load footnote', err);
    }
  };

  // Theme & Font Handling
  const applyTheme = (newTheme: Theme) => {
    if (!renditionRef.current) return;
    
    const themes = {
      light: { body: { color: '#000', background: '#fff' } },
      dark: { body: { color: '#ccc', background: '#1a1a1a' } }, // Dark grey bg, light grey text
      sepia: { body: { color: '#5f4b32', background: '#f6f1d1' } },
    };

    renditionRef.current.themes.register(newTheme, themes[newTheme]);
    renditionRef.current.themes.select(newTheme);
    setTheme(newTheme);
  };

  const applyFontSize = (size: number) => {
    if (!renditionRef.current) return;
    renditionRef.current.themes.fontSize(`${size}%`);
    setFontSize(size);
  };

  const applyFontWeight = (weight: 'normal' | 'bold') => {
    if (!renditionRef.current) return;
    renditionRef.current.themes.default({
      'p': { 'font-weight': `${weight} !important` },
      'body': { 'font-weight': `${weight} !important` }
    });
    setFontWeight(weight);
  };

  const next = () => renditionRef.current?.next();
  const prev = () => renditionRef.current?.prev();

  // Search Logic
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !bookRef.current) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const results: any[] = [];
      const spine = bookRef.current.spine;
      
      // Use Promise.all for faster searching across chapters
      const searchPromises = spine.spineItems.map(async (item: any) => {
        try {
          // Section.find(query) returns results with precise CFIs
          const sectionResults = await item.find(searchQuery);
          return sectionResults.map((res: any) => ({
            cfi: res.cfi,
            label: res.excerpt,
            href: res.cfi // Navigation works with CFIs directly
          }));
        } catch (err) {
          console.warn('Error searching chapter', item.href, err);
          return [];
        }
      });

      const allResults = await Promise.all(searchPromises);
      const flattenedResults = allResults.flat();
      
      setSearchResults(flattenedResults);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Highlight Logic
  const onHighlightClick = (cfiRange: string) => {
    setConfirmDeleteHighlight(cfiRange);
  };

  const addHighlight = async (color: string) => {
    if (!selection || !renditionRef.current) return;
    
    const highlight: Highlight = {
      cfiRange: selection.cfiRange,
      color,
      created: Date.now()
    };

    const colorMap: Record<string, string> = {
      '#ffeb3b': 'hl-yellow',
      '#a5d6a7': 'hl-green',
      '#90caf9': 'hl-blue',
      '#ef9a9a': 'hl-red'
    };
    
    const className = colorMap[color];
    const styles = className ? {} : { fill: color, 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply', 'cursor': 'pointer', 'pointer-events': 'auto' };

    renditionRef.current.annotations.add(
        'highlight', 
        selection.cfiRange, 
        {}, 
        (e: any) => onHighlightClick(selection.cfiRange), 
        className || 'hl-custom',
        styles
    );
    
    // If it's a custom color not in map, we might want to inject a style.
    // But for now we stick to the map or default.

    // Save
    await storage.addHighlight(book.id, highlight);
    setHighlights([...highlights, highlight]);
    setSelection(null);
    
    // Clear browser selection
    const window = renditionRef.current.getContents()[0].window;
    window.getSelection()?.removeAllRanges();
  };

  const removeHighlight = async (cfiRange: string) => {
    if (!renditionRef.current) return;
    renditionRef.current.annotations.remove(cfiRange, 'highlight');
    await storage.removeHighlight(book.id, cfiRange);
    setHighlights(highlights.filter(h => h.cfiRange !== cfiRange));
  };

  // Bookmark Logic
  const isBookmarked = bookmarks.some(b => b.cfi === currentCfi);

  const toggleBookmark = async () => {
    if (isBookmarked) {
      await storage.removeBookmark(book.id, currentCfi);
      setBookmarks(bookmarks.filter(b => b.cfi !== currentCfi));
    } else {
      const bookmark: Bookmark = {
        cfi: currentCfi,
        label: `Page ${bookmarks.length + 1}`, // Ideally we'd get chapter name
        created: Date.now()
      };
      await storage.addBookmark(book.id, bookmark);
      setBookmarks([...bookmarks, bookmark]);
    }
  };

  const deleteBookmark = async (cfi: string) => {
    await storage.removeBookmark(book.id, cfi);
    setBookmarks(bookmarks.filter(b => b.cfi !== cfi));
  };

  const goToLocation = (cfi: string) => {
    renditionRef.current?.display(cfi);
    setShowMenu(false);
  };

  const handleTTS = async () => {
    if (isReadingAloud) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsReadingAloud(false);
      return;
    }

    if (!renditionRef.current) return;

    setIsGeneratingSpeech(true);
    try {
      // Extract text from current page
      const contents = renditionRef.current.getContents();
      let text = "";
      contents.forEach((content: any) => {
        text += content.document.body.innerText + " ";
      });

      if (!text.trim()) {
        setIsGeneratingSpeech(false);
        return;
      }

      const base64Audio = await generateSpeech(text.substring(0, 3000)); // Limit text length for API
      if (base64Audio) {
        const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsReadingAloud(false);
          audioRef.current = null;
        };
        audio.play();
        setIsReadingAloud(true);
      }
    } catch (error) {
      console.error("TTS failed", error);
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleBack = async () => {
    if (currentCfi) {
      await storage.updateProgress(book.id, currentCfi, progress);
    }
    onBack();
  };

  return (
    <div className={`relative w-full h-screen flex flex-col overflow-hidden ${
      theme === 'dark' ? 'bg-[#1a1a1a]' : theme === 'sepia' ? 'bg-[#f6f1d1]' : 'bg-white'
    }`}>
      {/* Top Bar */}
      <motion.div 
        initial={{ y: -100 }}
        animate={{ y: showControls ? 0 : -100 }}
        transition={{ duration: 0.2 }}
        className={`absolute top-0 left-0 right-0 h-16 backdrop-blur-md border-b z-50 flex items-center justify-between px-4 shadow-sm ${
          theme === 'dark' 
            ? 'bg-[#1a1a1a]/90 border-neutral-800 text-stone-200' 
            : 'bg-white/90 border-stone-200 text-stone-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <button onClick={handleBack} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button onClick={() => setShowMenu(true)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
            <List className="w-6 h-6" />
          </button>
        </div>

        <h2 className="font-serif font-medium truncate max-w-xs text-center text-sm sm:text-base">
          {book.title}
        </h2>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleTTS}
            disabled={isGeneratingSpeech}
            className={`p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${isReadingAloud ? 'text-indigo-500' : ''}`}
            title={isReadingAloud ? "Stop Reading" : "Read Aloud"}
          >
            {isGeneratingSpeech ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isReadingAloud ? (
              <VolumeX className="w-6 h-6" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
          </button>
          <button 
            onClick={toggleBookmark}
            className={`p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${isBookmarked ? 'text-indigo-500' : ''}`}
          >
            <BookmarkIcon className={`w-6 h-6 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </motion.div>

      {/* Settings Menu */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className={`absolute top-16 right-4 w-72 rounded-xl shadow-xl border z-50 p-4 ${
              theme === 'dark' ? 'bg-[#2a2a2a] border-neutral-700 text-stone-200' : 'bg-white border-stone-200 text-stone-800'
            }`}
          >
            <div className="mb-4">
              <label className="text-xs font-bold opacity-50 uppercase tracking-wider mb-2 block">Theme</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => applyTheme('light')}
                  className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 ${theme === 'light' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-stone-200 text-stone-600'}`}
                >
                  <Sun className="w-4 h-4" />
                  <span className="text-xs">Light</span>
                </button>
                <button 
                  onClick={() => applyTheme('dark')}
                  className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 ${theme === 'dark' ? 'border-indigo-500 bg-neutral-800 text-white' : 'border-neutral-700 bg-neutral-900 text-stone-400'}`}
                >
                  <Moon className="w-4 h-4" />
                  <span className="text-xs">Dark</span>
                </button>
                <button 
                  onClick={() => applyTheme('sepia')}
                  className={`flex-1 py-2 rounded-lg border bg-[#f6f1d1] text-[#5f4b32] ${theme === 'sepia' ? 'border-indigo-500' : 'border-stone-200'}`}
                >
                  <span className="text-xs font-serif">Sepia</span>
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold opacity-50 uppercase tracking-wider mb-2 block">Font Size</label>
              <div className="flex items-center gap-4">
                <button onClick={() => applyFontSize(Math.max(80, fontSize - 10))} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg">
                  <Type className="w-4 h-4" />
                </button>
                <div className="flex-1 h-2 bg-stone-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${((fontSize - 80) / 120) * 100}%` }} />
                </div>
                <button onClick={() => applyFontSize(Math.min(200, fontSize + 10))} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg">
                  <Type className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold opacity-50 uppercase tracking-wider mb-2 block">Font Weight</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => applyFontWeight('normal')}
                  className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 ${fontWeight === 'normal' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-stone-200 text-stone-600 dark:border-neutral-700'}`}
                >
                  <span className="text-xs">Normal</span>
                </button>
                <button 
                  onClick={() => applyFontWeight('bold')}
                  className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-2 ${fontWeight === 'bold' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-stone-200 text-stone-600 dark:border-neutral-700'}`}
                >
                  <Bold className="w-4 h-4" />
                  <span className="text-xs font-bold">Bold</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Menu (TOC & Bookmarks) */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="absolute inset-0 bg-black/50 z-50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute top-0 left-0 bottom-0 w-80 shadow-2xl z-50 flex flex-col ${
                theme === 'dark' ? 'bg-[#1a1a1a] text-stone-200' : 'bg-white text-stone-800'
              }`}
            >
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-stone-200 dark:border-neutral-800 flex justify-between items-center">
                  <h2 className="font-serif font-bold text-xl">Menu</h2>
                  <button onClick={() => setShowMenu(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex border-b border-stone-200 dark:border-neutral-800">
                  <button 
                    onClick={() => setMenuTab('chapters')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      menuTab === 'chapters' 
                        ? 'text-indigo-600 border-b-2 border-indigo-600' 
                        : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                    }`}
                  >
                    Chapters
                  </button>
                  <button 
                    onClick={() => setMenuTab('bookmarks')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      menuTab === 'bookmarks' 
                        ? 'text-indigo-600 border-b-2 border-indigo-600' 
                        : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                    }`}
                  >
                    Bookmarks
                  </button>
                  <button 
                    onClick={() => setMenuTab('highlights')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      menuTab === 'highlights' 
                        ? 'text-indigo-600 border-b-2 border-indigo-600' 
                        : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                    }`}
                  >
                    Highlights
                  </button>
                  <button 
                    onClick={() => setMenuTab('search')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      menuTab === 'search' 
                        ? 'text-indigo-600 border-b-2 border-indigo-600' 
                        : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                    }`}
                  >
                    Search
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  {menuTab === 'chapters' ? (
                    <ul className="space-y-1">
                      {toc.length > 0 ? (
                        toc.map((item, i) => (
                          <TOCItem key={i} item={item} currentChapterHref={currentChapterHref} onNavigate={goToLocation} />
                        ))
                      ) : (
                        <li className="text-stone-500 text-sm italic p-2">No table of contents found.</li>
                      )}
                    </ul>
                  ) : menuTab === 'bookmarks' ? (
                    <ul className="space-y-1">
                      {bookmarks.length > 0 ? (
                        bookmarks.map((bookmark, i) => (
                          <li key={i} className="flex items-center group">
                            <button 
                              onClick={() => goToLocation(bookmark.cfi)}
                              className="flex-1 text-left py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 truncate text-sm flex items-center gap-2"
                            >
                              <BookmarkIcon className="w-3 h-3 fill-current opacity-50" />
                              <div className="flex flex-col truncate">
                                <span className="truncate">{bookmark.label}</span>
                                <span className="text-[10px] opacity-50 font-mono">{new Date(bookmark.created).toLocaleDateString()}</span>
                              </div>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteBookmark(bookmark.cfi); }}
                              className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="text-stone-500 text-sm italic p-2 text-center mt-10">
                          <BookmarkIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          No bookmarks yet.
                        </li>
                      )}
                    </ul>
                  ) : menuTab === 'highlights' ? (
                    <ul className="space-y-1">
                      {highlights.length > 0 ? (
                        highlights.map((highlight, i) => (
                          <li key={i} className="flex items-center group">
                            <button 
                              onClick={() => goToLocation(highlight.cfiRange)}
                              className="flex-1 text-left py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 truncate text-sm flex items-center gap-2"
                            >
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: highlight.color }} />
                              <div className="flex flex-col truncate">
                                <span className="truncate opacity-70 italic">Highlight at {highlight.cfiRange.substring(0, 20)}...</span>
                                <span className="text-[10px] opacity-50 font-mono">{new Date(highlight.created).toLocaleDateString()}</span>
                              </div>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteHighlight(highlight.cfiRange); }}
                              className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="text-stone-500 text-sm italic p-2 text-center mt-10">
                          No highlights yet.
                        </li>
                      )}
                    </ul>
                  ) : (
                    <div className="flex flex-col h-full">
                        <form onSubmit={handleSearch} className="mb-4">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full pl-9 pr-4 py-2 bg-stone-100 dark:bg-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                            </div>
                        </form>
                        
                        {isSearching ? (
                            <div className="flex justify-center py-8">
                                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {searchResults.length > 0 ? (
                                    searchResults.map((result, i) => (
                                        <li key={i}>
                                            <button 
                                                onClick={() => goToLocation(result.href)}
                                                className="w-full text-left py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-sm"
                                            >
                                                <div className="font-serif text-xs opacity-70 mb-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: result.label }} />
                                                <div className="text-[10px] opacity-40 font-mono truncate">{result.href}</div>
                                            </button>
                                        </li>
                                    ))
                                ) : searchQuery && (
                                    <li className="text-stone-500 text-sm italic p-2 text-center">No results found.</li>
                                )}
                            </ul>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Highlight Removal Confirmation */}
      <AnimatePresence>
        {confirmDeleteHighlight && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteHighlight(null)}
              className="absolute inset-0 bg-black/20 z-50 backdrop-blur-[1px] flex items-center justify-center"
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className={`p-6 rounded-xl shadow-xl max-w-xs w-full ${
                        theme === 'dark' ? 'bg-[#2a2a2a] text-stone-200' : 'bg-white text-stone-800'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="font-bold mb-2">Remove Highlight?</h3>
                    <p className="text-sm opacity-70 mb-4">This will permanently remove the highlight.</p>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setConfirmDeleteHighlight(null)}
                            className="flex-1 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                if (confirmDeleteHighlight) {
                                    removeHighlight(confirmDeleteHighlight);
                                    setConfirmDeleteHighlight(null);
                                }
                            }}
                            className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium"
                        >
                            Remove
                        </button>
                    </div>
                </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Highlight Menu */}
      <AnimatePresence>
        {selection && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute z-50 bg-white dark:bg-neutral-800 rounded-full shadow-lg border border-stone-200 dark:border-neutral-700 p-2 flex gap-2 items-center"
            style={{ 
              top: Math.min(selection.y - 60, window.innerHeight - 80), // Keep on screen
              left: Math.max(10, Math.min(selection.x - 100, window.innerWidth - 210)) // Keep on screen
            }}
          >
            {['#ffeb3b', '#a5d6a7', '#90caf9', '#ef9a9a'].map(color => (
              <button
                key={color}
                onClick={() => addHighlight(color)}
                className="w-8 h-8 rounded-full border border-black/10 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
              />
            ))}
            
            {/* Custom Color Picker */}
            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-black/10 hover:scale-110 transition-transform bg-gradient-to-br from-red-500 via-green-500 to-blue-500">
                <input 
                    type="color" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => addHighlight(e.target.value)}
                />
            </div>

            <div className="w-px h-8 bg-stone-200 dark:bg-neutral-700 mx-1" />
            <button 
              onClick={() => setSelection(null)}
              className="p-1.5 hover:bg-stone-100 dark:hover:bg-neutral-700 rounded-full text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footnote Popup */}
      <AnimatePresence>
        {activeFootnote && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveFootnote(null)}
              className="absolute inset-0 bg-black/20 z-50 backdrop-blur-[1px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute bottom-0 left-0 right-0 p-6 rounded-t-2xl shadow-2xl z-50 max-h-[50vh] overflow-y-auto ${
                theme === 'dark' ? 'bg-[#2a2a2a] text-stone-200' : 'bg-white text-stone-800'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold opacity-50 uppercase tracking-wider">Footnote</h3>
                <button 
                  onClick={() => setActiveFootnote(null)}
                  className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div 
                className="prose dark:prose-invert prose-sm max-w-none mb-6"
                dangerouslySetInnerHTML={{ __html: activeFootnote }}
              />
              <button 
                onClick={() => setActiveFootnote(null)}
                className="w-full py-3 rounded-xl bg-stone-100 dark:bg-neutral-700 hover:bg-stone-200 dark:hover:bg-neutral-600 font-medium text-sm transition-colors"
              >
                Back to text
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Viewer Area */}
      <div 
        className="flex-1 relative z-0"
        onClick={() => {
          if (!selection) setShowControls(!showControls);
        }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div ref={viewerRef} className="h-full w-full" />
      </div>

      {/* Bottom Controls */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: showControls ? 0 : 100 }}
        transition={{ duration: 0.2 }}
        className={`absolute bottom-0 left-0 right-0 h-20 backdrop-blur-md border-t z-50 flex items-center justify-between px-8 ${
          theme === 'dark' 
            ? 'bg-[#1a1a1a]/90 border-neutral-800 text-stone-200' 
            : 'bg-white/90 border-stone-200 text-stone-800'
        }`}
      >
        <button onClick={prev} className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft className="w-8 h-8" />
        </button>
        
        <div className="text-xs opacity-50 font-mono flex items-center gap-2">
          {/* Auto-bookmark indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
              <BookmarkIcon className="w-3 h-3 fill-current" />
              <span>{progress > maxProgress - 1 ? 'Reading' : 'Reviewing'}</span>
            </div>
            <span className="text-[10px] opacity-50">{Math.round(progress)}%</span>
          </div>
        </div>

        <button onClick={next} className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Progress Bar & Auto-Bookmark Scrubber */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5 dark:bg-white/5 cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            const cfi = bookRef.current?.locations.cfiFromPercentage(percentage);
            if (cfi) renditionRef.current?.display(cfi);
          }}
        >
          {/* Main Progress */}
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-indigo-500/40"
          />
          
          {/* Furthest Point (Auto-Bookmark) */}
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${maxProgress}%` }}
            className="absolute top-0 left-0 h-full bg-indigo-500"
          />

          {/* Furthest Point Marker */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (furthestCfi) renditionRef.current?.display(furthestCfi);
            }}
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white dark:border-neutral-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
            style={{ left: `${maxProgress}%`, marginLeft: '-6px' }}
            title="Return to furthest point"
          />
        </div>
      </motion.div>
    </div>
  );
}
