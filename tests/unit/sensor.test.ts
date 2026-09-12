import { describe, expect, it } from 'vitest';
import { decodeHumidity, decodeTemperature, isBluetoothSupported } from '@/lib/sensor';

const int16 = (n: number) => {
  const view = new DataView(new ArrayBuffer(2));
  view.setInt16(0, n, true);
  return view;
};
const uint16 = (n: number) => {
  const view = new DataView(new ArrayBuffer(2));
  view.setUint16(0, n, true);
  return view;
};

describe('sensor value decoding', () => {
  it('reads temperature in hundredths of a degree, including below zero', () => {
    expect(decodeTemperature(int16(2280))).toBe(22.8);
    expect(decodeTemperature(int16(-525))).toBe(-5.25);
  });

  it('reads humidity in hundredths of a percent', () => {
    expect(decodeHumidity(uint16(4750))).toBe(47.5);
    expect(decodeHumidity(uint16(10000))).toBe(100);
  });

  it('reports no Bluetooth support outside a browser', () => {
    expect(isBluetoothSupported()).toBe(false);
  });
});
