import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, History } from 'lucide-react';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether there's any prior conversation to carry over. */
  hasPriorContext: boolean;
  onStartFresh: () => void;
  onCarryOverContext: () => void;
}

/**
 * Confirmation dialog shown whenever the user starts a new chat within a
 * project. Lets them choose whether to carry over a summary of the previous
 * chat's context, or start completely fresh.
 */
export function NewChatDialog({
  open,
  onOpenChange,
  hasPriorContext,
  onStartFresh,
  onCarryOverContext,
}: NewChatDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start a new chat?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasPriorContext
              ? 'This will clear the current conversation. Would you like to carry over a summary of the current chat so the AI keeps context, or start completely fresh?'
              : 'This will clear the current conversation and start a fresh chat session.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onStartFresh}
            className="gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Start Fresh
          </Button>
          {hasPriorContext && (
            <AlertDialogAction onClick={onCarryOverContext} className="gap-2">
              <History className="h-4 w-4" />
              Carry Over Context
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
