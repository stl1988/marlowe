import type { AIProvider } from '@/contexts/AISettingsContext';

/**
 * PayPerQ (ppq.ai) helpers.
 *
 * PayPerQ is an OpenAI-compatible AI gateway with prepaid credit billing.
 * Chat completions live under `{baseURL}/chat/completions` (or `/v1/...`),
 * while account endpoints (balance, topups) live at the API root
 * (`https://api.ppq.ai/credits/balance`, `/topup/create/...`).
 *
 * Docs: https://ppq.ai/api-docs
 */

/** Check whether a provider points at PayPerQ (preset id or any *.ppq.ai host). */
export function isPPQProvider(provider: AIProvider): boolean {
  if (provider.id === 'ppq') return true;
  try {
    const { hostname } = new URL(provider.baseURL);
    return hostname === 'ppq.ai' || hostname.endsWith('.ppq.ai');
  } catch {
    return false;
  }
}

/** API root for account endpoints (strips any path such as `/v1` from the baseURL). */
export function ppqApiRoot(baseURL: string): string {
  try {
    return new URL(baseURL).origin;
  } catch {
    return 'https://api.ppq.ai';
  }
}

/** Payment methods supported by PPQ topups. */
export const PPQ_TOPUP_METHODS = [
  { id: 'btc-lightning', label: 'Bitcoin Lightning', minUsd: 0.1, maxUsd: 1000 },
  { id: 'btc', label: 'Bitcoin (on-chain)', minUsd: 10, maxUsd: 10000 },
  { id: 'ltc', label: 'Litecoin', minUsd: 2, maxUsd: 1000 },
  { id: 'lbtc', label: 'Liquid Bitcoin', minUsd: 2, maxUsd: 10000 },
  { id: 'xmr', label: 'Monero', minUsd: 5, maxUsd: 10000 },
] as const;

export type PPQTopupMethod = (typeof PPQ_TOPUP_METHODS)[number]['id'];

async function ppqFetch(
  provider: AIProvider,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const url = `${ppqApiRoot(provider.baseURL)}${path}`;
  const headers = new Headers(init.headers);
  if (provider.apiKey) {
    headers.set('Authorization', `Bearer ${provider.apiKey}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();

  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' &&
        ((data as Record<string, unknown>).message ?? (data as Record<string, unknown>).error)) ||
      `HTTP ${res.status}`;
    throw new Error(`PayPerQ: ${String(message)}`);
  }

  return data;
}

/** Find the first finite numeric value among candidate keys (also looks one level into `data`). */
function findNumber(data: unknown, keys: string[]): number | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const nested = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : undefined;

  for (const key of keys) {
    for (const source of [obj, nested]) {
      const value = source?.[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
        return Number(value);
      }
    }
  }
  return undefined;
}

/** Find the first non-empty string among candidate keys (also looks one level into `data`). */
function findString(data: unknown, keys: string[]): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const nested = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : undefined;

  for (const key of keys) {
    for (const source of [obj, nested]) {
      const value = source?.[key];
      if (typeof value === 'string' && value.trim() !== '') return value;
    }
  }
  return undefined;
}

/**
 * Fetch the current credit balance in USD.
 *
 * `POST /credits/balance`, authenticated with the API key
 * (`Authorization: Bearer sk-...`). The exact response shape is not
 * documented, so we accept several common field names.
 */
export async function fetchPPQBalance(provider: AIProvider): Promise<number> {
  if (!provider.apiKey) {
    throw new Error('PayPerQ: API key required');
  }

  const data = await ppqFetch(provider, '/credits/balance', {
    method: 'POST',
    body: '{}',
  });

  const balance = findNumber(data, [
    'balance_usd',
    'balance',
    'amount',
    'credits',
    'credit_balance',
    'usd',
  ]);

  if (balance === undefined) {
    throw new Error('PayPerQ: unexpected balance response');
  }

  return balance;
}

export interface PPQTopup {
  /** Invoice/payment identifier used for status polling, if present. */
  id?: string;
  /** BOLT11 Lightning invoice, if this was a Lightning topup. */
  bolt11?: string;
  /** Hosted checkout URL, if present. */
  checkoutUrl?: string;
  /** Crypto address to pay to (on-chain methods), if present. */
  address?: string;
  /** Raw response for display/fallback purposes. */
  raw: unknown;
}

/** Create a topup invoice. `POST /topup/create/{method}` with `{amount, currency: 'USD'}`. */
export async function createPPQTopup(
  provider: AIProvider,
  method: PPQTopupMethod,
  amountUsd: number,
): Promise<PPQTopup> {
  if (!provider.apiKey) {
    throw new Error('PayPerQ: API key required');
  }

  const data = await ppqFetch(provider, `/topup/create/${method}`, {
    method: 'POST',
    body: JSON.stringify({ amount: amountUsd, currency: 'USD' }),
  });

  const bolt11 = findString(data, ['bolt11', 'payment_request', 'paymentRequest', 'invoice', 'pr', 'lightning_invoice']);
  const id = findString(data, ['invoice_id', 'invoiceId', 'id', 'payment_id'])
    // BTCPay-style responses sometimes nest the id alongside the invoice string
    ?? (bolt11 ? findString(data, ['invoice_id', 'invoiceId', 'id']) : undefined);
  const checkoutUrl = findString(data, ['checkout_url', 'checkoutLink', 'checkout_link', 'checkout', 'url', 'link']);
  const address = findString(data, ['address', 'pay_to', 'deposit_address']);

  return { id, bolt11, checkoutUrl, address, raw: data };
}

export interface PPQTopupStatus {
  /** True when the invoice is paid/settled/completed. */
  paid: boolean;
  /** True when the invoice expired or failed. */
  failed: boolean;
  raw: unknown;
}

/** Poll the status of a topup invoice. `GET /topup/status/{invoice_id}`. */
export async function fetchPPQTopupStatus(
  provider: AIProvider,
  invoiceId: string,
): Promise<PPQTopupStatus> {
  if (!provider.apiKey) {
    throw new Error('PayPerQ: API key required');
  }

  const data = await ppqFetch(provider, `/topup/status/${encodeURIComponent(invoiceId)}`);

  const statusText = (
    findString(data, ['status', 'payment_status', 'state']) ?? ''
  ).toLowerCase();

  const paidFlag =
    statusText === 'paid' ||
    statusText === 'settled' ||
    statusText === 'complete' ||
    statusText === 'completed' ||
    statusText === 'confirmed' ||
    (data && typeof data === 'object' &&
      ((data as Record<string, unknown>).paid === true ||
        (data as Record<string, unknown>).settled === true ||
        ((data as Record<string, unknown>).data &&
          typeof (data as Record<string, unknown>).data === 'object' &&
          (((data as Record<string, unknown>).data as Record<string, unknown>).paid === true ||
            ((data as Record<string, unknown>).data as Record<string, unknown>).settled === true))));

  const failedFlag =
    statusText === 'expired' ||
    statusText === 'failed' ||
    statusText === 'invalid' ||
    statusText === 'cancelled' ||
    statusText === 'canceled';

  return { paid: Boolean(paidFlag), failed: failedFlag, raw: data };
}
