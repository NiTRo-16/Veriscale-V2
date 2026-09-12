'use client';

import { Bluetooth, BluetoothOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SensorError, connectSensor, isBluetoothSupported, type SensorConnection } from '@/lib/sensor';

type State = 'idle' | 'connecting' | 'connected' | 'disconnected';

export function SensorButton({
  onTemperature,
  onHumidity,
  onError,
}: {
  onTemperature: (celsius: number) => void;
  onHumidity: (percent: number) => void;
  onError: (message: string | null) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [name, setName] = useState('');
  const connection = useRef<SensorConnection | null>(null);

  // Checked after mounting so server and browser render the same thing.
  useEffect(() => setSupported(isBluetoothSupported()), []);
  useEffect(() => () => connection.current?.disconnect(), []);

  if (!supported) return null;

  const connect = async () => {
    onError(null);
    setState('connecting');
    try {
      const conn = await connectSensor({ onTemperature, onHumidity, onDisconnect: () => setState('disconnected') });
      connection.current = conn;
      setName(conn.name);
      setState('connected');
    } catch (err) {
      setState(connection.current ? 'disconnected' : 'idle');
      if (err instanceof SensorError && err.cancelled) return;
      onError(err instanceof SensorError ? err.message : "Couldn't connect to the sensor.");
    }
  };

  if (state === 'connected') {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-8 items-center gap-2 rounded-lg border border-green/30 bg-green-soft px-3 text-[12.5px] font-medium text-green-ink">
          <span className="h-2 w-2 rounded-full bg-green" />
          {name} connected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            connection.current?.disconnect();
            connection.current = null;
            setState('idle');
          }}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  if (state === 'disconnected') {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-soft px-3 text-[12.5px] font-medium text-amber-ink">
          <BluetoothOff size={14} /> Sensor disconnected
        </span>
        <Button variant="secondary" size="sm" onClick={connect}>
          Reconnect
        </Button>
      </div>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={connect} disabled={state === 'connecting'}>
      <Bluetooth size={15} strokeWidth={1.75} />
      {state === 'connecting' ? 'Connecting…' : 'Connect sensor'}
    </Button>
  );
}
