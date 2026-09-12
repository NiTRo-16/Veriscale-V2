// Reads temperature and humidity from a Bluetooth lab probe that uses the
// standard environmental sensing profile. Works in Chrome and Edge only.

export const ESS_SERVICE = 0x181a;
export const TEMPERATURE_CHAR = 0x2a6e; // signed 16-bit, 0.01 °C
export const HUMIDITY_CHAR = 0x2a6f; // unsigned 16-bit, 0.01 %

export function decodeTemperature(view: DataView): number {
  return view.getInt16(0, true) / 100;
}

export function decodeHumidity(view: DataView): number {
  return view.getUint16(0, true) / 100;
}

// Minimal Web Bluetooth shapes (not part of TypeScript's DOM library).
interface CharacteristicLike extends EventTarget {
  value?: DataView;
  readValue(): Promise<DataView>;
  startNotifications(): Promise<unknown>;
}
interface ServiceLike {
  getCharacteristic(uuid: number): Promise<CharacteristicLike>;
}
interface ServerLike {
  getPrimaryService(uuid: number): Promise<ServiceLike>;
  disconnect(): void;
}
interface DeviceLike extends EventTarget {
  name?: string;
  gatt?: { connect(): Promise<ServerLike> };
}
interface BluetoothLike {
  requestDevice(options: { filters: Array<{ services: number[] }> }): Promise<DeviceLike>;
}

function bluetooth(): BluetoothLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
}

export function isBluetoothSupported(): boolean {
  return Boolean(bluetooth()) && typeof window !== 'undefined' && window.isSecureContext;
}

export class SensorError extends Error {
  constructor(
    message: string,
    readonly cancelled = false,
  ) {
    super(message);
  }
}

export interface SensorHandlers {
  onTemperature(celsius: number): void;
  onHumidity(percent: number): void;
  onDisconnect(): void;
}

export interface SensorConnection {
  name: string;
  disconnect(): void;
}

export async function connectSensor(handlers: SensorHandlers): Promise<SensorConnection> {
  const bt = bluetooth();
  if (!bt) throw new SensorError("This browser can't connect to sensors. Use Chrome or Edge.");

  let device: DeviceLike;
  try {
    device = await bt.requestDevice({ filters: [{ services: [ESS_SERVICE] }] });
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') throw new SensorError('No sensor was chosen.', true);
    throw new SensorError("Couldn't open the sensor list.");
  }
  if (!device.gatt) throw new SensorError("That device isn't a supported sensor.");

  let server: ServerLike;
  let service: ServiceLike;
  try {
    server = await device.gatt.connect();
    service = await server.getPrimaryService(ESS_SERVICE);
  } catch {
    throw new SensorError("Couldn't connect to that sensor. Make sure it's switched on and nearby.");
  }

  const subscribe = async (uuid: number, decode: (v: DataView) => number, handler: (n: number) => void) => {
    let characteristic: CharacteristicLike;
    try {
      characteristic = await service.getCharacteristic(uuid);
    } catch {
      return false;
    }
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const value = (event.target as CharacteristicLike).value;
      if (value) handler(decode(value));
    });
    const first = await characteristic.readValue().catch(() => null);
    if (first) handler(decode(first));
    await characteristic.startNotifications().catch(() => undefined);
    return true;
  };

  const hasTemperature = await subscribe(TEMPERATURE_CHAR, decodeTemperature, handlers.onTemperature);
  const hasHumidity = await subscribe(HUMIDITY_CHAR, decodeHumidity, handlers.onHumidity);
  if (!hasTemperature && !hasHumidity) {
    server.disconnect();
    throw new SensorError("That sensor doesn't share temperature or humidity.");
  }

  device.addEventListener('gattserverdisconnected', () => handlers.onDisconnect());
  return { name: device.name || 'Sensor', disconnect: () => server.disconnect() };
}
