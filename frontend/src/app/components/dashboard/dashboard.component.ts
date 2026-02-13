import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
import { Subscription } from 'rxjs';
import { InvestigationService, TrendFilters } from '../../services/investigation.service';
import type { DashboardData, TrendData, ErrorCode } from '../../models/investigation.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('barChartCanvas', { static: false }) barChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChartCanvas', { static: false }) pieChartCanvas!: ElementRef<HTMLCanvasElement>;

  filterForm: FormGroup;
  loading = false;
  error: string | null = null;
  dashboardData: DashboardData | null = null;
  executiveSummary: string | null = null;
  showSummary = false;
  protected usingFallbackData = false;

  private barChart: Chart<'bar', number[], string> | null = null;
  private pieChart: Chart<'pie', number[], string> | null = null;
  protected productAreas: string[] = [];
  private trendsSubscription: Subscription | null = null;

  constructor(
    private fb: FormBuilder,
    private investigationService: InvestigationService,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      startDate: [''],
      endDate: [''],
      productArea: ['all']
    });
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded
  }

  ngOnDestroy(): void {
    // Unsubscribe from trends subscription to prevent memory leaks
    if (this.trendsSubscription) {
      this.trendsSubscription.unsubscribe();
      this.trendsSubscription = null;
    }
    if (this.barChart) {
      this.barChart.destroy();
    }
    if (this.pieChart) {
      this.pieChart.destroy();
    }
  }

  loadDashboardData(filters?: TrendFilters): void {
    this.loading = true;
    this.error = null;
    this.usingFallbackData = false;

    // Unsubscribe from previous subscription to prevent memory leaks
    if (this.trendsSubscription) {
      this.trendsSubscription.unsubscribe();
    }

    this.trendsSubscription = this.investigationService.getTrends(filters).subscribe({
      next: (response) => {
        let data = response.data;
        this.usingFallbackData = response.isFallback;
        const volume = data?.trends?.productAreaVolume;
        this.extractProductAreas(Array.isArray(volume) ? volume : []);
        // Apply client-side product area filtering so the UI behaves correctly
        // even when backend returns unfiltered placeholder data.
        if (filters?.productArea) {
          data = this.applyClientSideFilters(data, filters.productArea);
        }
        this.dashboardData = data;
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.initializeCharts();
        }, 0);
      },
      error: (err) => {
        this.error = err.message || 'Failed to load dashboard data';
        this.loading = false;
      }
    });
  }

  /** Apply product-area filter to fallback data (client-side when backend is unavailable). */
  private applyClientSideFilters(data: DashboardData, productArea: string): DashboardData {
    const volume = data.trends.productAreaVolume;
    const filtered = volume.filter(item => item.label === productArea);
    if (filtered.length === 0) {
      return data;
    }
    return {
      ...data,
      trends: {
        ...data.trends,
        productAreaVolume: filtered
      }
    };
  }

  extractProductAreas(productAreaVolume: TrendData[]): void {
    this.productAreas = productAreaVolume.map(item => item.label);
  }

  initializeCharts(): void {
    if (!this.dashboardData) return;

    this.createBarChart(this.dashboardData.trends.productAreaVolume);
    this.createPieChart(this.dashboardData.trends.errorCodes);
  }

  createBarChart(data: TrendData[]): void {
    if (!this.barChartCanvas?.nativeElement) return;

    const ctx = this.barChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.barChart) {
      this.barChart.destroy();
    }

    const maxValue = Math.max(...data.map(item => item.value), 0);
    const yStep = maxValue <= 10 ? 1 : maxValue <= 50 ? 5 : maxValue <= 100 ? 10 : 20;

    // When few bars (e.g. after filter), cap bar width so one bar doesn't dominate the chart
    const barCount = data.length;
    const maxBarThickness = barCount <= 2 ? 80 : undefined;
    const categoryPercentage = barCount <= 2 ? 0.55 : 0.8;

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(item => item.label),
        datasets: [{
          label: 'Cases',
          data: data.map(item => item.value),
          maxBarThickness: maxBarThickness,
          barPercentage: 0.85,
          categoryPercentage,
          backgroundColor: [
            'rgba(59, 130, 246, 0.85)',
            'rgba(236, 72, 153, 0.85)',
            'rgba(251, 191, 36, 0.85)',
            'rgba(34, 197, 94, 0.85)',
            'rgba(139, 92, 246, 0.85)',
            'rgba(249, 115, 22, 0.85)'
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(251, 191, 36, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(249, 115, 22, 1)'
          ],
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 16,
            bottom: 16,
            left: 16,
            right: 16
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            titleFont: {
              size: 13,
              weight: 600
            },
            bodyFont: {
              size: 13
            },
            cornerRadius: 6,
            displayColors: true,
            callbacks: {
              label: (context) => {
                return `${context.parsed.y} cases`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              },
              color: '#6B7280',
              maxRotation: 45,
              minRotation: 0,
              padding: 12
            },
            border: {
              display: true,
              color: '#E5E7EB'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#F3F4F6'
            },
            ticks: {
              stepSize: yStep,
              font: {
                size: 11
              },
              color: '#6B7280',
              padding: 12
            },
            border: {
              display: true,
              color: '#E5E7EB'
            }
          }
        }
      }
    });
  }

  createPieChart(data: ErrorCode[]): void {
    if (!this.pieChartCanvas?.nativeElement) return;

    const ctx = this.pieChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Take only top 5 error codes
    const top5Data = data.slice(0, 5);
    const total = top5Data.reduce((sum, item) => sum + item.count, 0);

    if (this.pieChart) {
      this.pieChart.destroy();
    }

    this.pieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: top5Data.map(item => item.code),
        datasets: [{
          data: top5Data.map(item => item.count),
          backgroundColor: [
            'rgba(236, 72, 153, 0.9)',
            'rgba(59, 130, 246, 0.9)',
            'rgba(251, 191, 36, 0.9)',
            'rgba(34, 197, 94, 0.9)',
            'rgba(139, 92, 246, 0.9)'
          ],
          borderColor: '#FFFFFF',
          borderWidth: 2.5,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 16,
            bottom: 16,
            left: 16,
            right: 16
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              padding: 12,
              font: {
                size: 11,
                weight: 500
              },
              color: '#374151',
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 10,
            titleFont: {
              size: 13,
              weight: 600
            },
            bodyFont: {
              size: 13
            },
            cornerRadius: 6,
            displayColors: true,
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return `${label}: ${value} cases (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  applyFilters(): void {
    const formValue = this.filterForm.value;
    const filters: TrendFilters = {};

    if (formValue.startDate) {
      filters.startDate = formValue.startDate;
    }
    if (formValue.endDate) {
      filters.endDate = formValue.endDate;
    }
    if (formValue.productArea && formValue.productArea !== 'all') {
      filters.productArea = formValue.productArea;
    }

    this.loadDashboardData(Object.keys(filters).length > 0 ? filters : undefined);
  }

  resetFilters(): void {
    this.filterForm.reset({
      startDate: '',
      endDate: '',
      productArea: 'all'
    });
    this.loadDashboardData();
  }

  generateExecutiveSummary(): void {
    if (!this.dashboardData) return;

    const apiSummary = this.dashboardData.summary?.trim();
    if (apiSummary) {
      this.executiveSummary = apiSummary;
      this.showSummary = true;
      return;
    }

    this.executiveSummary = this.buildFallbackSummary(this.dashboardData);
    this.showSummary = true;
  }

  get dashboardSummary(): string | null {
    if (!this.dashboardData) return null;

    const apiSummary = this.dashboardData.summary?.trim();
    return apiSummary || this.buildFallbackSummary(this.dashboardData);
  }

  private buildFallbackSummary(data: DashboardData): string {
    const productAreaData = data.trends.productAreaVolume;
    const errorData = data.trends.errorCodes;

    // Validate that we have data to generate summary
    if (!productAreaData || productAreaData.length === 0) {
      return `
**Investigation Trend Summary**

**Status:** No data available

No product area data is currently available to generate a summary. Please ensure data is loaded and try again.

**Generated:** ${new Date().toLocaleString()}
      `.trim();
    }

    const totalCases = productAreaData.reduce((sum, item) => sum + item.value, 0);
    
    // Find top product area - safe reduce with proper initial value
    // Array is guaranteed non-empty due to check above, but we use first element as initial value
    const topProductArea = productAreaData.reduce((prev, current) =>
      (prev.value > current.value) ? prev : current,
      productAreaData[0] // Safe: array is guaranteed non-empty at this point
    );
    
    const topError = errorData && errorData.length > 0 ? errorData[0] : null;
    const topErrorPercentage = topError && totalCases > 0 
      ? ((topError.count / totalCases) * 100).toFixed(1) 
      : '0.0';

    return `
**Investigation Trend Summary**

**Primary Driver Analysis:**
- Highest volume product area: ${topProductArea.label} with ${topProductArea.value} cases (${totalCases > 0 ? ((topProductArea.value / totalCases) * 100).toFixed(1) : '0.0'}% of total)
- Most frequent error code: ${topError?.code || 'N/A'} occurring ${topError?.count || 0} times (${topErrorPercentage}% of cases)

**Key Insights:**
- Total investigation cases: ${totalCases}
- Product areas affected: ${productAreaData.length}
- Unique error codes tracked: ${errorData?.length || 0}

**Recommendations:**
- Focus investigation efforts on ${topProductArea.label} area
- Address root cause of ${topError?.code || 'primary error'} error code
- Consider proactive monitoring for identified patterns

**Generated:** ${new Date().toLocaleString()}
    `.trim();
  }

  closeSummary(): void {
    this.showSummary = false;
  }
}
