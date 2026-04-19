export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type NonEmptyArray<T> = [T, ...T[]];

export type CrustdataQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type CrustdataQuery = Record<string, CrustdataQueryValue> | URLSearchParams;

export type CrustdataCacheOptions = {
  ttlMs?: number;
  workspaceId?: string | null;
  cacheKey?: string;
};

export type CrustdataRequestOptions = {
  cache?: boolean | CrustdataCacheOptions;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  baseUrl?: string;
};

export type CompanyIdentifierInput =
  | {
      domains: NonEmptyArray<string>;
      names?: never;
      professional_network_profile_urls?: never;
      crustdata_company_ids?: never;
    }
  | {
      domains?: never;
      names: NonEmptyArray<string>;
      professional_network_profile_urls?: never;
      crustdata_company_ids?: never;
    }
  | {
      domains?: never;
      names?: never;
      professional_network_profile_urls: NonEmptyArray<string>;
      crustdata_company_ids?: never;
    }
  | {
      domains?: never;
      names?: never;
      professional_network_profile_urls?: never;
      crustdata_company_ids: NonEmptyArray<string>;
    };

export type CompanyIdentifyRequest = CompanyIdentifierInput & {
  exact_match?: boolean;
};

export type CompanyEnrichRequest = CompanyIdentifierInput & {
  fields: NonEmptyArray<string>;
  exact_match?: boolean;
};

export type CrustdataFilterCondition = {
  field: string;
  type: string;
  value: JsonValue | JsonValue[];
};

export type CrustdataFilterGroup = {
  op: "and" | "or";
  conditions: Array<CrustdataFilterCondition | CrustdataFilterGroup>;
};

export type CompanySearchSort = {
  column: string;
  order: "asc" | "desc";
};

export type CompanySearchRequest = {
  fields: NonEmptyArray<string>;
  filters?: CrustdataFilterGroup;
  sorts?: CompanySearchSort[];
  limit?: number;
  cursor?: string;
};

export type CrustdataCompanyData = {
  crustdata_company_id?: string;
  basic_info?: {
    name?: string;
    primary_domain?: string;
    website?: string;
    year_founded?: number;
    employee_count_range?: string;
    industries?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CrustdataCompanyMatch = {
  confidence_score?: number;
  company_data?: CrustdataCompanyData;
  [key: string]: unknown;
};

export type CrustdataCompanyMatchEnvelope = {
  matched_on?: string;
  match_type?: string;
  matches: CrustdataCompanyMatch[];
  [key: string]: unknown;
};

export type CompanySearchResponse<TCompany = CrustdataCompanyData> = {
  companies: TCompany[];
  next_cursor: string | null;
  total_count: number | null;
  raw: unknown;
};
