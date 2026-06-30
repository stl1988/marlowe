import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface NsiteDeployFormProps {
  /** Human-readable project name — used to default the title */
  projectName: string;
  /** 'root' = kind 15128 (no d tag), 'named' = kind 35128 (d tag) */
  siteType: 'root' | 'named';
  /** Persisted values from a previous deployment */
  savedSiteTitle?: string;
  savedSiteDescription?: string;
  /** Present only when the project was previously deployed with a dedicated keypair (v1) */
  savedNsec?: string;
  onSiteTypeChange: (type: 'root' | 'named') => void;
  onSiteTitleChange: (title: string) => void;
  onSiteDescriptionChange: (description: string) => void;
}

export function NsiteDeployForm({
  projectName,
  siteType,
  savedSiteTitle,
  savedSiteDescription,
  savedNsec,
  onSiteTypeChange,
  onSiteTitleChange,
  onSiteDescriptionChange,
}: NsiteDeployFormProps) {
  const [siteTitle, setSiteTitle] = useState(savedSiteTitle ?? projectName);
  const [siteDescription, setSiteDescription] = useState(savedSiteDescription ?? '');

  // On mount: sync all saved values to parent and set defaults.
  const initializedRef = useRef(false);
  const stableSyncToParent = useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (savedSiteDescription) onSiteDescriptionChange(savedSiteDescription);

    const initialTitle = savedSiteTitle ?? projectName;
    if (initialTitle !== siteTitle) setSiteTitle(initialTitle);
    onSiteTitleChange(initialTitle);
  }, [savedSiteDescription, savedSiteTitle, siteTitle, projectName, onSiteDescriptionChange, onSiteTitleChange]);

  useEffect(() => {
    stableSyncToParent();
  }, [stableSyncToParent]);

  const handleSiteTitleChange = (value: string) => {
    setSiteTitle(value);
    onSiteTitleChange(value);
  };

  const handleSiteDescriptionChange = (value: string) => {
    setSiteDescription(value);
    onSiteDescriptionChange(value);
  };

  return (
    <div className="space-y-4">

      {/* Migration notice */}
      {savedNsec && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Site identity is changing.</strong> This project was previously deployed with a
            dedicated private key. Going forward, it will deploy under your Nostr identity. The old
            site will remain at its original address until overwritten.
          </AlertDescription>
        </Alert>
      )}

      {/* Site type toggle */}
      <div className="space-y-2">
        <Label>Site type</Label>
        <ToggleGroup
          type="single"
          value={siteType}
          onValueChange={(val) => { if (val) onSiteTypeChange(val as 'root' | 'named'); }}
          className="justify-start"
        >
          <ToggleGroupItem value="named" className="text-xs">
            Named site
          </ToggleGroupItem>
          <ToggleGroupItem value="root" className="text-xs">
            Root site
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          {siteType === 'root'
            ? 'Publishes as kind 15128 — served at your npub subdomain (e.g. npub1….nsite.lol).'
            : 'Publishes as kind 35128 — served at a named subdomain (e.g. mysite.nsite.lol).'}
        </p>
      </div>

      {/* Site title */}
      <div className="space-y-2">
        <Label htmlFor="nsite-title">Site Title</Label>
        <Input
          id="nsite-title"
          value={siteTitle}
          onChange={(e) => handleSiteTitleChange(e.target.value)}
          placeholder="My Nostr Site"
        />
        <p className="text-xs text-muted-foreground">
          {siteType === 'named'
            ? 'Used as the site title and to derive the named-site identifier.'
            : 'Shown by nsite gateways and directories.'}
        </p>
      </div>

      {/* Site description */}
      <div className="space-y-2">
        <Label htmlFor="nsite-description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          id="nsite-description"
          value={siteDescription}
          onChange={(e) => handleSiteDescriptionChange(e.target.value)}
          placeholder="A short description of this site…"
          rows={3}
        />
      </div>
    </div>
  );
}
