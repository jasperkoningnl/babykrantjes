// Open-Meteo Historical Weather API
// Documentatie: https://open-meteo.com/en/docs/historical-weather-api

import { getCityCoordinates } from './cities'

export interface WeatherData {
  date: string
  city: string
  temperature_max: number
  temperature_min: number
  precipitation: number
  sunshine_duration: number
  windspeed_max: number
  description: string
}

/**
 * Haal historisch weerbericht op voor een specifieke datum en plaats
 */
export async function getHistoricalWeather(
  date: string,
  cityName: string
): Promise<WeatherData | null> {
  try {
    const coordinates = getCityCoordinates(cityName)
    
    const url = new URL('https://archive-api.open-meteo.com/v1/archive')
    url.searchParams.set('latitude', coordinates.lat.toString())
    url.searchParams.set('longitude', coordinates.lon.toString())
    url.searchParams.set('start_date', date)
    url.searchParams.set('end_date', date)
    url.searchParams.set('daily', [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'sunshine_duration',
      'windspeed_10m_max'
    ].join(','))
    url.searchParams.set('timezone', 'Europe/Amsterdam')

    const response = await fetch(url.toString())
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.daily) {
      throw new Error('No weather data available for this date')
    }

    const weather: WeatherData = {
      date,
      city: coordinates.name,
      temperature_max: Math.round(data.daily.temperature_2m_max[0]),
      temperature_min: Math.round(data.daily.temperature_2m_min[0]),
      precipitation: Math.round(data.daily.precipitation_sum[0] * 10) / 10,
      sunshine_duration: Math.round(data.daily.sunshine_duration[0] / 3600 * 10) / 10,
      windspeed_max: Math.round(data.daily.windspeed_10m_max[0]),
      description: generateWeatherDescription(
        data.daily.temperature_2m_max[0],
        data.daily.precipitation_sum[0],
        data.daily.sunshine_duration[0] / 3600
      )
    }

    return weather
  } catch (error) {
    console.error('Error fetching weather data:', error)
    return null
  }
}

function generateWeatherDescription(
  tempMax: number,
  precipitation: number,
  sunshineHours: number
): string {
  let description = ''

  if (tempMax < 5) {
    description = 'Het was koud'
  } else if (tempMax < 12) {
    description = 'Het was fris'
  } else if (tempMax < 20) {
    description = 'Het was aangenaam'
  } else if (tempMax < 25) {
    description = 'Het was zonnig en warm'
  } else {
    description = 'Het was heet'
  }

  if (precipitation > 10) {
    description += ' met veel regen'
  } else if (precipitation > 2) {
    description += ' met enkele buien'
  } else if (precipitation > 0.5) {
    description += ' met een beetje regen'
  }

  if (sunshineHours > 8) {
    description += ' en volop zon'
  } else if (sunshineHours > 5 && precipitation < 1) {
    description += ' en redelijk zonnig'
  } else if (sunshineHours < 2) {
    description += ' en grotendeels bewolkt'
  }

  return description + '.'
}

export function formatWeatherReport(weather: WeatherData): string {
  return `${weather.description} De temperatuur lag tussen ${weather.temperature_min}°C en ${weather.temperature_max}°C. Er viel ${weather.precipitation}mm neerslag en de zon scheen ${weather.sunshine_duration} uur.`
}