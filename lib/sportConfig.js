export const SPORT_CONFIG = {
  17: { order: 1, dates: "Jan - Dec", name: "MMA" },
  12: { order: 2, dates: "Jan - Nov", name: "Men's Tennis" },
  13: { order: 3, dates: "Jan - Nov", name: "Women's Tennis" },
  14: { order: 4, dates: "Jan - Aug", name: "PGA Golf" },
  15: { order: 5, dates: "Jan - Nov", name: "LPGA Golf" },
  6: { order: 6, dates: "Feb - Dec", name: "MLS" },
  18: { order: 7, dates: "Mar - Nov", name: "NWSL" },
  16: { order: 8, dates: "Mar - Dec", name: "Formula 1" },
  4: { order: 9, dates: "Mar - Nov", name: "MLB" },
  2: { order: 10, dates: "May - Oct", name: "WNBA" },
  19: { order: 11, dates: "Jun - Jul", name: "Summer Intl Soccer" },
  7: { order: 12, dates: "Aug - Dec", name: "NCAAW Volleyball" },
  8: { order: 13, dates: "Aug - May", name: "Premier League" },
  9: { order: 14, dates: "Aug - Jan", name: "College Football" },
  3: { order: 15, dates: "Sep - Feb", name: "NFL" },
  1: { order: 16, dates: "Oct - Jun", name: "NBA" },
  5: { order: 17, dates: "Oct - Jun", name: "NHL" },
  10: { order: 18, dates: "Nov - Apr", name: "Men's CBB" },
  11: { order: 19, dates: "Nov - Apr", name: "Women's CBB" },
};

/**
 * SUMMER_INTL_SOCCER_CONFIG
 *
 * Think of this like a TV channel guide — each year tunes into a different tournament.
 * The sport_id (19) stays the same in Supabase, but the *tournament* rotates.
 *
 * `espnSlug` is used to build ESPN API URLs for standings/scores.
 * `teamCount` is the number of teams in the tournament (for seeding buttons).
 * `knockoutRounds` controls how the postseason escalator is calculated.
 */
export const SUMMER_INTL_SOCCER_CONFIG = {
  "2026-2027": {
    label: "2026 FIFA Men's World Cup",
    espnSlug: "fifa.world",
    teamCount: 48,
    groupGames: 3,
    knockoutRounds: 5, // R32, R16, QF, SF, Final
    hasThirdPlace: true,
  },
  "2027-2028": {
    label: "2027 FIFA Women's World Cup",
    espnSlug: "fifa.wwc",
    teamCount: 32,
    groupGames: 3,
    knockoutRounds: 4, // R16, QF, SF, Final
    hasThirdPlace: true,
  },
  "2028-2029": {
    label: "2028 UEFA Euro & Copa América",
    espnSlug: ["uefa.euro", "conmebol.america"],
    teamCount: 40, // 24 Euro + 16 Copa
    groupGames: 3,
    knockoutRounds: 4,
    hasThirdPlace: false,
  },
  "2029-2030": {
    label: "2029 CONCACAF Gold Cup & Women's Euro",
    espnSlug: ["concacaf.gold", "uefa.weuro"],
    teamCount: 32,
    groupGames: 3,
    knockoutRounds: 4,
    hasThirdPlace: false,
  },
  "2030-2031": {
    label: "2030 FIFA Men's World Cup",
    espnSlug: "fifa.world",
    teamCount: 48,
    groupGames: 3,
    knockoutRounds: 5,
    hasThirdPlace: true,
  },
};
