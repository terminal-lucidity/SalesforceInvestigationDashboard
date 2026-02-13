import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type { DashboardData } from '../models/investigation.model';

export interface TrendFilters {
  startDate?: string;
  endDate?: string;
  productArea?: string;
}

@Injectable({ providedIn: 'root' })
export class InvestigationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTrends(filters?: TrendFilters): Observable<DashboardData> {
    let params = new HttpParams();
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);
    if (filters?.productArea) params = params.set('productArea', filters.productArea);

    return this.http.get<DashboardData>(`${this.apiUrl}/investigations/trends`, {
      params: params.keys().length ? params : undefined
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching investigation trends:', error);
        return throwError(() => new Error(
          error.error?.message || error.message || 'Failed to fetch investigation trends'
        ));
      })
    );
  }
}
