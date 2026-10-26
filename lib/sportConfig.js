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
 * SEASON_WINDOWS
 *
 * Which real-world season each sport uses for a portfolio year, and when the
 * nightly cron is allowed to update it. A portfolio year scores the first
 * season of each sport that starts after that year's draft, so windows for
 * one portfolio overlap the next (e.g. 2026-27 NBA picks keep updating into
 * June 2027 while 2027-2028 picks for other sports are already live).
 *
 *   espnSeason: the `season` value ESPN uses (NBA/NHL/CBB use the year the
 *               season ends; NFL/CFB/soccer use the year it starts).
 *   start/end:  inclusive dates (UTC) when the cron updates these picks.
 *               Outside the window, picks are left untouched — postseason
 *               results are still entered in the admin editor.
 *
 * The `is_scraping_active` switch on the Admin page still applies on top of
 * this: a sport is only updated when it is switched on AND inside its window.
 */
export const SEASON_WINDOWS = {
  "2026-2027": {
    1: { espnSeason: 2027, start: "2026-10-01", end: "2027-06-30" }, // NBA 2026-27
    2: { espnSeason: 2026, start: "2026-05-01", end: "2026-10-31" }, // WNBA 2026
    3: { espnSeason: 2026, start: "2026-09-01", end: "2027-02-15" }, // NFL 2026
    4: { espnSeason: 2026, start: "2026-03-20", end: "2026-11-15" }, // MLB 2026
    5: { espnSeason: 2027, start: "2026-10-01", end: "2027-06-30" }, // NHL 2026-27
    6: { espnSeason: 2026, start: "2026-02-15", end: "2026-12-20" }, // MLS 2026
    7: { espnSeason: 2026, start: "2026-08-15", end: "2026-12-31" }, // NCAAW Volleyball 2026
    8: { espnSeason: 2026, start: "2026-08-01", end: "2027-06-15" }, // Premier League 2026-27
    9: { espnSeason: 2026, start: "2026-08-20", end: "2027-01-31" }, // College Football 2026
    10: { espnSeason: 2027, start: "2026-11-01", end: "2027-04-15" }, // Men's CBB 2026-27
    11: { espnSeason: 2027, start: "2026-11-01", end: "2027-04-15" }, // Women's CBB 2026-27
    12: { espnSeason: 2027, start: "2027-01-01", end: "2027-11-30" }, // ATP 2027
    13: { espnSeason: 2027, start: "2027-01-01", end: "2027-11-30" }, // WTA 2027
    14: { espnSeason: 2027, start: "2027-01-01", end: "2027-08-31" }, // PGA 2027 (FedEx Cup)
    15: { espnSeason: 2027, start: "2027-01-01", end: "2027-11-30" }, // LPGA 2027
    16: { espnSeason: 2026, start: "2026-03-01", end: "2026-12-15" }, // F1 2026
    17: { espnSeason: 2027, start: "2027-01-01", end: "2027-12-31" }, // MMA 2027 (manual entry)
    18: { espnSeason: 2026, start: "2026-03-01", end: "2026-11-30" }, // NWSL 2026
    19: { espnSeason: 2026, start: "2026-06-01", end: "2026-07-31" }, // 2026 Men's World Cup
  },
};

/** Is `date` inside the sport's window for this portfolio year? */
export function seasonWindowFor(portfolioYear, sportId) {
  return SEASON_WINDOWS[portfolioYear]?.[sportId] || null;
}

export function isInSeasonWindow(window, date = new Date()) {
  if (!window) return false;
  const day = date.toISOString().slice(0, 10);
  return day >= window.start && day <= window.end;
}

/**
 * F1_CROWN_JEWELS
 *
 * Official Grand Prix classifications (after penalties/appeals) for the four
 * Crown Jewel races, keyed by F1 season. List the top 10 finishers in order
 * (the points-scoring positions) — the cron uses this both to award Crown
 * Jewel postseason points and to remove those races' points from every
 * driver's regular-season total. Sprint races are NOT Crown Jewels and stay
 * in the regular season. A race that hasn't happened yet: leave `top10` empty.
 *
 * Standard GP points by position: 25-18-15-12-10-8-6-4-2-1.
 */
export const F1_GP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const F1_CROWN_JEWELS = {
  2026: {
    "Monaco GP": [
      // FIA final classification (Perez dropped to P15 after a 10s penalty)
      "Kimi Antonelli", "Lewis Hamilton", "Isack Hadjar", "Oscar Piastri", "Liam Lawson",
      "Arvid Lindblad", "Pierre Gasly", "Alexander Albon", "Esteban Ocon", "Fernando Alonso",
    ],
    "British GP": [
      "Charles Leclerc", "George Russell", "Lewis Hamilton", "Lando Norris", "Isack Hadjar",
      "Liam Lawson", "Arvid Lindblad", "Gabriel Bortoleto", "Franco Colapinto", "Pierre Gasly",
    ],
    "Belgian GP": [
      "Kimi Antonelli", "Charles Leclerc", "Max Verstappen", "Lewis Hamilton", "Oscar Piastri",
      "Isack Hadjar", "Lando Norris", "Gabriel Bortoleto", "Arvid Lindblad", "Franco Colapinto",
    ],
    "Italian GP": [
      "Kimi Antonelli", "George Russell", "Max Verstappen", "Lando Norris", "Oscar Piastri",
      "Lewis Hamilton", "Pierre Gasly", "Arvid Lindblad", "Franco Colapinto", "Yuki Tsunoda",
    ],
  },
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
