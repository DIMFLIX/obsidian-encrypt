import { App, editorLivePreviewField } from "obsidian";
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet } from '@codemirror/view';
import type { PluginValue } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import MeldEncrypt from "../../main.ts";
import { MeldInlineWidget } from "./InlineWidget.ts";

class MeldLivePreviewHelper {
	public selectionAndRangeOverlap(selection: any, rangeFrom: number, rangeTo: number): boolean {
		for (const range of selection.ranges) {
			if (range.from <= rangeTo && range.to >= rangeFrom) {
				return true;
			}
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
		if (!update.state.field(editorLivePreviewField)) {
			this.decorations = Decoration.none;
			return;
		}
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	destroy(): void {}

	private buildDecorations(view: EditorView): DecorationSet {
		if (!view.state.field(editorLivePreviewField)) return Decoration.none;

		const helper = new MeldLivePreviewHelper();
		const builder = new RangeSetBuilder<Decoration>();
		const selection = view.state.selection;

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter(node) {
					if (node.type.name.startsWith("inline-code")) {
						const value = view.state.doc.sliceString(node.from, node.to);
						
						// Check if this is encrypted with meld-encrypt prefix
						let text = value.trim();
						if (text.startsWith('`') && text.endsWith('`')) text = text.slice(1, -1).trim();
						
						const isEncrypted = text.toLowerCase().startsWith('meld-encrypt');
						if (isEncrypted) {
							const sp = text.indexOf(' ');
							if (sp >= 0) {
								try {
									const jsonStr = text.slice(sp + 1).trim();
									const data = JSON.parse(jsonStr);
									if (data && data.version && data.encodedData) {
										// Only replace if not currently selected/being edited
										if (!helper.selectionAndRangeOverlap(selection, node.from - 1, node.to + 1)) {
											builder.add(
												node.from,
												node.to,
												Decoration.replace({
													widget: new MeldInlineWidget(app, plugin, value)
												})
											);
										}
									}
								} catch {
									// Invalid JSON, ignore
								}
							}
						}
					}
				},
			});
		}
		return builder.finish();
	}
},
{
	decorations: instance => instance.decorations,
}
);