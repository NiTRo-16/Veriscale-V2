'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer size={15} strokeWidth={1.75} />
      Print
    </Button>
  );
}
