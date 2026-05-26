import { addDays, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const ET_TIMEZONE = 'America/New_York'

// Mon-Fri: 8am-8pm ET, Sat: 9am-3pm ET, Sun: closed
const HOURS: Record<number, { open: number; close: number } | null> = {
  0: null,              // Sunday - closed
  1: { open: 8, close: 20 },  // Monday
  2: { open: 8, close: 20 },  // Tuesday
  3: { open: 8, close: 20 },  // Wednesday
  4: { open: 8, close: 20 },  // Thursday
  5: { open: 8, close: 20 },  // Friday
  6: { open: 9, close: 15 },  // Saturday
}

export function isInsuranceOpen(date: Date = new Date()): boolean {
  const et = toZonedTime(date, ET_TIMEZONE)
  const day = et.getDay()
  const hour = et.getHours()
  const minutes = et.getMinutes()
  const timeDecimal = hour + minutes / 60

  const hours = HOURS[day]
  if (!hours) return false
  return timeDecimal >= hours.open && timeDecimal < hours.close
}

export function getNextOpenTime(date: Date = new Date()): Date {
  const et = toZonedTime(date, ET_TIMEZONE)
  let candidate = new Date(et)

  for (let i = 0; i < 8; i++) {
    const day = candidate.getDay()
    const hours = HOURS[day]

    if (hours) {
      // Check if we're before opening today
      const openToday = setMilliseconds(setSeconds(setMinutes(setHours(new Date(candidate), hours.open), 0), 0), 0)
      if (candidate < openToday) {
        return fromZonedTime(openToday, ET_TIMEZONE)
      }
    }

    // Move to next day at open time
    candidate = addDays(candidate, 1)
    candidate = setMilliseconds(setSeconds(setMinutes(setHours(candidate, 0), 0), 0), 0)

    const nextDay = candidate.getDay()
    const nextHours = HOURS[nextDay]
    if (nextHours) {
      const nextOpen = setMilliseconds(setSeconds(setMinutes(setHours(new Date(candidate), nextHours.open), 0), 0), 0)
      return fromZonedTime(nextOpen, ET_TIMEZONE)
    }
  }

  // Fallback: next Monday 8am
  const monday = addDays(et, (8 - et.getDay()) % 7 || 7)
  const mondayOpen = setMilliseconds(setSeconds(setMinutes(setHours(monday, 8), 0), 0), 0)
  return fromZonedTime(mondayOpen, ET_TIMEZONE)
}

export function shouldSchedule(date: Date = new Date()): { schedule: boolean; scheduledFor?: Date } {
  if (isInsuranceOpen(date)) {
    return { schedule: false }
  }
  return { schedule: true, scheduledFor: getNextOpenTime(date) }
}
