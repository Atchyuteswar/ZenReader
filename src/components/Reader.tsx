import { useEffect, useRef, useState } from 'react';
import ePub, { Book as EpubBook, Rendition } from 'epubjs';
import { Book, Highlight, Bookmark } from '../types';
import { storage } from '../lib/storage';
import { ArrowLeft, ChevronLeft, ChevronRight, Settings, Type, Moon, Sun, Bookmark as BookmarkIcon, List, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReaderProps {
  book: Book;
  onBack: () => void;
}

type Theme = 'light' | 'dark' | 'sepia';

export function Reader({ book, onBack }: ReaderProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<EpubBook | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fontSize, setFontSize] = useState(100);
  const [theme, setTheme] = useState<Theme>('light');
  const [currentCfi, setCurrentCfi] = useState<string>('');
  const [toc, setToc] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const [highlights, setHighlights] = useState<Highlight[]>(book.highlights || []);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(book.bookmarks || []);
  const [selection, setSelection] = useState<{ cfiRange: string; x: number; y: number } | null>(null);

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

    const initBook = async () => {
      // Set default styles
      rendition.themes.default({
        'p': { 'font-family': 'Helvetica, Arial, sans-serif !important', 'font-size': '100% !important', 'line-height': '1.6 !important' },
        'h1, h2, h3, h4, h5, h6': { 'font-family': 'Georgia, serif !important' }
      });

      // Inject highlight styles
      rendition.themes.register('highlights', {
        '.hl-yellow': { 'fill': '#ffeb3b', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
        '.hl-green': { 'fill': '#a5d6a7', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
        '.hl-blue': { 'fill': '#90caf9', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
        '.hl-red': { 'fill': '#ef9a9a', 'fill-opacity': '0.3', 'mix-blend-mode': 'multiply' },
      });
      rendition.themes.select('highlights'); // This might override other themes if not careful. 
      // Actually, better to just inject the CSS rules directly or register them as part of the theme.
      // Let's manually inject a stylesheet.
      
      // Load saved progress or start from beginning
      await rendition.display(book.progress || undefined);
      
      // Load TOC
      const navigation = await epub.loaded.navigation;
      setToc(navigation.toc);
      
      // Restore highlights
      if (book.highlights) {
        book.highlights.forEach(h => {
          const colorMap: Record<string, string> = {
            '#ffeb3b': 'hl-yellow',
            '#a5d6a7': 'hl-green',
            '#90caf9': 'hl-blue',
            '#ef9a9a': 'hl-red'
          };
          const className = colorMap[h.color] || 'hl-yellow';
          rendition.annotations.add('highlight', h.cfiRange, {}, undefined, className);
        });
      }

      setIsReady(true);
      applyTheme(theme);
      applyFontSize(fontSize);
    };

    initBook();

    // Event listeners
    rendition.on('relocated', (location: any) => {
      setCurrentCfi(location.start.cfi);
      storage.updateProgress(book.id, location.start.cfi);
      setSelection(null); // Clear selection on page turn
    });

    rendition.on('selected', (cfiRange: string, contents: any) => {
      const range = rendition.getRange(cfiRange);
      const rect = range.getBoundingClientRect();
      
      // Adjust coordinates to be relative to the viewer container
      // Note: rect is relative to the iframe viewport. We need to account for iframe position if needed,
      // but usually the iframe fills the viewer.
      // However, the event might be coming from inside the iframe.
      
      // Simple positioning: center of the selection
      setSelection({
        cfiRange,
        x: rect.left + rect.width / 2,
        y: rect.top - 10 // Position above
      });
      
      // Keep the selection visible
      // contents.window.getSelection().removeAllRanges(); // Don't remove yet, let user see what they selected
    });
    
    // Clear selection when clicking elsewhere
    rendition.on('click', () => {
      setSelection(null);
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

    return () => {
      if (bookRef.current) {
        bookRef.current.destroy();
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [book.id]);

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

  const next = () => renditionRef.current?.next();
  const prev = () => renditionRef.current?.prev();

  // Highlight Logic
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
    const className = colorMap[color] || 'hl-yellow';

    // Add visual annotation
    renditionRef.current.annotations.add('highlight', selection.cfiRange, {}, undefined, className);

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
          <button onClick={onBack} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
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

            <div>
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
              <div className="p-4 border-b border-stone-200 dark:border-neutral-800 flex justify-between items-center">
                <h2 className="font-serif font-bold text-xl">Contents</h2>
                <button onClick={() => setShowMenu(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-xs font-bold opacity-50 uppercase tracking-wider mb-3">Chapters</h3>
                  <ul className="space-y-1">
                    {toc.map((item, i) => (
                      <li key={i}>
                        <button 
                          onClick={() => goToLocation(item.href)}
                          className="w-full text-left py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 truncate text-sm"
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {bookmarks.length > 0 && (
                    <>
                      <h3 className="text-xs font-bold opacity-50 uppercase tracking-wider mt-6 mb-3">Bookmarks</h3>
                      <ul className="space-y-1">
                        {bookmarks.map((bookmark, i) => (
                          <li key={i} className="flex items-center group">
                            <button 
                              onClick={() => goToLocation(bookmark.cfi)}
                              className="flex-1 text-left py-2 px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 truncate text-sm flex items-center gap-2"
                            >
                              <BookmarkIcon className="w-3 h-3 fill-current opacity-50" />
                              {bookmark.label}
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteBookmark(bookmark.cfi); }}
                              className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
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
            className="absolute z-50 bg-white dark:bg-neutral-800 rounded-full shadow-lg border border-stone-200 dark:border-neutral-700 p-2 flex gap-2"
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
        
        <div className="text-xs opacity-50 font-mono">
          {/* Progress bar or page number could go here if we calculated locations */}
          Reading
        </div>

        <button onClick={next} className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
          <ChevronRight className="w-8 h-8" />
        </button>
      </motion.div>
    </div>
  );
}
