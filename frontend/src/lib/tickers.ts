export interface SeedTicker {
  ticker: string
  label: string   // display name fallback if API fails
  sector: string
}

// 48 curated tickers — 8 sectors × 6 each
// These are the default grid. Search bar accepts any ticker.
export const SEED_TICKERS: SeedTicker[] = [
  // Technology
  { ticker: 'NVDA', label: 'NVIDIA',           sector: 'Technology' },
  { ticker: 'AAPL', label: 'Apple',            sector: 'Technology' },
  { ticker: 'MSFT', label: 'Microsoft',        sector: 'Technology' },
  { ticker: 'GOOGL',label: 'Alphabet',         sector: 'Technology' },
  { ticker: 'META', label: 'Meta Platforms',   sector: 'Technology' },
  { ticker: 'AMD',  label: 'AMD',              sector: 'Technology' },

  // Finance
  { ticker: 'JPM',  label: 'JPMorgan Chase',   sector: 'Finance' },
  { ticker: 'GS',   label: 'Goldman Sachs',    sector: 'Finance' },
  { ticker: 'BAC',  label: 'Bank of America',  sector: 'Finance' },
  { ticker: 'V',    label: 'Visa',             sector: 'Finance' },
  { ticker: 'MA',   label: 'Mastercard',       sector: 'Finance' },
  { ticker: 'BRK.B',label: 'Berkshire Hathaway',sector: 'Finance' },

  // Healthcare
  { ticker: 'JNJ',  label: 'Johnson & Johnson',sector: 'Healthcare' },
  { ticker: 'UNH',  label: 'UnitedHealth',     sector: 'Healthcare' },
  { ticker: 'PFE',  label: 'Pfizer',           sector: 'Healthcare' },
  { ticker: 'ABBV', label: 'AbbVie',           sector: 'Healthcare' },
  { ticker: 'MRK',  label: 'Merck',            sector: 'Healthcare' },
  { ticker: 'LLY',  label: 'Eli Lilly',        sector: 'Healthcare' },

  // Energy
  { ticker: 'XOM',  label: 'ExxonMobil',       sector: 'Energy' },
  { ticker: 'CVX',  label: 'Chevron',          sector: 'Energy' },
  { ticker: 'COP',  label: 'ConocoPhillips',   sector: 'Energy' },
  { ticker: 'SLB',  label: 'SLB',              sector: 'Energy' },
  { ticker: 'EOG',  label: 'EOG Resources',    sector: 'Energy' },
  { ticker: 'PSX',  label: 'Phillips 66',      sector: 'Energy' },

  // Consumer
  { ticker: 'AMZN', label: 'Amazon',           sector: 'Consumer' },
  { ticker: 'TSLA', label: 'Tesla',            sector: 'Consumer' },
  { ticker: 'WMT',  label: 'Walmart',          sector: 'Consumer' },
  { ticker: 'HD',   label: 'Home Depot',       sector: 'Consumer' },
  { ticker: 'MCD',  label: 'McDonald\'s',      sector: 'Consumer' },
  { ticker: 'NKE',  label: 'Nike',             sector: 'Consumer' },

  // Industrials
  { ticker: 'CAT',  label: 'Caterpillar',      sector: 'Industrials' },
  { ticker: 'HON',  label: 'Honeywell',        sector: 'Industrials' },
  { ticker: 'UPS',  label: 'UPS',              sector: 'Industrials' },
  { ticker: 'BA',   label: 'Boeing',           sector: 'Industrials' },
  { ticker: 'GE',   label: 'GE Aerospace',     sector: 'Industrials' },
  { ticker: 'FSS',  label: 'Federal Signal',   sector: 'Industrials' },

  // Communication
  { ticker: 'NFLX', label: 'Netflix',          sector: 'Communication' },
  { ticker: 'DIS',  label: 'Disney',           sector: 'Communication' },
  { ticker: 'T',    label: 'AT&T',             sector: 'Communication' },
  { ticker: 'VZ',   label: 'Verizon',          sector: 'Communication' },
  { ticker: 'CMCSA',label: 'Comcast',          sector: 'Communication' },
  { ticker: 'SPOT', label: 'Spotify',          sector: 'Communication' },

  // Semiconductor & Hardware
  { ticker: 'TSM',  label: 'TSMC',             sector: 'Semiconductors' },
  { ticker: 'AVGO', label: 'Broadcom',         sector: 'Semiconductors' },
  { ticker: 'QCOM', label: 'Qualcomm',         sector: 'Semiconductors' },
  { ticker: 'INTC', label: 'Intel',            sector: 'Semiconductors' },
  { ticker: 'MU',   label: 'Micron',           sector: 'Semiconductors' },
  { ticker: 'AMAT', label: 'Applied Materials',sector: 'Semiconductors' },
]

export const PAGE_SIZE = 12

export function getPage(page: number): SeedTicker[] {
  const start = (page - 1) * PAGE_SIZE
  return SEED_TICKERS.slice(start, start + PAGE_SIZE)
}

export const TOTAL_PAGES = Math.ceil(SEED_TICKERS.length / PAGE_SIZE)