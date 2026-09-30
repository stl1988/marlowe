import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import {
  Zap,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  DollarSign,
  Loader2,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AIProvider } from '@/contexts/AISettingsContext';
import { useAICredits, aiCreditsQueryKey } from '@/hooks/useAICredits';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useWallet } from '@/hooks/useWallet';
import { useNWC } from '@/hooks/useNWCContext';
import { useToast } from '@/hooks/useToast';
import {
  createPPQTopup,
  fetchPPQBalance,
  fetchPPQTopupStatus,
  PPQ_TOPUP_METHODS,
  type PPQTopup,
  type PPQTopupMethod,
} from '@/lib/ppq';

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

interface PPQCreditsContentProps {
  provider: AIProvider;
}

/**
 * Credits management for PayPerQ: shows the current balance and lets the
 * user top up via Lightning (or other crypto methods) without leaving the
 * app. https://ppq.ai/api-docs
 */
export function PPQCreditsContent({ provider }: PPQCreditsContentProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { webln } = useWallet();
  const { sendPayment: nwcSendPayment, getActiveConnection } = useNWC();

  const credits = useAICredits(provider);

  const [amount, setAmount] = useState<number>(10);
  const [method, setMethod] = useState<PPQTopupMethod>('btc-lightning');
  const [invoice, setInvoice] = useState<PPQTopup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const balanceAtStartRef = useRef<number | null>(null);

  const selectedMethod = PPQ_TOPUP_METHODS.find((m) => m.id === method) ?? PPQ_TOPUP_METHODS[0];

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }, []);

  const refreshBalance = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: aiCreditsQueryKey(provider, user?.pubkey) });
  }, [queryClient, provider, user?.pubkey]);

  // Generate QR code when a Lightning invoice is available
  useEffect(() => {
    if (!invoice?.bolt11) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(invoice.bolt11, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [invoice?.bolt11]);

  // Poll the topup status while waiting for payment.
  // Falls back to watching the balance when the invoice has no pollable id.
  useEffect(() => {
    if (!invoice || !isWaiting) return;

    let cancelled = false;

    const poll = async () => {
      try {
        if (invoice.id) {
          const status = await fetchPPQTopupStatus(provider, invoice.id);
          if (cancelled) return;
          if (status.paid) {
            setIsWaiting(false);
            setInvoice(null);
            refreshBalance();
            toast({
              title: t('paymentReceived'),
              description: t('creditsAddedToAccount', { amount: formatCurrency(amount) }),
            });
            return;
          }
          if (status.failed) {
            setIsWaiting(false);
            setError(t('topupFailed'));
            return;
          }
        } else {
          // No invoice id — watch the balance instead
          const balance = await fetchPPQBalance(provider);
          if (cancelled) return;
          const start = balanceAtStartRef.current;
          if (start !== null && balance > start) {
            setIsWaiting(false);
            setInvoice(null);
            refreshBalance();
            toast({
              title: t('paymentReceived'),
              description: t('creditsAddedToAccount', { amount: formatCurrency(balance - start) }),
            });
            return;
          }
        }
      } catch (pollError) {
        console.warn('Topup status poll failed:', pollError);
      }
    };

    const intervalId = setInterval(poll, 4000);
    poll();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [invoice, isWaiting, provider, refreshBalance, toast, t, amount, formatCurrency]);

  const handleCreateInvoice = async () => {
    setIsCreating(true);
    setError(null);
    try {
      balanceAtStartRef.current = credits.data?.amount ?? null;
      const created = await createPPQTopup(provider, method, amount);
      setInvoice(created);
      setIsWaiting(true);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreating(false);
    }
  };

  const handleWalletPay = async () => {
    if (!invoice?.bolt11) return;

    const nwcConnection = getActiveConnection();
    const canNWC = !!nwcConnection?.isConnected;
    if (!canNWC && !webln) return;

    setIsPaying(true);
    try {
      if (canNWC && nwcConnection) {
        await nwcSendPayment(nwcConnection, invoice.bolt11);
      } else if (webln) {
        await webln.sendPayment(invoice.bolt11);
      }
      // Payment sent — the status poller will confirm and update the balance.
    } catch (payError) {
      toast({
        title: t('paymentFailed'),
        description: payError instanceof Error ? payError.message : String(payError),
        variant: 'destructive',
      });
    } finally {
      setIsPaying(false);
    }
  };

  const handleCopyInvoice = async () => {
    if (!invoice?.bolt11) return;
    try {
      await navigator.clipboard.writeText(invoice.bolt11);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Failed to copy invoice:', copyError);
    }
  };

  const handleBack = () => {
    setInvoice(null);
    setIsWaiting(false);
    setError(null);
    refreshBalance();
  };

  if (!provider.apiKey) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>{t('ppqApiKeyRequired')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {/* Balance display */}
      <div className="text-center py-6 pb-7 relative">
        <div className="text-sm text-muted-foreground mb-2">{t('availableCredits')}</div>
        <div className="text-3xl font-bold">
          {credits.data ? formatCurrency(credits.data.amount) : '—'}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshBalance}
          disabled={credits.isFetching}
          className="absolute right-0 top-4 h-8 w-8 p-0"
          aria-label={t('refreshBalance')}
        >
          <RefreshCw className={`h-4 w-4 ${credits.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {invoice ? (
        /* Invoice view */
        <div className="space-y-4 px-1 pb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </button>

          {invoice.bolt11 && qrDataUrl && (
            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-lg">
                <img src={qrDataUrl} alt="Lightning invoice QR code" className="w-48 h-48" />
              </div>
            </div>
          )}

          {invoice.bolt11 && (
            <div className="space-y-2">
              <div className="p-3 bg-muted rounded-md font-mono text-xs break-all max-h-24 overflow-y-auto">
                {invoice.bolt11}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyInvoice} className="flex-1">
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? t('copied') : t('copyInvoice')}
                </Button>
                {(webln || getActiveConnection()?.isConnected) && (
                  <Button size="sm" onClick={handleWalletPay} disabled={isPaying} className="flex-1">
                    {isPaying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
                    {t('payWithWallet')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {invoice.address && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('sendToAddress')}</Label>
              <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
                {invoice.address}
              </div>
            </div>
          )}

          {invoice.checkoutUrl && (
            <Button variant="outline" className="w-full" asChild>
              <a href={invoice.checkoutUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('openCheckout')}
              </a>
            </Button>
          )}

          {isWaiting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('waitingForPayment')}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>
      ) : (
        /* Topup form */
        <div className="space-y-4 px-1 pb-4">
          <div className="space-y-3">
            <Label htmlFor="ppq-amount" className="text-sm font-medium">{t('amountUSD')}</Label>
            <Input
              id="ppq-amount"
              type="number"
              step="0.01"
              min={selectedMethod.minUsd}
              max={selectedMethod.maxUsd}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder={t('enterAmount')}
              className="text-center text-lg font-medium"
            />
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAmount(preset)}
                  className="text-xs"
                >
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('paymentMethod')}</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PPQTopupMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PPQ_TOPUP_METHODS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      {m.id === 'btc-lightning' && <Zap className="h-3.5 w-3.5" />}
                      {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('topupLimits', { min: formatCurrency(selectedMethod.minUsd), max: formatCurrency(selectedMethod.maxUsd) })}
              {method === 'btc-lightning' ? ` · ${t('lightningBonus')}` : ''}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <Button
            onClick={handleCreateInvoice}
            disabled={amount < selectedMethod.minUsd || amount > selectedMethod.maxUsd || isCreating}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4 mr-2" />
            )}
            {t('generateInvoice')}
            {amount > 0 ? ` - ${formatCurrency(amount)}` : ''}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {t('ppqCardHint')}{' '}
            <a
              href="https://ppq.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              ppq.ai
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
