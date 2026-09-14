// Turns database error codes (raised by our triggers and functions) and
// access-rule failures into plain sentences for the interface.
import { STATUS_LABEL } from './labels';
import type { ReportStatus } from './types';

const MESSAGES: Record<string, string> = {
  REPORT_LOCKED: 'This report has been submitted and can no longer be changed.',
  REPORT_NOT_DRAFT: 'This report has already been submitted.',
  REPORT_NOT_FOUND: 'This report could not be found.',
  NOT_OWNER: 'Only the person who created this report can do that.',
  RESULTS_MISMATCH: 'The readings changed while submitting. Please try again.',
  NOT_ALLOWED: "You don't have access to do this.",
  NOT_SUBMITTED: "This report hasn't been submitted yet.",
  APPROVE_NOT_ALLOWED: "A report whose readings failed can't be approved.",
  NOTE_REQUIRED: 'Please add a note explaining why this report fails.',
  SEND_BACK_NOTE_MISSING: 'Please add a note telling the technician what to change.',
  BAD_VALUE: "That value isn't valid.",
  RULE_NOT_FOUND: 'That rule no longer exists.',
  DRAFTS_ONLY: 'Only drafts can be deleted.',
  BAD_STATUS_CHANGE: "That change isn't allowed.",
  READ_ONLY_FIELD: "That can't be changed.",
  WEIGHTS_OVERDUE: "This weight set is overdue for its check and can't be used in new tests.",
  NAME_TAKEN: 'That name is already in use.',
  RECORD_NOT_FOUND: 'That record could not be found.',
};

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

function messageOf(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return '';
}

export function friendlyError(err: unknown): string {
  const message = messageOf(err);

  const reviewed = message.match(/ALREADY_REVIEWED\|(\w+)\|(.+)$/);
  if (reviewed) {
    const status = STATUS_LABEL[reviewed[1] as ReportStatus]?.toLowerCase() ?? 'reviewed';
    return `This report was already ${status} by ${reviewed[2].trim()}.`;
  }

  for (const [code, text] of Object.entries(MESSAGES)) {
    if (new RegExp(`\\b${code}\\b`).test(message)) return text;
  }

  if (/permission denied|row-level security/i.test(message)) return MESSAGES.NOT_ALLOWED;
  return GENERIC_ERROR;
}
