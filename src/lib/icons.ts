const ICON_KEYWORDS: Array<[RegExp, string]> = [
  [/soccer|football|basketball|baseball|sport|game|match|practice/i, '\u26BD'],
  [/swim/i, '\uD83C\uDFCA'],
  [/dance|ballet|recital/i, '\uD83D\uDC83'],
  [/music|piano|guitar|violin|concert|band/i, '\uD83C\uDFB5'],
  [/school|class|homework|test|exam|study/i, '\uD83D\uDCDA'],
  [/doctor|dentist|appointment|checkup/i, '\uD83C\uDFE5'],
  [/birthday|party|celebrate/i, '\uD83C\uDF82'],
  [/movie|film|theater|show/i, '\uD83C\uDFAC'],
  [/trip|travel|vacation|camping/i, '\u2708\uFE0F'],
  [/shop|grocery|store|buy/i, '\uD83D\uDED2'],
  [/cook|bake|dinner|meal/i, '\uD83C\uDF73'],
  [/clean|chore|laundry|tidy/i, '\uD83E\uDDF9'],
  [/read|book|library/i, '\uD83D\uDCD6'],
  [/art|craft|draw|paint/i, '\uD83C\uDFA8'],
  [/park|hike|walk|outdoor|nature/i, '\uD83C\uDF33'],
  [/rain|storm|weather/i, '\uD83C\uDF27\uFE0F'],
  [/snow|winter|cold/i, '\u2744\uFE0F'],
  [/sun|summer|hot|beach/i, '\u2600\uFE0F'],
  [/spring|flower|garden/i, '\uD83C\uDF3B'],
  [/sleep|nap|rest|bedtime/i, '\uD83D\uDE34'],
  [/friend|playdate|hangout|visit/i, '\uD83D\uDC6B'],
  [/family|grandma|grandpa|cousin/i, '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66'],
  [/pet|dog|cat|animal/i, '\uD83D\uDC3E'],
  [/church|temple|mosque|worship/i, '\u26EA'],
  [/volunteer|help|community/i, '\uD83E\uDD1D'],
]

export function pickIcon(text: string): string {
  for (const [pattern, icon] of ICON_KEYWORDS) {
    if (pattern.test(text)) return icon
  }
  return '\uD83D\uDCCC' // default: pushpin
}
