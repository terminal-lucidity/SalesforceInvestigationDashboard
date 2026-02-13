import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InvestigationService, MOCK_TRENDS_DATA, TrendFilters } from './investigation.service';

describe('InvestigationService', () => {
  let service: InvestigationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InvestigationService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(InvestigationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTrends()', () => {
    it('should return API data and isFallback false when response is valid', () => {
      const apiData = {
        trends: {
          productAreaVolume: [{ label: 'Connect', value: 50 }],
          errorCodes: [{ code: 'ERR-1', count: 10 }]
        },
        summary: 'API summary text'
      };

      service.getTrends().subscribe((response) => {
        expect(response.data).toEqual(apiData);
        expect(response.isFallback).toBe(false);
      });

      const req = httpMock.expectOne((r) => r.url.includes('/investigations/trends'));
      expect(req.request.method).toBe('GET');
      req.flush(apiData);
    });

    it('should return fallback data and isFallback true when response is invalid', () => {
      service.getTrends().subscribe((response) => {
        expect(response.data).toEqual(MOCK_TRENDS_DATA);
        expect(response.isFallback).toBe(true);
      });

      const req = httpMock.expectOne((r) => r.url.includes('/investigations/trends'));
      req.flush({ invalid: 'payload' });
    });

    it('should return fallback data and isFallback true on HTTP error', () => {
      service.getTrends().subscribe((response) => {
        expect(response.data).toEqual(MOCK_TRENDS_DATA);
        expect(response.isFallback).toBe(true);
      });

      const req = httpMock.expectOne((r) => r.url.includes('/investigations/trends'));
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should send filter params when provided', () => {
      const filters: TrendFilters = {
        startDate: '2026-02-01',
        endDate: '2026-02-13',
        productArea: 'Connect'
      };

      service.getTrends(filters).subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('/investigations/trends'));
      expect(req.request.params.get('startDate')).toBe('2026-02-01');
      expect(req.request.params.get('endDate')).toBe('2026-02-13');
      expect(req.request.params.get('productArea')).toBe('Connect');
      req.flush({
        trends: {
          productAreaVolume: [{ label: 'Connect', value: 1 }],
          errorCodes: [{ code: 'X', count: 1 }]
        },
        summary: 'Ok'
      });
    });

    it('should treat missing productAreaVolume as invalid and use fallback', () => {
      service.getTrends().subscribe((response) => {
        expect(response.isFallback).toBe(true);
        expect(response.data).toEqual(MOCK_TRENDS_DATA);
      });

      const req = httpMock.expectOne((r) => r.url.includes('/investigations/trends'));
      req.flush({
        trends: { productAreaVolume: [], errorCodes: [] },
        summary: 'No volume'
      });
    });

    it('should treat missing summary as invalid and use fallback', () => {
      service.getTrends().subscribe((response) => {
        expect(response.isFallback).toBe(true);
      });

      const req = httpMock.expectOne((r) => r.url.includes('/investigations/trends'));
      req.flush({
        trends: {
          productAreaVolume: [{ label: 'A', value: 1 }],
          errorCodes: [{ code: 'X', count: 1 }]
        }
        // summary missing
      });
    });
  });
});
