import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'

import 'dayjs/locale/es-mx'

function initialize (): void {
  dayjs.extend(utc)
  dayjs.extend(timezone)
  const tz = process.env.SYS_TZ ?? 'America/Mexico_City'
  dayjs.tz.setDefault(tz)
  dayjs.locale(process.env.LOCALE ?? 'es-mx')
  dayjs.extend(quarterOfYear)
  dayjs.extend(customParseFormat)
  dayjs.extend(isSameOrAfter)
}

export {
  initialize,
  dayjs
}
