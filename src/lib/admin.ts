import { formatCount } from './format';
import type { AllowedErrorRule, Role } from './types';

const ROLES: readonly Role[] = ['technician', 'reviewer', 'admin'];

export const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v);

export interface NewUserInput {
  fullName: string;
  email: string;
  password: string;
  role: string;
}

/** A plain message for the first problem with a new user, or null. */
export function validateNewUser(input: NewUserInput): string | null {
  if (!input.fullName?.trim()) return "Enter the person's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email?.trim() ?? '')) return 'Enter a valid email address.';
  if ((input.password ?? '').length < 8) return 'The temporary password needs at least 8 characters.';
  if (!isRole(input.role)) return 'Choose a role.';
  return null;
}

/** "0 – 500", "500 – 2,000", "above 2,000" */
export function ruleRangeLabel(rule: Pick<AllowedErrorRule, 'min_n' | 'max_n'>): string {
  return rule.max_n === null ? `above ${formatCount(rule.min_n)}` : `${formatCount(rule.min_n)} – ${formatCount(rule.max_n)}`;
}

/** 0.5 → "0.5", 1 → "1.0", 1.25 → "1.25" */
export function multiplierLabel(multiplier: number): string {
  return multiplier.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
}
