import { KeyRound, Lock, Scale, UserX } from 'lucide-react';
import type { ReactNode } from 'react';

function CenteredNotice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-card border border-line bg-card p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-hover text-ink-soft">{icon}</div>
        <h1 className="text-[16px] font-semibold text-ink">{title}</h1>
        <div className="mt-2 text-[13px] leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  );
}

export function NoAccess() {
  return (
    <CenteredNotice icon={<Lock size={20} strokeWidth={1.75} />} title="You don't have access to this page">
      This page is for a different role. If you think you should have access, ask your lab admin.
    </CenteredNotice>
  );
}

export function AccountNotReady() {
  return (
    <CenteredNotice icon={<UserX size={20} strokeWidth={1.75} />} title="Your account isn't set up yet">
      You're signed in, but no role has been given to this account. Ask your lab admin to add you.
    </CenteredNotice>
  );
}

export function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <div className="max-w-lg rounded-card border border-line bg-card p-8 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white">
            <Scale size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold text-ink">VeriScale needs to be connected</h1>
            <p className="text-[12px] text-muted">One-time setup</p>
          </div>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-ink-soft">
          <li>Create a Supabase project and run the files in <code>supabase/migrations</code> in order.</li>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in the project address and keys.
          </li>
          <li>Restart the app, then create the first admin with <code>npm run create-first-admin</code>.</li>
        </ol>
        <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
          <KeyRound size={14} /> Full steps are in the README.
        </p>
      </div>
    </div>
  );
}
