'use client';

import { Info, Plus, Trash2 } from 'lucide-react';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { ResultText } from '@/components/ui/Pill';
import type { ReadingCalc } from '@/lib/calc';
import { formatAllowed, formatGrams } from '@/lib/format';
import { TEST_TYPES } from '@/lib/labels';
import type { DraftForm, ReadingDraftRow } from './draft-form';

const cellClass =
  'h-8 w-28 rounded-md border border-line-strong bg-card px-2 text-right font-mono text-[13px] tabular text-ink focus:border-green focus:outline-none';

export function ReadingsTable({
  form,
  readings,
  calcs,
  setReadings,
}: {
  form: DraftForm;
  readings: ReadingDraftRow[];
  calcs: ReadingCalc[];
  setReadings: Dispatch<SetStateAction<ReadingDraftRow[]>>;
}) {
  const [newType, setNewType] = useState(TEST_TYPES[0].name);

  const update = (id: string, patch: Partial<ReadingDraftRow>) =>
    setReadings((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => setReadings((rows) => rows.filter((r) => r.id !== id));
  const add = () => {
    const type = TEST_TYPES.find((t) => t.name === newType) ?? TEST_TYPES[0];
    setReadings((rows) => [
      ...rows,
      { id: crypto.randomUUID(), test_type: type.name, clause: type.clause, load_kg: '', reference_kg: '', indicated_kg: '' },
    ]);
  };

  const ready = form.accuracy_class && form.interval_e_g;

  return (
    <Card title="Readings" subtitle="Error, allowed error and result update as you type." bodyClassName="p-0">
      <div className="flex items-center gap-2 border-b border-line bg-page px-5 py-2.5 text-[12.5px] text-muted">
        <Info size={14} className="shrink-0" />
        {ready ? (
          <span>
            Class <strong className="text-ink">{form.accuracy_class}</strong>
            {form.max_capacity_kg && (
              <>
                {' '}
                · Max <span className="font-mono text-ink">{form.max_capacity_kg} kg</span>
              </>
            )}{' '}
            · e = <span className="font-mono text-ink">{form.interval_e_g} g</span>
          </span>
        ) : (
          <span>Fill in the accuracy class and verification interval to see results.</span>
        )}
      </div>

      {readings.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted">No readings yet. Add the first one below.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-[13px]">
            <thead className="text-left text-[11.5px] text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">Test</th>
                <th className="px-2 py-2 text-right font-medium">Load (kg)</th>
                <th className="px-2 py-2 text-right font-medium">Reference (kg)</th>
                <th className="px-2 py-2 text-right font-medium">Indicated (kg)</th>
                <th className="px-2 py-2 text-right font-medium">Error</th>
                <th className="px-2 py-2 text-right font-medium">Allowed error</th>
                <th className="px-2 py-2 font-medium">Result</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {readings.map((r, i) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-2">
                    <div className="font-medium text-ink">{r.test_type}</div>
                    <div className="text-[11.5px] text-muted">{r.clause}</div>
                  </td>
                  {(['load_kg', 'reference_kg', 'indicated_kg'] as const).map((key) => (
                    <td key={key} className="px-2 py-2 text-right">
                      <input
                        aria-label={`${r.test_type} ${key.replace('_kg', '')} in kg, row ${i + 1}`}
                        inputMode="decimal"
                        className={cellClass}
                        value={r[key]}
                        onChange={(e) => update(r.id, { [key]: e.target.value })}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-mono tabular">{formatGrams(calcs[i]?.errorG)}</td>
                  <td className="px-2 py-2 text-right font-mono tabular">{formatAllowed(calcs[i]?.allowedErrorG)}</td>
                  <td className="px-2 py-2">
                    <ResultText result={calcs[i]?.result ?? null} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      aria-label={`Remove row ${i + 1}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-soft hover:text-red"
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        <Select aria-label="Test type for the new reading" className="w-64" value={newType} onChange={(e) => setNewType(e.target.value)}>
          {TEST_TYPES.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} · {t.clause}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={add}>
          <Plus size={16} strokeWidth={2} /> Add reading
        </Button>
      </div>
    </Card>
  );
}
