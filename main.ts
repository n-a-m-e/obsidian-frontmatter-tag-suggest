import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	Plugin,
	TFile,
} from "obsidian";

export default class FrontmatterTagSuggestPlugin extends Plugin {
	async onload() {
		this.registerEditorSuggest(new TagSuggest(this));
	}
}

class TagSuggest extends EditorSuggest<string> {
	plugin: FrontmatterTagSuggestPlugin;
	tags: string[];

	constructor(plugin: FrontmatterTagSuggestPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	getTags(): string[] {
		//@ts-expect-error, private method
		const tags: any = this.plugin.app.metadataCache.getTags();
		return [...Object.keys(tags)].map((p) => p.split("#").pop());
	}
	
	checkLines(line: number, editor: Editor) {
		let lineContents = editor.getLine(line).toLowerCase();
		if (lineContents.startsWith("tags:") || lineContents.startsWith("tag:")) {
			this.inline = true;
			return true;
		} else if (lineContents.trim().startsWith("- ")){
			this.indent = lineContents.split("-")[0];
			do {
				line--;
				lineContents = editor.getLine(line).toLowerCase();
			}
			while (lineContents.trim().startsWith("- "));
			if (lineContents.startsWith("tags:") || lineContents.startsWith("tag:")) {
				return true;
			}
		}
		return false;
	}
	
	inRange(range: string) {
		if (!range || !range.length) return false;
		if (range.match(/^---\n/gm)?.length != 1) return false;
		if (!/^tags?:/gm.test(range)) return false;
		const split = range.split(/(^\w+:?\s*\n?)/gm);
		for (let i = split.length - 1; i >= 0; i--) {
			if (/(^\w+:?\s*\n?)/gm.test(split[i]))
				return split[i].startsWith("tags:");
		}
		return false;
	}
	indent = "";
	inline = false;
	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_: TFile
	): EditorSuggestTriggerInfo | null {
		const onFrontmatterTagLine =
			this.checkLines(cursor.line, editor) ||
			this.inRange(editor.getRange({ line: 0, ch: 0 }, cursor));
		if (onFrontmatterTagLine) {
			const sub = editor.getLine(cursor.line).substring(0, cursor.ch);
			const match = sub.match(/(\S+)$/)?.first();
			if (match) {
				this.tags = this.getTags();
				const matchData = {
					end: cursor,
					start: {
						ch: sub.lastIndexOf(match),
						line: cursor.line,
					},
					query: match,
				};
				return matchData;
			}
		}
		return null;
	}

	getSuggestions(context: EditorSuggestContext): string[] {
		const suggestions = this.tags.filter((p) =>
			p.toLowerCase().contains(context.query.toLowerCase())
		);
		return suggestions;
	}

	renderSuggestion(suggestion: string, el: HTMLElement): void {
		const outer = el.createDiv({ cls: "ES-suggester-container" });
		outer.createDiv({ cls: "ES-tags" }).setText(`#${suggestion}`);
	}

	selectSuggestion(suggestion: string): void {
		if (this.context) {
			if (this.inline) {
				suggestion = `${suggestion},`;
			} else {
				suggestion = `${suggestion}\n${this.indent}-`;
			}
			(this.context.editor as Editor).replaceRange(
				`${suggestion} `,
				this.context.start,
				this.context.end
			);
		}
	}
}
