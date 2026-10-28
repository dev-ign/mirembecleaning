import { business } from './business'

// Activating state-specific forms requires an explicit configuration/code change.
export const bookingConfig = {
  mode: 'holiday',
  path: '/booking',
  thankYouPath: '/booking/thankyou',
  legacyThankYouPath: '/booking/thank-you',
  scriptUrl: 'https://app.zenmaid.com/scripts/booking-form.js',
  holiday: {
    formId: 'V4Q5E',
    hostedUrl: 'https://app.zenmaid.com/book/mirembe-cleaning-company-holiday',
    basicEmbedUrl: 'https://app.zenmaid.com/booking-forms/V4Q5E/book',
    // Reviewed public paths only; never allow customer/account pages or queries.
    publicReferrerPaths: ['/book/mirembe-cleaning-company-holiday', '/booking-forms/V4Q5E/book', '/booking-forms/V4Q5E/bookings/new'],
  },
  confirmationUrl: new URL('booking/thankyou', business.websiteUrl).href,
} as const
