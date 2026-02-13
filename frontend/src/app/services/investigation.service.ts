import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type { DashboardData } from '../models/investigation.model';

export interface TrendFilters {
  startDate?: string;
  endDate?: string;
  productArea?: string;
}

export interface TrendsResponse {
  data: DashboardData;
  isFallback: boolean;
}

/** Fallback data shown when the API is unavailable or returns no usable data. */
export const MOCK_TRENDS_DATA: DashboardData = {
  trends: {
    productAreaVolume: [
      { label: 'Data Deploy', value: 45 },
      { label: 'Connect', value: 30 },
      { label: 'Compliance', value: 15 },
      { label: 'Other', value: 10 }
    ],
    errorCodes: [
      { code: 'ERR-404', count: 20 },
      { code: 'TIMEOUT-500', count: 15 },
      { code: 'AUTH-401', count: 10 },
      { code: 'LIMIT-99', count: 5 },
      { code: 'NULL-REF', count: 5 }
    ]
  },
  summary:
    "High volume of timeouts in 'Connect' area suggests a recent infrastructure " +
    'change. Primary driver appears to be API throttling.'
};

const API_TIMEOUT_MS = 8000;

function isValidDashboardData(body: unknown): body is DashboardData {
  if (!body || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  const trends = o['trends'] as Record<string, unknown> | undefined;
  if (!trends || typeof trends !== 'object') return false;
  const volume = trends['productAreaVolume'] as unknown[];
  const codes = trends['errorCodes'] as unknown[];
  return (
    Array.isArray(volume) &&
    volume.length > 0 &&
    Array.isArray(codes) &&
    typeof o['summary'] === 'string'
  );
}

@Injectable({ providedIn: 'root' })
export class InvestigationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTrends(filters?: TrendFilters): Observable<TrendsResponse> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.productArea) params = params.set('productArea', filters.productArea);

    return this.http
      .get<unknown>(`${this.apiUrl}/investigations/trends`, {
        params: params.keys().length ? params : undefined
      })
      .pipe(
        timeout(API_TIMEOUT_MS),
        map((body): TrendsResponse => {
          if (isValidDashboardData(body)) {
            return { data: body, isFallback: false };
          }
          return { data: MOCK_TRENDS_DATA, isFallback: true };
        }),
        catchError((error: HttpErrorResponse | Error) => {
          console.error('Error fetching investigation trends:', error);
          return of({ data: MOCK_TRENDS_DATA, isFallback: true });
        })
      );
  }
}
