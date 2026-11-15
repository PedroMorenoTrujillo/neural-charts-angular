import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createCartesianChart, renderCartesianChartSvg } from '@neural-charts/web/cartesian';
import type { CartesianChartData } from '@neural-charts/web/cartesian';
import { ChartHost, CHART_TEMPLATE, CHART_STYLES } from './chart-host';
import { StaticSvg } from './static-svg';

@Component({
  selector: 'nc-cartesian-chart',
  imports: [StaticSvg],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: CHART_TEMPLATE,
  styles: CHART_STYLES,
})
export class NeuralCartesianChart extends ChartHost<CartesianChartData> {
  protected override readonly createController = createCartesianChart;
  protected override readonly serialize = renderCartesianChartSvg;
}
