// Outdoor weather near the user, as an estimate for test conditions.
// Uses Open-Meteo (free, no key). Values must be confirmed before submitting.

export class WeatherError extends Error {}

export interface WeatherEstimate {
  temperatureC: number;
  humidityPct: number;
}

export function buildWeatherUrl(latitude: number, longitude: number): string {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude.toFixed(4));
  url.searchParams.set('longitude', longitude.toFixed(4));
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m');
  return url.toString();
}

export function parseWeather(json: unknown): WeatherEstimate {
  const current = (json as { current?: Record<string, unknown> } | null)?.current;
  const temperature = current?.temperature_2m;
  const humidity = current?.relative_humidity_2m;
  if (typeof temperature !== 'number' || typeof humidity !== 'number' || !Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    throw new WeatherError('The weather service sent an unexpected answer.');
  }
  return { temperatureC: Math.round(temperature * 10) / 10, humidityPct: Math.round(humidity) };
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new WeatherError("This browser can't share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) =>
        reject(
          new WeatherError(
            err.code === err.PERMISSION_DENIED
              ? "Location access is blocked, so the weather can't be looked up."
              : "Your location couldn't be found.",
          ),
        ),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  });
}

export async function getWeatherEstimate(fetchImpl: typeof fetch = fetch): Promise<WeatherEstimate> {
  const position = await currentPosition();
  let response: Response;
  try {
    response = await fetchImpl(buildWeatherUrl(position.coords.latitude, position.coords.longitude));
  } catch {
    throw new WeatherError("Couldn't reach the weather service.");
  }
  if (!response.ok) throw new WeatherError("Couldn't get the weather right now.");
  return parseWeather(await response.json());
}
