'use client';

import { CloudSun } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { WeatherError, getWeatherEstimate, type WeatherEstimate } from '@/lib/weather';

export function WeatherButton({
  onEstimate,
  onError,
}: {
  onEstimate: (estimate: WeatherEstimate) => void;
  onError: (message: string | null) => void;
}) {
  const [pending, setPending] = useState(false);

  const estimate = async () => {
    onError(null);
    setPending(true);
    try {
      onEstimate(await getWeatherEstimate());
    } catch (err) {
      const reason = err instanceof WeatherError ? err.message : "Couldn't get the weather.";
      onError(`${reason} Please type the values instead.`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={estimate} disabled={pending}>
      <CloudSun size={15} strokeWidth={1.75} />
      {pending ? 'Getting weather…' : 'Estimate from weather'}
    </Button>
  );
}
