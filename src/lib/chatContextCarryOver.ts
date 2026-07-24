import type { AIMessage } from './SessionManager';

/** Maximum number of characters to include in a carry-over note. */
const MAX_CARRYOVER_CHARS = 4000;

/** Maximum number of recent user/assistant exchanges to consider. */
const MAX_RECENT_MESSAGES = 12;

function getMessageText(message: AIMessage): string {
  const content = (message as { content?: unknown }).content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'type' in item && item.type === 'text') {
          return (item as { text?: string }).text ?? '';
        }
        return '';
      })
      .join('\n');
  }

  return '';
}

/**
 * Build a condensed text summary of the previous conversation to carry over
 * into a new chat session, giving the AI continuity without re-sending the
 * entire (potentially huge) message history.
 *
 * Only user and assistant text messages are considered — tool calls/results
 * are skipped since they tend to be large and are not useful without their
 * corresponding context.
 */
export function buildContextCarryOverNote(messages: AIMessage[]): string {
  const relevant = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, text: getMessageText(m).trim() }))
    .filter((m) => m.text.length > 0);

  if (relevant.length === 0) {
    return '';
  }

  const recent = relevant.slice(-MAX_RECENT_MESSAGES);

  const lines = recent.map((m) => {
    const label = m.role === 'user' ? 'User' : 'Assistant';
    let text = m.text;
    if (text.length > 600) {
      text = `${text.slice(0, 600)}…`;
    }
    return `${label}: ${text}`;
  });

  let body = lines.join('\n\n');
  if (body.length > MAX_CARRYOVER_CHARS) {
    body = `…${body.slice(body.length - MAX_CARRYOVER_CHARS)}`;
  }

  return [
    'Continuing from a previous chat in this project. Here is a recap of the recent conversation for context:',
    '',
    body,
    '',
    'Please keep this context in mind going forward.',
  ].join('\n');
}
