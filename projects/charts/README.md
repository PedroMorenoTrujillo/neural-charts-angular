# Neural Charts Angular

Private local adapter for Angular22.2.3 over @neural-charts/web. Import NeuralChart and the public ChartData/ChartOptions types from @neural-charts/angular.

```html
<nc-chart [data]="data()" [options]="options()" instanceId="activity"
  (pointActivate)="onPoint($event)" />
```

Inputs data/instanceId are required; options, planningPorts and synchronization are optional. Outputs: pointActivate, hiddenSeriesChange, selectionChange, viewportChange and diagnostic. Use immutable domain data and stable IDs. Core owns calculation; Web owns SVG/interaction; the adapter owns lifecycle. Core remains independent. Component methods exportSvg/exportCsv return contained results; exportPng returns a browser Blob promise.

Zoneless, OnPush and signals. SSR includes actual Angular-owned SVG and original data. Those static nodes hydrate and remain hidden after one interactive Web owner mounts. No innerHTML or skipped hydration is used. WordCloud server rendering requires a real measured planningPorts font port. DestroyRef releases browser resources. Manual screen-reader and human visual approval remain pending. Angular Common/Core are the necessary peers; the only package runtime dependency is Web.

This package is not authorized for publication. Consume the actual local npm-pack archive and consult the repository README and EXECUTION-LEDGER.md for development, verification and outstanding gates. No source aliases, symlinks or patched dependencies.
