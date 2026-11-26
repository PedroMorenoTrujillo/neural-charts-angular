import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { renderChartSvg } from '@neural-charts/web';
import type { ChartData, ChartOptions, ChartPlanningPorts, ChartContentPorts } from '@neural-charts/web';
import { ɵSvgAttributes as SvgAttributes, ɵparseSvg as parseSvg, ɵfallbackSvgNamespace as fallbackSvgNamespace, ɵSVG_TEMPLATE as SVG_TEMPLATE, ɵSVG_STYLES as SVG_STYLES } from '@neural-charts/angular/cartesian';
import type { ɵSvgNode as SvgNode } from '@neural-charts/angular/cartesian';

/** Existing public static adapter: preserve its inputs and direct SVG template. */
@Component({selector:'nc-static-chart',imports:[NgTemplateOutlet,SvgAttributes],changeDetection:ChangeDetectionStrategy.OnPush,template:SVG_TEMPLATE,styles:SVG_STYLES})
export class StaticChart {
  readonly data = input.required<ChartData>(); readonly options = input<ChartOptions>({});
  readonly instanceId = input.required<string>(); readonly planningPorts = input<ChartPlanningPorts>();
  readonly content=input<ChartContentPorts>();
  protected readonly namespace?: string;
  protected readonly tree = computed<SvgNode | undefined>(() => {
    const ports = this.planningPorts(),content=this.content();
    const result = renderChartSvg(this.data(),this.options(),{instanceId:this.instanceId(),...(ports?{ports}:{}),...(content!==undefined?{content}:{})});
    return result.status === 'ok' ? parseSvg(result.value, this.namespace) : undefined;
  });
}

@Component({selector:'nc-chart-fallback',imports:[NgTemplateOutlet,SvgAttributes],changeDetection:ChangeDetectionStrategy.OnPush,template:SVG_TEMPLATE,styles:SVG_STYLES})
export class ChartFallback extends StaticChart {
  protected override readonly namespace = fallbackSvgNamespace();
}
