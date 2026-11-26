import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect,
  ElementRef, inject, input, output, signal, viewChild,
} from '@angular/core';
import type { ChartResult } from '@neural-charts/web';
import { chartPanelColumns, createChartPanels, resolveChartPanels } from '@neural-charts/web/panels';
import type {
  ChartPanelDiagnostic, ChartPanelsController, ChartPanelsData, ChartPanelsOptions,
  ChartPanelViewportChange, ChartPanelViewportValue, ChartPanelVisibilityChange,
} from '@neural-charts/web/panels';
import { ChartFallback } from './server-chart';

/** Angular transport for the browser panel owner, with a static SSR projection. */
@Component({
  selector: 'nc-chart-panels',
  imports: [ChartFallback],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host{display:block;min-width:0}.static-panels{display:grid;align-items:start;gap:16px}.static-panels[hidden]{display:none}',
  template: `
    <div #surface></div>
    @if (root(); as initial) {
      @if (initial.status === 'ok') {
        <div class="static-panels" [hidden]="mounted()" [style.grid-template-columns]="columns(initial.value.columns)">
          @for (panel of initial.value.panels; track panel.id) {
            <nc-chart-fallback [data]="panel.data" [options]="panel.options" [instanceId]="instanceId()" />
          }
        </div>
      } @else if (!mounted()) {
        <p role="alert">{{ initial.diagnostic.message }}</p>
      }
    }
  `,
})
export class NeuralChartPanels {
  readonly data = input.required<ChartPanelsData>();
  readonly options = input<ChartPanelsOptions>({});
  readonly instanceId = input.required<string>();
  readonly viewportChange = output<ChartPanelViewportChange>();
  readonly hiddenSeriesChange = output<ChartPanelVisibilityChange>();
  readonly diagnostic = output<ChartPanelDiagnostic>();
  protected readonly root = computed(() => resolveChartPanels(this.data(), this.options()));
  protected readonly mounted = signal(false);
  protected readonly columns = chartPanelColumns;

  private readonly destroyRef = inject(DestroyRef);
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly browserReady = signal(false);
  private controller?: ChartPanelsController;
  private id?: string;

  constructor() {
    afterNextRender(() => this.browserReady.set(true));
    effect(() => {
      if (this.browserReady()) this.apply(this.data(), this.options(), this.instanceId());
    });
    this.destroyRef.onDestroy(() => this.controller?.destroy());
  }

  setViewport(panelId: string, value: ChartPanelViewportValue): ChartResult<ChartPanelViewportValue> {
    return this.controller?.setViewport(panelId, value) ?? {
      status: 'invalid',
      diagnostic: { code: 'INVALID_CONFIG', reason: 'BROWSER_CHART_REQUIRED', path: 'panelId', message: 'BROWSER_CHART_REQUIRED' },
    };
  }
  getViewport(panelId: string): ChartPanelViewportValue | undefined { return this.controller?.getViewport(panelId); }
  getHiddenSeriesIds(panelId: string): readonly string[] | undefined { return this.controller?.getHiddenSeriesIds(panelId); }

  private apply(data: ChartPanelsData, options: ChartPanelsOptions, instanceId: string): void {
    if (this.destroyRef.destroyed) return;
    if (this.controller && this.id === instanceId) {
      const result = this.controller.update(data, options);
      if (result.status === 'invalid') this.diagnostic.emit({ panelId: null, diagnostic: result.diagnostic });
      return;
    }
    const result = createChartPanels(this.surface().nativeElement, data, options, {
      instanceId,
      onViewportChange: value => { if (!this.destroyRef.destroyed) this.viewportChange.emit(value); },
      onHiddenSeriesChange: value => { if (!this.destroyRef.destroyed) this.hiddenSeriesChange.emit(value); },
      onDiagnostic: value => { if (!this.destroyRef.destroyed) this.diagnostic.emit(value); },
    });
    if (result.status === 'invalid') { this.diagnostic.emit({ panelId: null, diagnostic: result.diagnostic }); return; }
    if (this.destroyRef.destroyed) { result.value.destroy(); return; }
    this.controller?.destroy();
    this.controller = result.value;
    this.id = instanceId;
    this.mounted.set(true);
  }
}
