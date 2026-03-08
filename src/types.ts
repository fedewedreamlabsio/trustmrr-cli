export type StartupSortField =
  | "mrr"
  | "revenue"
  | "growth30d"
  | "customers"
  | "askingPrice";

export type SortOrder = "asc" | "desc";

export interface RevenueMetrics {
  last30Days: number | null;
  mrr: number | null;
  total: number | null;
}

export interface StartupSummary {
  name: string;
  slug: string;
  url: string;
  icon: string | null;
  description: string | null;
  website: string | null;
  country: string | null;
  foundedDate: string | null;
  category: string | null;
  paymentProvider: string | null;
  targetAudience: string | null;
  revenue: RevenueMetrics;
  customers: number | null;
  activeSubscriptions: number | null;
  askingPrice: number | null;
  profitMarginLast30Days: number | null;
  growth30d: number | null;
  multiple: number | null;
  onSale: boolean;
  firstListedForSaleAt: string | null;
  xHandle: string | null;
}

export interface StartupDetail extends StartupSummary {
  xFollowerCount: number | null;
  isMerchantOfRecord: boolean | null;
  techStack: string[];
  cofounders: string[];
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface StartupListResponse {
  data: StartupSummary[];
  meta: ListMeta;
}

export interface StartupDetailResponse {
  data: StartupDetail;
}

export interface StartupQuery {
  limit?: number;
  page?: number;
  sort?: StartupSortField;
  order?: SortOrder;
  category?: string;
  country?: string;
  onSale?: boolean;
  minMrr?: number;
  maxMrr?: number;
  minRevenue?: number;
  maxRevenue?: number;
  search?: string;
}
