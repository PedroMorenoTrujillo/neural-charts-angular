# Neural Charts Angular

[Documentation and examples](https://charts.neuralui.org/)

Angular 22 adapter over `@neural-charts/web`. Import NeuralChart and the public ChartData/ChartOptions types from @neural-charts/angular.

```html
<nc-chart [data]="data()" [options]="options()" instanceId="activity"
  (pointActivate)="onPoint($event)" />
```

Inputs data/instanceId are required; options, planningPorts and synchronization are optional. Outputs: pointActivate, hiddenSeriesChange, selectionChange, viewportChange and diagnostic. Use immutable domain data and stable IDs. Core owns calculation; Web owns SVG/interaction; the adapter owns lifecycle. Core remains independent. Component methods exportSvg/exportCsv return contained results; exportPng returns a browser Blob promise.

Zoneless, OnPush and signals. SSR includes actual Angular-owned SVG and original data. Those static nodes hydrate and remain hidden after one interactive Web owner mounts. No innerHTML or skipped hydration is used. WordCloud server rendering requires a real measured planningPorts font port. DestroyRef releases browser resources. Manual screen-reader and human visual approval remain pending. Angular Common/Core are the necessary peers; Web is the renderer peer dependency.

Install with `npm install @neural-charts/angular`. npm resolves the compatible Web peer and its Core dependency. The application supplies compatible Angular Core and Common versions.

## Zoom toolbar

Use `ChartToolbarAction.Zoom` in `toolbar.actions` and configure the axes in `viewport.axes`. Import `ChartToolbarAction` and `ChartZoomPosition` from `@neural-charts/angular`. Set `viewport.zoom.position` to `ChartZoomPosition.Below` for a separate row, or keep the default position with the download buttons. The slider is optional. Enable it with `viewport.zoom.showSlider`.

To build the source, use Node.js 22.22.3 or newer. Run `npm ci` and `npm run build`.

Licensed under [MIT](./LICENSE).
