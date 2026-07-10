import { Cloud, CloudDownload, CloudUpload, Lock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNostrSettingsSync } from '@/hooks/useNostrSettingsSync';
import { useToast } from '@/hooks/useToast';

/**
 * Settings sync panel using NIP-78 (kind 30078) with NIP-44 self-encryption.
 *
 * All data (including API keys) is encrypted to the user's own Nostr key
 * before being published to relays, so relay operators cannot read it.
 */
export function NostrSettingsSync() {
  const { upload, download, status, error, lastSyncedAt, isLoggedIn, hasNip44 } = useNostrSettingsSync();
  const { toast } = useToast();

  const isLoading = status === 'uploading' || status === 'downloading';

  const handleUpload = async () => {
    try {
      await upload();
      toast({
        title: 'Settings uploaded',
        description: 'Your settings have been encrypted and saved to Nostr.',
      });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async () => {
    try {
      await download();
      toast({
        title: 'Settings downloaded',
        description: 'Your settings have been restored from Nostr.',
      });
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Nostr Settings Sync
        </CardTitle>
        <CardDescription>
          Back up and restore all your settings via Nostr (NIP-78). Settings are encrypted
          with your Nostr key before being stored on relays — API keys and passwords are
          never readable by relay operators.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Encryption notice */}
        <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            All settings are encrypted with NIP-44 to your own Nostr key. Only you can read them.
          </span>
        </div>

        {/* Not logged in */}
        {!isLoggedIn && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You must be logged in with a Nostr account to use settings sync.
              Log in from <strong>Settings → Nostr</strong>.
            </AlertDescription>
          </Alert>
        )}

        {/* Logged in but signer lacks NIP-44 */}
        {isLoggedIn && !hasNip44 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your Nostr signer does not support NIP-44 encryption. Please upgrade your
              signer extension or use a different login method (e.g. paste your nsec).
            </AlertDescription>
          </Alert>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success state */}
        {status === 'success' && lastSyncedAt && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Last synced: {lastSyncedAt.toLocaleTimeString()}</span>
          </div>
        )}

        {/* What gets synced */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
          <p className="font-medium text-muted-foreground mb-1">What gets synced:</p>
          <ul className="space-y-0.5 text-muted-foreground">
            <li>• <strong>AI settings</strong> — providers, API keys, model preferences</li>
            <li>• <strong>Git settings</strong> — credentials, author name & email</li>
            <li>• <strong>Deploy settings</strong> — provider configurations & API keys</li>
            <li>• <strong>App settings</strong> — theme, relays, language, system prompt</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleUpload}
            disabled={!isLoggedIn || !hasNip44 || isLoading}
            className="flex-1 gap-2"
          >
            {status === 'uploading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            {status === 'uploading' ? 'Uploading…' : 'Upload to Nostr'}
          </Button>

          <Button
            onClick={handleDownload}
            disabled={!isLoggedIn || !hasNip44 || isLoading}
            variant="outline"
            className="flex-1 gap-2"
          >
            {status === 'downloading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            {status === 'downloading' ? 'Downloading…' : 'Download from Nostr'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Settings are stored as NIP-78 kind 30078 addressable events on your configured write relays.
          Each settings group is a separate event identified by its <code>d</code> tag.
        </p>
      </CardContent>
    </Card>
  );
}
