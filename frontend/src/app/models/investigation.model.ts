export interface TrendData {
  label: string;
  value: number;
}

export interface ErrorCode {
  code: string;
  count: number;
}

export interface DashboardData {
  trends: {
    productAreaVolume: TrendData[];
    errorCodes: ErrorCode[];
  };
  summary: string;
}
