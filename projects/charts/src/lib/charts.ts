import {ChangeDetectionStrategy,Component} from '@angular/core';
import {createChart,renderChartSvg} from '@neural-charts/web';
import type {ChartData} from '@neural-charts/web';
import { ɵChartHost as ChartHost, ɵCHART_TEMPLATE as CHART_TEMPLATE, ɵCHART_STYLES as CHART_STYLES, ɵStaticSvg as StaticSvg } from '@neural-charts/angular/cartesian';

/** Full-catalogue adapter; existing inputs, outputs and exports are preserved. */
@Component({selector:'nc-chart',standalone:true,imports:[StaticSvg],changeDetection:ChangeDetectionStrategy.OnPush,template:CHART_TEMPLATE,styles:CHART_STYLES})
export class NeuralChart extends ChartHost<ChartData>{
  protected override readonly createController=createChart;
  protected override readonly serialize=renderChartSvg;
}

export { NeuralCartesianChart } from '@neural-charts/angular/cartesian';
