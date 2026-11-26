import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import { NeuralChart, NeuralCartesianChart } from './charts';
import {StaticChart} from './server-chart';
import {Component,Directive,DestroyRef,inject,signal} from '@angular/core';
import {NeuralChartTitleTemplate,NeuralChartTooltipTemplate,NeuralChartLegendTemplate,NeuralChartAxisLabelTemplate,NeuralChartDataLabelTemplate} from '@neural-charts/angular/cartesian';
import type { ChartData,ChartContentPorts } from '@neural-charts/web';

const data = Object.freeze({ type: 'line', axes: { x: { type: 'linear' }, y: { type: 'linear' } }, series: [{ id: 's', name: 'Source', data: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 2 }] }] } as const satisfies ChartData);
let createdViews=0,destroyedViews=0;
@Directive({selector:'[contentProbe]'})
class ContentProbe{constructor(){createdViews++;inject(DestroyRef).onDestroy(()=>destroyedViews++);}}
@Component({imports:[NeuralCartesianChart,NeuralChartTitleTemplate,NeuralChartTooltipTemplate,NeuralChartLegendTemplate,NeuralChartAxisLabelTemplate,NeuralChartDataLabelTemplate,ContentProbe],template:`<nc-cartesian-chart [data]="data" [options]="options" [content]="content" instanceId="template-owner">@if(enabled()){
  <ng-template ncChartTitle let-title><strong contentProbe>{{title.text}}</strong></ng-template>
  <ng-template ncChartTooltip let-tip><strong contentProbe>{{tip.text}}</strong></ng-template>
  <ng-template ncChartLegend let-series><em contentProbe>{{series.text}}</em></ng-template>
  <ng-template ncChartAxisLabel let-label><svg:tspan contentProbe font-weight="600">{{label.text}}</svg:tspan></ng-template>
  <ng-template ncChartDataLabel let-label><svg:tspan contentProbe font-weight="700">{{label.text}}</svg:tspan></ng-template>
}</nc-cartesian-chart>`})
class ContentHost{
  readonly data=data;readonly enabled=signal(true);readonly options={title:'Custom chart',appearance:{dataLabels:true}};
  readonly content:ChartContentPorts={title:{text:context=>context.defaultText+' · audited'},tooltip:{text:context=>'Point '+context.observation.id.pointId},legend:{text:context=>context.name+' · original'}};
}
@Component({imports:[NeuralCartesianChart,NeuralChartTooltipTemplate],template:`<nc-cartesian-chart [data]="data" [options]="options" [content]="content()" instanceId="invalid-content" (diagnostic)="diagnostics.push($event.reason)"><ng-template ncChartTooltip let-tip><strong>{{tip.text}}</strong></ng-template></nc-cartesian-chart>`})
class InvalidContentHost{readonly data=data;readonly options={title:'Safe title'};readonly diagnostics:string[]=[];readonly content=signal<ChartContentPorts|undefined>(undefined);}

@Component({
  imports: [NeuralChart, NeuralCartesianChart],
  template: `
    <nc-chart [data]="series" [options]="options" instanceId="identity"
      (diagnostic)="diagnostics.push($event.reason)" />
    <nc-cartesian-chart [data]="series" [options]="options" instanceId="identity-ssr"
      (diagnostic)="diagnostics.push($event.reason)" />
    <nc-chart [data]="series" [options]="options" instanceId="identity"
      (diagnostic)="diagnostics.push($event.reason)" />
    <nc-chart [data]="series" [options]="options" [instanceId]="longId"
      (diagnostic)="diagnostics.push($event.reason)" />
  `,
})
class IdentityHost {
  readonly series = {
    type:'column',
    axes:{x:{type:'category',values:[{id:'a',label:'A'}]},y:{type:'linear'}},
    series:[{id:'s',name:'Source',data:[{id:'p',x:'a',y:10}]}],
  } as const satisfies ChartData;
  readonly options = {title:'Identity',description:'Original description',appearance:{series:[{id:'s',pattern:'diagonal',color:'#2c6ed5'}]}} as const;
  readonly diagnostics: string[] = [];
  readonly longId = 'a'.repeat(96);
}
let previous: PropertyDescriptor | undefined;
let previousBBox:PropertyDescriptor|undefined;
beforeEach(() => {
  previous = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  // Unit DOM adapter only. Real observers/hydration/resources are browser gates in the showcase.
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: class { observe(): void {} disconnect(): void {} } });
  // jsdom has no SVG glyph geometry. Only ownership is asserted here; real
  // glyph bounds/pruning are verified in the three-engine browser campaign.
  previousBBox=Object.getOwnPropertyDescriptor(SVGElement.prototype,'getBBox');Object.defineProperty(SVGElement.prototype,'getBBox',{configurable:true,value:()=>new DOMRect(0,0,0,0)});
});
afterEach(() => { TestBed.resetTestingModule(); if (previous) Object.defineProperty(window, 'ResizeObserver', previous); else Reflect.deleteProperty(window, 'ResizeObserver');if(previousBBox)Object.defineProperty(SVGElement.prototype,'getBBox',previousBBox);else Reflect.deleteProperty(SVGElement.prototype,'getBBox'); });
describe('NeuralChart ownership', () => {
  it('isolates fallback SVG IDs from valid live IDs and repeated projections', async () => {
    const fixture = TestBed.createComponent(IdentityHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const charts = [...host.querySelectorAll('nc-chart, nc-cartesian-chart')];
    expect(charts.map(chart => !!chart.querySelector('[data-nc-web]'))).toEqual([true, true, false, true]);
    expect(fixture.componentInstance.diagnostics).toEqual(['DUPLICATE_INSTANCE_ID']);

    const allIds = [...host.querySelectorAll('[id]')].map(node => node.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const chart of charts) {
      const svg = chart.querySelector('[data-nc-ssr] svg')!;
      expect(svg).not.toBeNull();
      const ids = new Set([...svg.querySelectorAll('[id]')].map(node => node.id));
      expect(svg.getAttribute('aria-labelledby')?.split(/\s+/).every(id => ids.has(id))).toBe(true);
      const pattern = svg.querySelector('pattern')!;
      expect(svg.querySelector('rect[fill="url(#' + pattern.id + ')"]')).not.toBeNull();
      const clip = svg.querySelector('clipPath')!;
      expect(svg.querySelector('[clip-path="url(#' + clip.id + ')"]')).not.toBeNull();
    }
    fixture.destroy();
  });
  it('rejects root and nested content accessors before combining TemplateRefs and retains the last valid chart',async()=>{
    let reads=0;const rootGetter={};Object.defineProperty(rootGetter,'title',{enumerable:true,get(){reads++;throw Error('Unsafe root getter')}});
    const nested={title:Object.defineProperty({text:()=>''},'render',{enumerable:true,get(){reads++;throw Error('Unsafe nested getter')}})};
    const fixture=TestBed.createComponent(InvalidContentHost);fixture.componentInstance.content.set(rootGetter as ChartContentPorts);fixture.detectChanges();await fixture.whenStable();expect(reads).toBe(0);expect(fixture.nativeElement.querySelector('[data-nc-web]')).toBeNull();expect(fixture.nativeElement.querySelector('[data-nc-ssr] h2')?.textContent).toBe('Safe title');expect(fixture.componentInstance.diagnostics).toContain('INVALID_CONTENT_PORTS');
    const component=fixture.debugElement.query(By.directive(NeuralCartesianChart)).componentInstance as NeuralCartesianChart;
    for(const ports of [rootGetter,null,false]){fixture.componentInstance.content.set(ports as unknown as ChartContentPorts);fixture.detectChanges();await fixture.whenStable();const exported=component.exportSvg();expect(exported.status).toBe('invalid');if(exported.status==='invalid')expect(exported.diagnostic.reason).toBe('INVALID_CONTENT_PORTS');}
    fixture.componentInstance.content.set(undefined);fixture.detectChanges();await fixture.whenStable();const owner=fixture.nativeElement.querySelector('[data-nc-web]');expect(owner).not.toBeNull();
    for(const ports of [nested,{title:{text:3}},null,false,{[Symbol('hidden')]:()=>''}]){fixture.componentInstance.content.set(ports as unknown as ChartContentPorts);fixture.detectChanges();await fixture.whenStable();expect(fixture.nativeElement.querySelector('[data-nc-web]')).toBe(owner);expect(owner.querySelector('h2')?.textContent).toBe('Safe title');}
    expect(reads).toBe(0);expect(fixture.componentInstance.diagnostics.length).toBeGreaterThanOrEqual(6);fixture.destroy();
  });

  it('owns all five typed TemplateRef slots and destroys every embedded view on replacement and destroy',async()=>{
    createdViews=0;destroyedViews=0;const fixture=TestBed.createComponent(ContentHost);fixture.detectChanges();await fixture.whenStable();
    const root:HTMLElement=fixture.nativeElement.querySelector('[data-nc-web]');expect(root.querySelector('h2 strong')?.textContent).toBe('Custom chart · audited');expect(root.querySelector('[data-action="legend"] em')?.textContent).toBe('Source · original');
    const labels=[...root.querySelectorAll('text[data-nc-content] tspan')];expect(labels.length).toBeGreaterThan(0);expect(labels.every(node=>node.namespaceURI==='http://www.w3.org/2000/svg')).toBe(true);
    root.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));expect(root.querySelector('[role="tooltip"] strong')?.textContent).toBe('Point a');
    root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(root.querySelector('[role="tooltip"] strong')).toBeNull();
    fixture.componentInstance.enabled.set(false);fixture.detectChanges();await fixture.whenStable();expect(root.querySelector('h2 strong')).toBeNull();expect(root.querySelector('h2')?.textContent).toBe('Custom chart · audited');expect(createdViews).toBeGreaterThan(4);expect(destroyedViews).toBe(createdViews);
    fixture.componentInstance.enabled.set(true);fixture.detectChanges();await fixture.whenStable();expect(root.querySelector('h2 strong')).not.toBeNull();fixture.destroy();expect(destroyedViews).toBe(createdViews);expect(root.isConnected).toBe(false);
  });
  it('shares portable custom content with its safe static Angular SVG without invoking browser renderers',async()=>{
    const fixture=TestBed.createComponent(StaticChart);fixture.componentRef.setInput('data',data);fixture.componentRef.setInput('instanceId','content-static');fixture.componentRef.setInput('options',{title:'Server title'});fixture.componentRef.setInput('content',{title:{text:()=>'<Safe custom title>',render:()=>{throw Error('Browser renderer ran on static projection')}}});fixture.detectChanges();await fixture.whenStable();expect(fixture.nativeElement.querySelector('svg title').textContent).toBe('<Safe custom title>');expect(fixture.nativeElement.querySelector('Safe')).toBeNull();fixture.destroy();
  });
  it('keeps malformed falsy content invalid in the static SSR projection',async()=>{
    const fixture=TestBed.createComponent(StaticChart);fixture.componentRef.setInput('data',data);fixture.componentRef.setInput('instanceId','invalid-static');
    for(const content of [null,false,0]){fixture.componentRef.setInput('content',content);fixture.detectChanges();await fixture.whenStable();expect(fixture.nativeElement.querySelector('svg')).toBeNull();}
    fixture.componentRef.setInput('content',undefined);fixture.detectChanges();await fixture.whenStable();expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();fixture.destroy();
  });
  it('projects clipped multiline reference labels with complete safe text and style',async()=>{
    const fixture=TestBed.createComponent(StaticChart),label='The complete original reference label with a long explanation';
    fixture.componentRef.setInput('data',data);fixture.componentRef.setInput('instanceId','wrapped-reference');fixture.componentRef.setInput('options',{width:320,references:[{id:'target',axis:'y',value:1}],referenceLabels:[{id:'target',text:label}],referenceStyles:[{id:'target',color:'#9b3150'}]});fixture.detectChanges();await fixture.whenStable();
    const group=fixture.nativeElement.querySelector('[data-reference-label="target"]');expect(group).not.toBeNull();expect(group.getAttribute('clip-path')).toBe('url(#wrapped-reference-clip)');expect(group.querySelector('[aria-label]').getAttribute('aria-label')).toBe(label);expect(group.querySelector('title').textContent).toBe(label);expect(group.querySelectorAll('text').length).toBeLessThanOrEqual(2);expect(group.querySelector('text').getAttribute('fill')).toBe('#9b3150');fixture.destroy();
  });
  it('mounts the granular Cartesian adapter with inherited signals, exactly-once outputs and composed exports', async () => {
    const fixture=TestBed.createComponent(NeuralCartesianChart);fixture.componentRef.setInput('data',data);fixture.componentRef.setInput('instanceId','granular');fixture.componentRef.setInput('options',{title:'Granular line',description:'Original source'});
    let outputs=0;fixture.componentInstance.pointActivate.subscribe(()=>outputs++);fixture.detectChanges();await fixture.whenStable();
    const root:HTMLElement=fixture.nativeElement.querySelector('[data-nc-web]'),svg=root.querySelector('svg');expect(svg).not.toBeNull();
    root.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));root.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(outputs).toBe(1);
    fixture.componentRef.setInput('options',{title:'Renamed',description:'Original source'});fixture.detectChanges();await fixture.whenStable();expect(root.querySelector('svg')).toBe(svg);
    const exported=fixture.componentInstance.exportSvg();expect(exported.status).toBe('ok');if(exported.status==='ok'){expect(exported.value).toContain('Renamed');expect(exported.value).toContain('Source');}
    fixture.destroy();expect(root.isConnected).toBe(false);
  });
  it('owns safe pattern definitions and fill references in the static Angular SVG projection', async () => {
    for(const pattern of ['diagonal','dots','crosshatch'] as const){
      const fixture=TestBed.createComponent(StaticChart);
      fixture.componentRef.setInput('data',{type:'column',axes:{x:{type:'category',values:[{id:'a',label:'A'}]},y:{type:'linear'}},series:[{id:'s',name:'Source',data:[{id:'p',x:'a',y:10}]}]} satisfies ChartData);
      fixture.componentRef.setInput('options',{appearance:{series:[{id:'s',pattern,color:'#2c6ed5'}]}});fixture.componentRef.setInput('instanceId','pattern-ssr');fixture.detectChanges();await fixture.whenStable();
      const svg:SVGSVGElement=fixture.nativeElement.querySelector('svg'),definition=svg.querySelector('pattern')!;
      expect(definition).not.toBeNull();expect(definition.namespaceURI).toBe('http://www.w3.org/2000/svg');expect(definition.getAttribute('patternUnits')).toBe('userSpaceOnUse');expect(definition.querySelector('rect')).not.toBeNull();expect(svg.querySelector('rect[fill="url(#pattern-ssr-pattern-0)"]')).not.toBeNull();
      fixture.destroy();
    }
  });
  it('keeps the owner during an immutable input update and destroys its SVG', async () => {
    const fixture = TestBed.createComponent(NeuralChart); fixture.componentRef.setInput('data', data); fixture.componentRef.setInput('instanceId', 'test-owner'); fixture.detectChanges(); await fixture.whenStable();
    const root = fixture.nativeElement.querySelector('[data-nc-web]'); expect(root).not.toBeNull();
    fixture.componentRef.setInput('options', { title: 'Updated', theme: 'dark' }); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-nc-web]')).toBe(root); expect(root.querySelector('h2')?.textContent).toBe('Updated');
    fixture.destroy(); expect(root.parentElement).toBeNull(); expect(fixture.nativeElement.querySelector('[data-nc-web]')).toBeNull();
  });
  it('emits one domain activation for a keyboard selection', async () => {
    const fixture = TestBed.createComponent(NeuralChart); fixture.componentRef.setInput('data', data); fixture.componentRef.setInput('instanceId', 'test-events'); let calls = 0;
    fixture.componentInstance.pointActivate.subscribe(() => calls++); fixture.detectChanges(); await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement.querySelector('[data-nc-web]'); root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(calls).toBe(1); fixture.destroy();
  });
  it('exports only accepted data after a rejected update and declares the chart language', async () => {
    const fixture = TestBed.createComponent(NeuralChart);
    const component = fixture.componentInstance;
    const replacement = { ...data, series: [{ ...data.series[0], data: [{ id: 'a', x: 0, y: 529 }] }] } as const;
    fixture.componentRef.setInput('instanceId', 'accepted-data');
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('options', { title: 'Accepted', locale: 'es' });
    fixture.detectChanges();
    await fixture.whenStable();
    const original = component.exportCsv({ delimiter: ';' });
    expect(original.status).toBe('ok');
    expect(fixture.nativeElement.querySelector('[data-nc-web]').lang).toBe('es');
    expect(fixture.nativeElement.querySelector('[data-nc-ssr]').lang).toBe('es');

    fixture.componentRef.setInput('data', replacement);
    fixture.componentRef.setInput('options', { title: 'Rejected', width: -10 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.exportCsv({ delimiter: ';' })).toEqual(original);
    expect(fixture.nativeElement.querySelector('[data-nc-web] h2').textContent).toBe('Accepted');

    fixture.componentRef.setInput('options', { title: 'Recovered', locale: 'en' });
    fixture.detectChanges();
    await fixture.whenStable();
    const recovered = component.exportCsv({ delimiter: ';' });
    expect(recovered.status === 'ok' && recovered.value).toContain('529');
    expect(fixture.nativeElement.querySelector('[data-nc-web]').lang).toBe('en');
  });

  it('retains interactive and hydrated SVGs during options-only changes, while applying new data', async () => {
    const fixture = TestBed.createComponent(NeuralChart); fixture.componentRef.setInput('data', data); fixture.componentRef.setInput('instanceId', 'stable-projection'); fixture.detectChanges(); await fixture.whenStable();
    const svg = fixture.nativeElement.querySelector('[data-nc-web] svg'), ssrSvg = fixture.nativeElement.querySelector('[data-nc-ssr] svg'), row = fixture.nativeElement.querySelector('[data-nc-ssr] tbody tr');
    fixture.componentRef.setInput('options', {title: 'Updated title', selectedPoints: [{seriesId: 's', pointId: 'b'}]}); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-nc-web] svg')).toBe(svg);
    expect(fixture.nativeElement.querySelector('[data-nc-ssr] svg')).toBe(ssrSvg);
    expect(fixture.nativeElement.querySelector('[data-nc-ssr] tbody tr')).toBe(row);
    const details = fixture.nativeElement.querySelector('[data-nc-web] details'); details.open = true; details.dispatchEvent(new Event('toggle'));
    const changed = {...data, series: [{...data.series[0], data: [{id: 'a', x: 0, y: 7}, {id: 'b', x: 1, y: 2}]}]} satisfies ChartData;
    fixture.componentRef.setInput('data', changed); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-nc-web] svg')).not.toBe(svg);
    expect(fixture.nativeElement.querySelector('[data-nc-web] tbody').textContent).toContain('7');
    fixture.destroy();
  });
});
