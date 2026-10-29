import type { TranslationKey } from './index'
// Values sent to the API stay unchanged; only their presentation is localized.
export const hiringOptionKeys = {
  yes: 'hiring.options.yes', no: 'hiring.options.no', none: 'hiring.options.noExperience',
  under_1_year: 'hiring.options.underYear', '1_to_3_years': 'hiring.options.oneToThree', '3_plus_years': 'hiring.options.threePlus',
  english: 'hiring.options.english', spanish: 'hiring.options.spanish', haitian_creole: 'hiring.options.creole', portuguese: 'hiring.options.portuguese', other: 'hiring.options.other',
  under_5_miles: 'hiring.options.underFiveMiles', '10_miles': 'hiring.options.tenMiles', '20_miles': 'hiring.options.twentyMiles', over_25_miles: 'hiring.options.overTwentyFive',
  full_time: 'hiring.options.fullTime', part_time: 'hiring.options.partTime', both: 'hiring.options.both',
} as const satisfies Record<string, TranslationKey>
