export interface Stock {
  rank: number
  code: string
  name: string
  current_price: number
  change_rate: number
  volume: number
}

export interface HistoryChange {
  date: string
  change_rate: number
}

export interface StockHistory {
  code: string
  name: string
  changes: HistoryChange[]
}

export interface NewsItem {
  title: string
  link: string
  pubDate: string
}

export interface StockNews {
  name: string
  news: NewsItem[]
}

export interface ExchangeRate {
  currency: string
  currency_name: string
  rate: number
  ttb: number
  tts: number
  is_100: boolean
}

export interface ExchangeData {
  timestamp: string
  search_date: string
  rates: ExchangeRate[]
}

export interface StockData {
  timestamp: string
  exchange: ExchangeData
  rising: {
    kospi: Stock[]
    kosdaq: Stock[]
  }
  falling: {
    kospi: Stock[]
    kosdaq: Stock[]
  }
  history: Record<string, StockHistory>
  news: Record<string, StockNews>
}
