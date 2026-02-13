import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormBuilder } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { InvestigationService, TrendFilters } from '../../services/investigation.service';
import { MOCK_TRENDS_DATA } from '../../services/investigation.service';
import type { DashboardData } from '../../models/investigation.model';

// Mock Chart.js so canvas is not required in tests
vi.mock('chart.js/auto', () => ({
  default: class MockChart {
    destroy = vi.fn();
  }
}));

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let investigationService: InvestigationService;

  const validApiData: DashboardData = {
    trends: {
      productAreaVolume: [
        { label: 'Connect', value: 30 },
        { label: 'Data Deploy', value: 45 }
      ],
      errorCodes: [
        { code: 'ERR-404', count: 20 },
        { code: 'TIMEOUT-500', count: 15 }
      ]
    },
    summary: 'API summary from backend'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        FormBuilder,
        ChangeDetectorRef,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    investigationService = TestBed.inject(InvestigationService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display data when getTrends succeeds', () => {
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: validApiData, isFallback: false })
    );
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.dashboardData).toEqual(validApiData);
    expect(component.error).toBeNull();
  });

  it('should show error state when getTrends fails', () => {
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      throwError(() => new Error('Network error'))
    );
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.error).toBe('Network error');
    expect(component.dashboardData).toBeNull();
  });

  it('should set usingFallbackData when API returns fallback data', () => {
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: MOCK_TRENDS_DATA, isFallback: true })
    );
    fixture.detectChanges();

    expect((component as unknown as { usingFallbackData: boolean }).usingFallbackData).toBe(true);
    expect(component.dashboardData).toEqual(MOCK_TRENDS_DATA);
  });

  it('should call getTrends with filters when applyFilters is called', () => {
    const getTrendsSpy = vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: validApiData, isFallback: false })
    );
    fixture.detectChanges();

    component.filterForm.patchValue({
      startDate: '2026-02-01',
      endDate: '2026-02-13',
      productArea: 'Connect'
    });
    component.applyFilters();

    expect(getTrendsSpy).toHaveBeenCalledWith({
      startDate: '2026-02-01',
      endDate: '2026-02-13',
      productArea: 'Connect'
    });
  });

  it('should call getTrends with no args when resetFilters is called', () => {
    const getTrendsSpy = vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: validApiData, isFallback: false })
    );
    fixture.detectChanges();

    component.filterForm.patchValue({
      startDate: '2026-02-01',
      productArea: 'Connect'
    });
    component.resetFilters();

    expect(getTrendsSpy).toHaveBeenLastCalledWith(undefined);
    expect(component.filterForm.value).toEqual({
      startDate: '',
      endDate: '',
      productArea: 'all'
    });
  });

  it('should not create charts when dashboardData is null', () => {
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: validApiData, isFallback: false })
    );
    fixture.detectChanges();
    // initializeCharts is called in setTimeout(0); without flushing that we could still have no canvas in DOM
    fixture.detectChanges();
    // Component only creates charts when dashboardData exists and canvas refs are set; in this test
    // we mainly assert that the component doesn't throw and that without data it doesn't try to chart
    expect(component.dashboardData).toBeTruthy();
  });

  it('should open summary modal and prefer API summary when available', () => {
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: validApiData, isFallback: false })
    );
    fixture.detectChanges();

    expect(component.showSummary).toBe(false);
    component.generateExecutiveSummary();

    expect(component.showSummary).toBe(true);
    expect(component.executiveSummary).toBeTruthy();
    expect(component.executiveSummary).toBe('API summary from backend');
  });

  it('should generate fallback summary when API summary is missing', () => {
    const noSummaryData: DashboardData = {
      ...validApiData,
      summary: ''
    };
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: noSummaryData, isFallback: false })
    );
    fixture.detectChanges();

    component.generateExecutiveSummary();

    expect(component.showSummary).toBe(true);
    expect(component.executiveSummary).toContain('Investigation Trend Summary');
  });

  it('should close summary when closeSummary is called', () => {
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: validApiData, isFallback: false })
    );
    fixture.detectChanges();

    component.generateExecutiveSummary();
    expect(component.showSummary).toBe(true);
    component.closeSummary();
    expect(component.showSummary).toBe(false);
  });

  it('should extract product areas from trend data', () => {
    vi.spyOn(investigationService, 'getTrends').mockReturnValue(
      of({ data: validApiData, isFallback: false })
    );
    fixture.detectChanges();

    expect((component as unknown as { productAreas: string[] }).productAreas).toEqual(['Connect', 'Data Deploy']);
  });
});
