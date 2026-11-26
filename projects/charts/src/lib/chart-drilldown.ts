import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect,
  ElementRef, inject, input, output, signal, viewChild,
} from '@angular/core';
import { exportChartCsv, renderChartSvg } from '@neural-charts/web';
import type { ChartDiagnostic, ChartResult, CsvExportOptions, PngExportOptions, SvgExportOptions } from '@neural-charts/web';
import { createChartDrilldown, resolveChartDrilldownRoot } from '@neural-charts/web/drilldown';
import type {
  ChartDrilldownController, ChartDrilldownData, ChartDrilldownNavigation, ChartDrilldownOptions,
} from '@neural-charts/web/drilldown';
import { ChartFallback } from './server-chart';

/** The Web owner handles navigation. Angular supplies typed inputs, SSR and teardown. */
@Component({
  selector: 'nc-chart-drilldown',
  imports: [ChartFallback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host{display:block;min-width:0}',
  template: `
    <div #surface></div>
    <div [hidden]="mounted()">
      @if (root(); as initial) {
        @if (initial.status === 'ok') {
          <nc-chart-fallback [data]="initial.value.data" [options]="initial.value.options" [instanceId]="instanceId()" />
        } @else {
          <p role="alert">{{ initial.diagnostic.message }}</p>
        }
      }
    </div>
  `,
})
export class NeuralChartDrilldown {
  readonly data = input.required<ChartDrilldownData>();
  readonly options = input<ChartDrilldownOptions>({});
  readonly instanceId = input.required<string>();
  readonly navigationChange = output<ChartDrilldownNavigation>();
  readonly diagnostic = output<ChartDiagnostic>();
  protected readonly root = computed(() => resolveChartDrilldownRoot(this.data(), this.options()));
  protected readonly mounted = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly browserReady = signal(false);
  private controller?: ChartDrilldownController;
  private id?: string;

  constructor() {
    afterNextRender(() => this.browserReady.set(true));
    effect(() => {
      if (this.browserReady()) this.apply(this.data(), this.options(), this.instanceId());
    });
    this.destroyRef.onDestroy(() => this.controller?.destroy());
  }

  enter(): boolean { return this.controller?.enter() ?? false; }
  back(): boolean { return this.controller?.back() ?? false; }
  exportSvg(settings: SvgExportOptions = {}): ChartResult<string> {
    if (this.controller) return { status: 'ok', value: this.controller.exportSvg(settings) };
    const root = this.root();
    return root.status === 'invalid' ? root : renderChartSvg(root.value.data, root.value.options, {
      ...settings, composition: settings.composition ?? 'chart', instanceId: this.instanceId(),
    });
  }
  exportCsv(settings?: CsvExportOptions): ChartResult<string> {
    if (this.controller) return this.controller.exportCsv(settings);
    const root = this.root();
    return root.status === 'invalid' ? root : exportChartCsv(root.value.data, settings);
  }
  exportPng(settings?: PngExportOptions): Promise<Blob> {
    return this.controller?.exportPng(settings) ?? Promise.reject(new Error('BROWSER_CHART_REQUIRED'));
  }

  private apply(data: ChartDrilldownData, options: ChartDrilldownOptions, instanceId: string): void {
    if (this.destroyRef.destroyed) return;
    if (this.controller && this.id === instanceId) {
      const result = this.controller.update(data, options);
      if (result.status === 'invalid') this.diagnostic.emit(result.diagnostic);
      return;
    }
    const result = createChartDrilldown(this.surface().nativeElement, data, options, {
      instanceId,
      onNavigationChange: value => { if (!this.destroyRef.destroyed) this.navigationChange.emit(value); },
      onDiagnostic: value => { if (!this.destroyRef.destroyed) this.diagnostic.emit(value); },
    });
    if (result.status === 'invalid') { this.diagnostic.emit(result.diagnostic); return; }
    if (this.destroyRef.destroyed) { result.value.destroy(); return; }
    this.controller?.destroy();
    this.controller = result.value;
    this.id = instanceId;
    this.mounted.set(true);
  }
}
