import { describe, expect, it } from 'vitest';
import { WeatherError, buildWeatherUrl, parseWeather } from '@/lib/weather';

describe('buildWeatherUrl', () => {
  it('asks Open-Meteo for current temperature and humidity at the location', () => {
    const url = new URL(buildWeatherUrl(19.076, 72.8777));
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('19.0760');
    expect(url.searchParams.get('longitude')).toBe('72.8777');
    expect(url.searchParams.get('current')).toBe('temperature_2m,relative_humidity_2m');
  });
});

describe('parseWeather', () => {
  it('reads and rounds the current values', () => {
    expect(parseWeather({ current: { temperature_2m: 29.46, relative_humidity_2m: 78.6 } })).toEqual({
      temperatureC: 29.5,
      humidityPct: 79,
    });
  });

  it('rejects unexpected answers with a plain message', () => {
    for (const bad of [null, {}, { current: {} }, { current: { temperature_2m: '29', relative_humidity_2m: 70 } }]) {
      expect(() => parseWeather(bad)).toThrow(WeatherError);
    }
    expect(() => parseWeather({})).toThrow('The weather service sent an unexpected answer.');
  });
});
