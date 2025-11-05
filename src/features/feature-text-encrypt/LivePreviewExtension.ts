import { App, editorLivePreviewField } from "obsidian";
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import type { PluginValue } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
// Avoid @codemirror/language to prevent missing dep; use a lightweight inline-code finder
import MeldEncrypt from "../../main.ts";
import { MeldInlineWidget } from "./InlineWidget.ts";

// Minimal inline-code detection using regex over visible text slices
function* findInlineCodeBlocks(view: EditorView, from: number, to: number): Generator<{from:number,to:number,value:string}> {
  const doc = view.state.doc;
  // Scan line by line within viewport for backtick-delimited inline code
  let pos = from;
  while (pos < to) {
    const line = doc.lineAt(pos);
    const text = line.text;
    let idx = 0;
    while (idx < text.length) {
      const open = text.indexOf('`', idx);
      if (open === -1) break;
      const close = text.indexOf('`', open + 1);
      if (close === -1) break;
      const absFrom = line.from + open;
      const absTo = line.from + close + 1;
      const value = doc.sliceString(absFrom, absTo);
      yield { from: absFrom, to: absTo, value };
      idx = close + 1;
    }
    pos = line.to + 1;
  }
}

class MeldLivePreviewHelper {
  public selectionAndRangeOverlap(selection: any, rangeFrom: number, rangeTo: number): boolean {
    for (const range of selection.ranges) {
      if (range.from <= rangeTo && range.to >= rangeFrom) return true;
    }
    return false;
  }
}

export const livePreviewExtension = (app: App, plugin: MeldEncrypt) => ViewPlugin.fromClass(class implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (!update.state.field(editorLivePreviewField, false)) {
      this.decorations = Decoration.none;
      return;
    }
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  destroy(): void {}

  private buildDecorations(view: EditorView): DecorationSet {
    if (!view.state.field(editorLivePreviewField, false)) return Decoration.none;

    const helper = new MeldLivePreviewHelper();
    const builder = new RangeSetBuilder<Decoration>();
    const selection = view.state.selection;

    for (const { from, to } of view.visibleRanges) {
      for (const blk of findInlineCodeBlocks(view, from, to)) {
        // strip backticks
        let text = blk.value.trim();
        if (text.startsWith('`') && text.endsWith('`')) text = text.slice(1, -1).trim();
        if (!text.toLowerCase().startsWith('meld-encrypt')) continue;
        const sp = text.indexOf(' ');
        if (sp < 0) continue;
        const jsonStr = text.slice(sp + 1).trim();
        let data: any; try { data = JSON.parse(jsonStr); } catch { continue; }
        if (!data || !data.version || !data.encodedData) continue;
        if (helper.selectionAndRangeOverlap(selection, blk.from - 1, blk.to + 1)) continue;
        builder.add(
          blk.from,
          blk.to,
          Decoration.replace({ widget: new MeldInlineWidget(app, plugin, blk.value) })
        );
      }
    }
    return builder.finish();
  }
},
{ decorations: instance => instance.decorations }
);
