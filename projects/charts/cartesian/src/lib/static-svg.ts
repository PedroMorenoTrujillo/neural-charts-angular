import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, Directive, ElementRef, inject, input, Renderer2, effect } from '@angular/core';

export interface SvgNode { readonly tag: string; readonly attributes: Readonly<Record<string, string>>; readonly children: SvgNode[]; text: string; }
const tags = new Set(['svg', 'title', 'desc', 'defs', 'clipPath', 'linearGradient', 'pattern', 'stop', 'rect', 'g', 'path', 'circle', 'polygon', 'text', 'tspan']);
function decode(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
    return named[entity] ?? String.fromCodePoint(entity[2] === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1)));
  });
}
/** Parses only our escaped SVG serializer, never consumer HTML. Angular owns every resulting node. */
export function parseSvg(value: string): SvgNode | undefined {
  const stack: SvgNode[] = []; let root: SvgNode | undefined;
  for (const token of value.matchAll(/<[^>]+>|[^<]+/g)) {
    const part = token[0];
    if (part.startsWith('</')) { const node = stack.pop(); if (!node || part !== `</${node.tag}>`) throw Error('INVALID_SERIALIZED_SVG'); }
    else if (part.startsWith('<')) {
      const tag = /^<([A-Za-z]+)/.exec(part)?.[1]; if (!tag || !tags.has(tag)) throw Error('UNSUPPORTED_SERIALIZED_SVG');
      const attributes: Record<string, string> = {};
      for (const match of part.matchAll(/([\w:-]+)="([^"]*)"/g)) {
        const name = match[1]!, value = match[2]!;
        if (/^on|^(?:href|src)$/i.test(name)) throw Error('UNSAFE_SERIALIZED_ATTRIBUTE');
        attributes[name] = decode(value);
      }
      const node: SvgNode = { tag, attributes, children: [], text: '' };
      if (stack.length) stack.at(-1)!.children.push(node); else if (root) throw Error('MULTIPLE_SVG_ROOTS'); else root = node;
      if (!part.endsWith('/>')) stack.push(node);
    } else if (stack.length) stack.at(-1)!.text += decode(part);
  }
  if (stack.length || root?.tag !== 'svg') throw Error('INVALID_SERIALIZED_SVG');
  return root;
}

@Directive({ selector: '[ncSvgAttributes]' })
export class SvgAttributes {
  readonly attributes = input.required<Readonly<Record<string, string>>>({ alias: 'ncSvgAttributes' });
  private readonly element = inject(ElementRef); private readonly renderer = inject(Renderer2);
  constructor() {
    let previous: Readonly<Record<string, string>> = {};
    effect(() => {
      const next = this.attributes();
      for (const key of Object.keys(previous)) if (!(key in next)) this.renderer.removeAttribute(this.element.nativeElement, key);
      for (const [key, value] of Object.entries(next)) if (previous[key] !== value) this.renderer.setAttribute(this.element.nativeElement, key, value);
      previous = next;
    });
  }
}

/** Static, hydratable SVG projection. Browser interaction belongs to the web controller. */
export const SVG_TEMPLATE=`@if (tree(); as root) {
    <svg [ncSvgAttributes]="root.attributes">
      <ng-container *ngTemplateOutlet="nodes; context: { $implicit: root.children }" />
      <ng-template #nodes let-items>
        @for (node of items; track $index) {
          @switch (node.tag) {
            @case ('g') { <g [ncSvgAttributes]="node.attributes"><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></g> }
            @case ('defs') { <defs [ncSvgAttributes]="node.attributes"><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></defs> }
            @case ('clipPath') { <clipPath [ncSvgAttributes]="node.attributes"><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></clipPath> }
            @case ('linearGradient') { <linearGradient [ncSvgAttributes]="node.attributes"><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></linearGradient> }
            @case ('pattern') { <pattern [ncSvgAttributes]="node.attributes"><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></pattern> }
            @case ('stop') { <stop [ncSvgAttributes]="node.attributes" /> }
            @case ('path') { <path [ncSvgAttributes]="node.attributes" /> }
            @case ('rect') { <rect [ncSvgAttributes]="node.attributes" /> }
            @case ('circle') { <circle [ncSvgAttributes]="node.attributes" /> }
            @case ('polygon') { <polygon [ncSvgAttributes]="node.attributes" /> }
            @case ('title') { <title [ncSvgAttributes]="node.attributes">{{node.text}}</title> }
            @case ('desc') { <desc [ncSvgAttributes]="node.attributes">{{node.text}}</desc> }
            @case ('text') { <text [ncSvgAttributes]="node.attributes">{{node.text}}<ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></text> }
            @case ('tspan') { <tspan [ncSvgAttributes]="node.attributes">{{node.text}}</tspan> }
          }
        }
      </ng-template>
    </svg>
  }`;
export const SVG_STYLES=':host{display:block;min-width:0}svg{display:block;max-width:100%;height:auto}';
/** Private SVG projection shared by generic and granular interactive hosts. */
@Component({selector:'nc-static-svg',imports:[NgTemplateOutlet,SvgAttributes],changeDetection:ChangeDetectionStrategy.OnPush,template:SVG_TEMPLATE,styles:SVG_STYLES})
export class StaticSvg{
  readonly serialized=input.required<import('@neural-charts/web').ChartResult<string>>();
  protected readonly tree=computed(()=>{const result=this.serialized();return result.status==='ok'?parseSvg(result.value):undefined;});
}
