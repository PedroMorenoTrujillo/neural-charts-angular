import { Directive, inject, TemplateRef } from '@angular/core';
import type {ChartContentKey,ChartRenderContext} from '@neural-charts/web';
export interface ChartTemplateContext<K extends ChartContentKey>{readonly $implicit:ChartRenderContext<K>;readonly context:ChartRenderContext<K>;}
@Directive()
abstract class ContentTemplate<K extends ChartContentKey>{readonly template=inject<TemplateRef<ChartTemplateContext<K>>>(TemplateRef);}
@Directive({selector:'ng-template[ncChartTitle]'})
export class NeuralChartTitleTemplate extends ContentTemplate<'title'>{static ngTemplateContextGuard(_directive:NeuralChartTitleTemplate,context:unknown):context is ChartTemplateContext<'title'>{return true;}}
@Directive({selector:'ng-template[ncChartTooltip]'})
export class NeuralChartTooltipTemplate extends ContentTemplate<'tooltip'>{static ngTemplateContextGuard(_directive:NeuralChartTooltipTemplate,context:unknown):context is ChartTemplateContext<'tooltip'>{return true;}}
@Directive({selector:'ng-template[ncChartLegend]'})
export class NeuralChartLegendTemplate extends ContentTemplate<'legend'>{static ngTemplateContextGuard(_directive:NeuralChartLegendTemplate,context:unknown):context is ChartTemplateContext<'legend'>{return true;}}
/** Label templates contain SVG tspan/text nodes, never arbitrary HTML. */
@Directive({selector:'ng-template[ncChartAxisLabel]'})
export class NeuralChartAxisLabelTemplate extends ContentTemplate<'axisLabel'>{static ngTemplateContextGuard(_directive:NeuralChartAxisLabelTemplate,context:unknown):context is ChartTemplateContext<'axisLabel'>{return true;}}
@Directive({selector:'ng-template[ncChartDataLabel]'})
export class NeuralChartDataLabelTemplate extends ContentTemplate<'dataLabel'>{static ngTemplateContextGuard(_directive:NeuralChartDataLabelTemplate,context:unknown):context is ChartTemplateContext<'dataLabel'>{return true;}}
