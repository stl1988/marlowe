import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useFS } from '@/hooks/useFS';
import { VFSImage } from '@/components/VFSImage';
import { Search, FolderOpen } from 'lucide-react';

interface VFSImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Root directory to scan for images */
  rootPath: string;
  /** Called with the VFS path of the selected image */
  onSelect: (path: string) => void;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

function isImagePath(p: string): boolean {
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

async function scanImages(
  fs: { readdir(path: string): Promise<string[]>; stat(path: string): Promise<{ isDirectory(): boolean }> },
  dir: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 4) return [];
  let results: string[] = [];
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      // Skip hidden/node_modules/dist-like folders
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'android') continue;
      const full = `${dir}/${entry}`;
      try {
        const stat = await fs.stat(full);
        if (stat.isDirectory()) {
          const sub = await scanImages(fs, full, depth + 1);
          results = results.concat(sub);
        } else if (isImagePath(entry)) {
          results.push(full);
        }
      } catch {
        // ignore inaccessible entries
      }
    }
  } catch {
    // ignore unreadable dir
  }
  return results;
}

export function VFSImagePicker({ open, onOpenChange, rootPath, onSelect }: VFSImagePickerProps) {
  const { fs } = useFS();
  const [images, setImages] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setIsScanning(true);
    scanImages(fs, rootPath)
      .then(setImages)
      .catch(() => setImages([]))
      .finally(() => setIsScanning(false));
  }, [open, fs, rootPath]);

  const filtered = images.filter(p =>
    p.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = useCallback((path: string) => {
    onSelect(path);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Select Image from Project
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter images..."
            className="pl-8"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isScanning ? (
            <div className="grid grid-cols-3 gap-3 p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">{search ? 'No images match your filter.' : 'No image files found in the project.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 p-1">
              {filtered.map(path => {
                const name = path.split('/').pop() ?? path;
                const relativePath = path.startsWith(rootPath)
                  ? path.slice(rootPath.length).replace(/^\//, '')
                  : path;
                return (
                  <button
                    key={path}
                    onClick={() => handleSelect(path)}
                    className="group relative rounded-lg overflow-hidden border bg-muted/50 hover:border-primary hover:bg-muted transition-colors text-left"
                    title={relativePath}
                  >
                    <VFSImage
                      path={path}
                      alt={name}
                      className="w-full aspect-square object-contain p-1"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 backdrop-blur-sm px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs truncate font-mono">{name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
