import {afterNextRender,computed,contentChild,DestroyRef,Directive,effect,ElementRef,inject,input,output,signal,viewChild,ViewContainerRef} from '@angular/core';
import type {TemplateRef} from '@angular/core';
import type {OutputEmitterRef} from '@angular/core';
import {describeChartData,exportChartCsv,formatChartTitle,validateChartContent} from '@neural-charts/web';
import type {ChartController,ChartData,ChartOptions,ChartPointId,ChartDiagnostic,ChartMountOptions,ChartPlanningPorts,PlanObservation,ChartResult,CsvExportOptions,PngExportOptions,SvgExportOptions,SvgRenderOptions} from '@neural-charts/web';
import type {ChartContentPorts,ChartContentKey,ChartContentSlot} from '@neural-charts/web';
import {NeuralChartTitleTemplate,NeuralChartTooltipTemplate,NeuralChartLegendTemplate,NeuralChartAxisLabelTemplate,NeuralChartDataLabelTemplate} from './content-templates';
import type {ChartTemplateContext} from './content-templates';
type Activation = Readonly<{
  id: ChartPointId;
  observation: PlanObservation;
  source: 'pointer' | 'keyboard';
  revision: number;
}>;
type Viewport=Parameters<NonNullable<ChartMountOptions['onViewportChange']>>[0];
const unavailableViewport = {status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:'BROWSER_CHART_REQUIRED',path:'options.viewport',message:'BROWSER_CHART_REQUIRED'}} as const;
export const CHART_TEMPLATE=`
    <div #surface></div>
    <section data-nc-ssr [hidden]="mounted()" [attr.aria-label]="serverTitle()" [attr.dir]="options().direction || 'ltr'" [attr.lang]="options().locale ?? 'en'">
      <div [style.overflow-x]="options().appearance?.minPlotWidth ? 'auto' : null">
        <nc-static-svg [serialized]="serverSvg()" />
      </div>
      <h2 [style.text-align]="options().appearance?.titleStyle?.align"
        [style.color]="options().appearance?.titleStyle?.color"
        [style.font-size.px]="options().appearance?.titleStyle?.fontSize"
        [style.font-weight]="options().appearance?.titleStyle?.fontWeight">{{serverTitle()}}</h2>
      @if (options().description) {
        <p [style.text-align]="options().appearance?.descriptionStyle?.align"
          [style.color]="options().appearance?.descriptionStyle?.color"
          [style.font-size.px]="options().appearance?.descriptionStyle?.fontSize"
          [style.font-weight]="options().appearance?.descriptionStyle?.fontWeight">{{ options().description }}</p>
      }
      @if (table(); as result) {
        @if (result.status === 'ok') {
          <table><caption>{{ options().locale === 'es' ? 'Datos originales' : 'Original data' }}</caption><thead><tr>
            @for (column of result.value.columns; track $index) { <th scope="col">{{ column }}</th> }
          </tr></thead><tbody>
            @for (row of result.value.rows; track $index) { <tr>
              @for (value of row; track $index) { <td>{{ value }}</td> }
            </tr> }
          </tbody></table>
          @if ((result.value.totalRows ?? result.value.rows.length) > 100) { <p>{{ options().locale === 'es' ? 'Filas de datos originales: ' : 'Original data rows: ' }}{{ result.value.totalRows ?? result.value.rows.length }}. {{ options().locale === 'es' ? 'La tabla interactiva permite recorrer todas las filas.' : 'The interactive table provides pagination.' }}</p> }
        } @else { <p role="status">{{ options().locale === 'es' ? 'No se pueden mostrar los datos del gráfico.' : 'Unable to display chart data.' }}</p> }
      }
    </section>`;
export const CHART_STYLES=':host{display:block;min-width:0}[data-nc-ssr]{font:14px system-ui;padding:20px}[data-nc-ssr] h2{font-size:18px}[data-nc-ssr] table{border-collapse:collapse;width:100%}[data-nc-ssr] th,[data-nc-ssr] td{text-align:start;padding:6px 10px;border-bottom:1px solid #8596ad}';

/** Shared Angular ownership without a default chart planner. */
@Directive()
export abstract class ChartHost<T extends ChartData>{
  protected abstract readonly createController:(host:HTMLElement,data:T,options:ChartOptions,mount:ChartMountOptions)=>ChartResult<ChartController>;
  protected abstract readonly serialize:(data:T,options:ChartOptions,settings:SvgRenderOptions)=>ChartResult<string>;
  protected readonly serverSvg=computed(()=>{const projection=this.ssrProjection();return this.serialize(projection.data,projection.options,{instanceId:this.instanceId(),...(projection.planningPorts?{ports:projection.planningPorts}:{}),...(projection.content!==undefined?{content:projection.content}:{})});});
  protected readonly serverTitle=computed(()=>{const p=this.ssrProjection();return formatChartTitle(p.data,p.options,p.content);});

  readonly data = input.required<T>();
  readonly options = input<ChartOptions>({});
  readonly instanceId = input.required<string>();
  readonly planningPorts = input<ChartPlanningPorts>();
  readonly content=input<ChartContentPorts>();
  readonly synchronization = input<ChartMountOptions['synchronization']>();
  readonly pointActivate = output<Activation>();
  readonly hiddenSeriesChange = output<readonly string[]>();
  readonly selectionChange = output<readonly ChartPointId[]>();
  readonly viewportChange: OutputEmitterRef<Viewport> = output<Viewport>();
  readonly diagnostic = output<ChartDiagnostic>();
  protected readonly mounted = signal(false);
  private readonly views=inject(ViewContainerRef);
  private readonly titleTemplate=contentChild(NeuralChartTitleTemplate);
  private readonly tooltipTemplate=contentChild(NeuralChartTooltipTemplate);
  private readonly legendTemplate=contentChild(NeuralChartLegendTemplate);
  private readonly axisLabelTemplate=contentChild(NeuralChartAxisLabelTemplate);
  private readonly dataLabelTemplate=contentChild(NeuralChartDataLabelTemplate);
  private templateSlot<K extends ChartContentKey>(base:ChartContentSlot<K>|undefined,template:TemplateRef<ChartTemplateContext<K>>):ChartContentSlot<K>{
    return{text:base?.text??(context=>context.defaultText),render:(host,context,signal)=>{
      if(signal.aborted)return;
      const view=this.views.createEmbeddedView(template,{$implicit:context,context});
      try{view.detectChanges();for(const node of view.rootNodes as Node[])host.appendChild(node);}catch(error){view.destroy();throw error;}
      return()=>view.destroy();
    }};
  }
  protected readonly contentPorts=computed<ChartContentPorts|undefined>(()=>{
    const validated=validateChartContent(this.content()),base=validated.status==='ok'?validated.value:this.content(),title=this.titleTemplate()?.template,tooltip=this.tooltipTemplate()?.template,legend=this.legendTemplate()?.template,axisLabel=this.axisLabelTemplate()?.template,dataLabel=this.dataLabelTemplate()?.template;
    if(validated.status==='invalid'||!title&&!tooltip&&!legend&&!axisLabel&&!dataLabel)return base;
    return{...base,...(title?{title:this.templateSlot<'title'>(base?.title,title)}:{}),...(tooltip?{tooltip:this.templateSlot<'tooltip'>(base?.tooltip,tooltip)}:{}),...(legend?{legend:this.templateSlot<'legend'>(base?.legend,legend)}:{}),...(axisLabel?{axisLabel:this.templateSlot<'axisLabel'>(base?.axisLabel,axisLabel)}:{}),...(dataLabel?{dataLabel:this.templateSlot<'dataLabel'>(base?.dataLabel,dataLabel)}:{})};
  });
  // Retain the actual hydrated fallback DOM without recalculating a second,
  // hidden chart after the browser owner has taken over.
  private retainedProjection: Readonly<{data:T;options:ChartOptions;planningPorts:ChartPlanningPorts|undefined;content:ChartContentPorts|undefined}>|undefined;
  protected readonly ssrProjection = computed(() => this.mounted() && this.retainedProjection ? this.retainedProjection : {data:this.data(),options:this.options(),planningPorts:this.planningPorts(),content:this.contentPorts()});
  protected readonly table = computed(() => { const {data, options} = this.ssrProjection(); return describeChartData(data, options.hiddenSeriesIds ?? [], options.locale, {offset: 0, limit: 100}); });
  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly destroyRef = inject(DestroyRef);
  private controller: ChartController | undefined;
  private currentData: T | undefined;
  private currentId = '';
  private currentSynchronization: ChartMountOptions['synchronization'];
  private browserReady = false;

  constructor() {
    afterNextRender(() => { this.browserReady = true; this.apply(this.data(), this.options(), this.instanceId()); });
    effect(() => { const data = this.data(), options = this.options(), id = this.instanceId(); this.planningPorts(); this.synchronization();this.contentPorts();if (this.browserReady) this.apply(data, options, id); });
    this.destroyRef.onDestroy(() => { this.controller?.destroy(); this.controller = undefined; });
  }
  exportSvg(settings:SvgExportOptions={}) { const ports = this.planningPorts(),content=this.contentPorts();return this.controller ? { status: 'ok' as const, value: this.controller.exportSvg(settings) } : this.serialize(this.data(), this.options(), { ...settings,composition:settings.composition??'chart',instanceId: this.instanceId(), ...(ports ? { ports } : {}),...(!Object.hasOwn(settings,'content')&&content!==undefined?{content}:{}) }); }
  exportCsv(options?: CsvExportOptions) { return this.controller ? this.controller.exportCsv(options) : exportChartCsv(this.data(), options); }
  setViewport(value: Viewport): ChartResult<Viewport> { return this.controller?.setViewport(value) ?? unavailableViewport; }
  zoomBy(factor: number): ChartResult<Viewport> { return this.controller?.zoomBy(factor) ?? unavailableViewport; }
  resetViewport(): ChartResult<Viewport> { return this.controller?.resetViewport() ?? unavailableViewport; }
  exportPng(options?: PngExportOptions): Promise<Blob> { return this.controller?.exportPng(options) ?? Promise.reject(new Error('BROWSER_CHART_REQUIRED')); }
  private apply(data: T, options: ChartOptions, instanceId: string): void {
    if (this.destroyRef.destroyed) return;
    if (this.controller && (instanceId !== this.currentId || this.synchronization() !== this.currentSynchronization)) { this.controller.destroy(); this.controller = undefined; this.mounted.set(false); }
    const content=this.contentPorts();
    if (this.controller) { const result = data === this.currentData ? this.controller.updateOptions(options,content) : this.controller.update(data,options,content); if (result.status === 'invalid') this.diagnostic.emit(result.diagnostic); else this.currentData = data; return; }
    const synchronization = this.synchronization();
    const result = this.createController(this.surface().nativeElement, data, options, {
      instanceId, ...(synchronization ? { synchronization } : {}),...(content!==undefined?{content}:{}),
      onPointActivate: value => { if (!this.destroyRef.destroyed) this.pointActivate.emit(value); },
      onHiddenSeriesChange: value => { if (!this.destroyRef.destroyed) this.hiddenSeriesChange.emit(value); },
      onSelectionChange: value => { if (!this.destroyRef.destroyed) this.selectionChange.emit(value); },
      onViewportChange: value => { if (!this.destroyRef.destroyed) this.viewportChange.emit(value); },
      onDiagnostic: value => { if (!this.destroyRef.destroyed) this.diagnostic.emit(value); },
    });
    if(this.destroyRef.destroyed){if(result.status==='ok')result.value.destroy();return;}
    if (result.status === 'invalid') this.diagnostic.emit(result.diagnostic);
    else { this.retainedProjection = this.ssrProjection(); this.controller = result.value; this.currentData = data; this.currentId = instanceId; this.currentSynchronization = synchronization; this.mounted.set(true); }
  }
}
