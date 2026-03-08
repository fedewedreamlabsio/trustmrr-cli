import type { StartupDetail, StartupListResponse } from "../src/types.js";

export function makeStartup(overrides: Partial<StartupDetail> = {}): StartupDetail {
  return {
    name: "Stan",
    slug: "stan",
    url: "https://trustmrr.com/startup/stan",
    icon: null,
    description: "Creator storefront software.",
    website: "https://stan.store",
    country: "US",
    foundedDate: "2023-04-19T18:51:28.000Z",
    category: "Content Creation",
    paymentProvider: "stripe",
    targetAudience: "B2C",
    revenue: {
      last30Days: 3_039_307.93,
      mrr: 3_501_730.91,
      total: 72_484_789.21,
    },
    customers: 0,
    activeSubscriptions: 99_174,
    askingPrice: null,
    profitMarginLast30Days: null,
    growth30d: 10.02,
    multiple: null,
    onSale: false,
    firstListedForSaleAt: null,
    xHandle: "vitddnv",
    xFollowerCount: 4_567,
    isMerchantOfRecord: false,
    techStack: [],
    cofounders: [],
    ...overrides,
  };
}

export function makeListResponse(...items: StartupDetail[]): StartupListResponse {
  return {
    data: items,
    meta: {
      total: items.length,
      page: 1,
      limit: items.length,
      hasMore: false,
    },
  };
}
