import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Chart from 'chart.js/auto';
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

  constructor(
    private fb: FormBuilder,
    private investigationService: InvestigationService
  ) {
    this.filterForm = this.fb.group({
      startDate: [''],
      endDate: [''],
      productArea: ['']
    });
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded
  }

  ngOnDestroy(): void {
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

    this.investigationService.getTrends(filters).subscribe({
      next: (response) => {
        this.dashboardData = response.data;
        this.usingFallbackData = response.isFallback;
        const volume = response.data?.trends?.productAreaVolume;
        this.extractProductAreas(Array.isArray(volume) ? volume : []);
        this.loading = false;
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

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(item => item.label),
        datasets: [{
          label: 'Case Volume',
          data: data.map(item => item.value),
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          title: {
            display: true,
            text: 'Volume of Cases per Product Area'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
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
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'right'
          },
          title: {
            display: true,
            text: 'Top 5 Recurring Error Codes'
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: ${value} cases`;
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
      productArea: ''
    });
    this.loadDashboardData();
  }

  generateExecutiveSummary(): void {
    if (!this.dashboardData) return;

    // Hardcoded summary generation based on data
    const productAreaData = this.dashboardData.trends.productAreaVolume;
    const errorData = this.dashboardData.trends.errorCodes;

    // Validate that we have data to generate summary
    if (!productAreaData || productAreaData.length === 0) {
      this.executiveSummary = `
**Investigation Trend Summary**

**Status:** No data available

No product area data is currently available to generate a summary. Please ensure data is loaded and try again.

**Generated:** ${new Date().toLocaleString()}
      `.trim();
      this.showSummary = true;
      return;
    }

    const totalCases = productAreaData.reduce((sum, item) => sum + item.value, 0);
    
    // Find top product area - safe reduce with initial value
    const topProductArea = productAreaData.reduce((prev, current) =>
      (prev.value > current.value) ? prev : current,
      productAreaData[0] // Use first element as initial value
    );
    
    const topError = errorData && errorData.length > 0 ? errorData[0] : null;
    const topErrorPercentage = topError && totalCases > 0 
      ? ((topError.count / totalCases) * 100).toFixed(1) 
      : '0.0';

    this.executiveSummary = `
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

    this.showSummary = true;
  }

  closeSummary(): void {
    this.showSummary = false;
  }
}
