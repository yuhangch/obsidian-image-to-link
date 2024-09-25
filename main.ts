import {App, Editor, EditorPosition, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';

import {arrayBufferToWebP} from 'webp-converter-browser'


interface ImageToLinkSettings {
	api_url: string;
	headers: string;
	body: string;
	target: string;
}

const DEFAULT_SETTINGS: ImageToLinkSettings = {
	api_url: 'https://localhost/upload/image',
	headers: `{"Authorization": "Bearer obsidian-image-to-link"}`,
	body : `{"key": "$KEY", "image": "$IMAGE"}`,
	target: 'url'
}


interface pasteFunction {
	(this: HTMLElement, event: ClipboardEvent): void;
}


export default class ImageToLink extends Plugin {
	settings: ImageToLinkSettings;
	pasteFunction: pasteFunction;


	// https://github.com/Creling/obsidian-image-uploader/blob/LivePreviewEditor/src/main.ts#L59
	private replaceText(editor: Editor, target: string, replacement: string): void {
		target = target.trim()
		const lines = editor.getValue().split("\n");
		for (let i = 0; i < lines.length; i++) {
			const ch = lines[i].indexOf(target)
			if (ch !== -1) {
				const from = {line: i, ch: ch} as EditorPosition;
				const to = {line: i, ch: ch + target.length} as EditorPosition;
				editor.setCursor(from);
				editor.replaceRange(replacement, from, to);
				break;
			}
		}
	}

	private getFieldByPath(obj: any, path: string): string {

		try {

			const pathList = path.split('.');
			let result = obj;
			for (const path of pathList) {
				result = result[path];
			}
			return result;
		} catch (e) {
			return obj['url'];
		}
	}

	async uploadImage(file: File, key: string): Promise<string> {
		const url = this.settings.api_url;
		const formData = new FormData();
		const bodyParsed = JSON.parse(this.settings.body);
		const configImageKey = Object.keys(bodyParsed).find( key => bodyParsed[key] === '$IMAGE') ?? 'image';
		const configKeyKey = Object.keys(bodyParsed).find( key => bodyParsed[key] === '$KEY') ?? 'key';
		formData.append(configImageKey, file);
		formData.append(configKeyKey, key);
		const response = await fetch(url, {
			headers: JSON.parse(this.settings.headers),
			method: 'POST',
			body: formData
		});
		const data = await response.json();
		const target = this.settings.target;
		return this.getFieldByPath(data, target);

	}

	async pasteHandler(ev: ClipboardEvent, editor: Editor, mkView: MarkdownView): Promise<void> {
		if (ev.defaultPrevented) {
			console.log("paste event is canceled");
			return;
		}

		const editFileName = mkView.file?.path;
		// remove path end .md or .mdx
		const editFilePath = editFileName?.replace(/\.mdx?$/, '');


		const clipboardData = ev.clipboardData?.files[0];
		const imageType = /image.*/;
		if (clipboardData && clipboardData.type.match(imageType)) {
			ev.preventDefault();
			const file: File = clipboardData!;
			const webpBlob = await arrayBufferToWebP(await file.arrayBuffer(), {
				quality: 1,
			})
			const newFile = new File([webpBlob], file.name.replace(/\.[^/.]+$/, '.webp'), {type: 'image/webp'});


			const extension: string | undefined = newFile.name.split('.').pop();
			if (!extension) {
				new Notice('Image extension not found');
				return;
			}

			// set the placeholder text
			const randomString = (Math.random() * 10086).toString(36).substr(0, 8)
			const pastePlaceText = `![uploading...](${randomString})\n`
			editor.replaceSelection(pastePlaceText)

			new ImageInfoModal(this.app, (captionValue: string, slugValue: string) => {

				const key = `${editFilePath}/${slugValue}.${extension}`

				this.uploadImage(newFile, key).then((url) => {
					const imageText = `![${captionValue}](${url})\n`
					this.replaceText(editor, pastePlaceText, imageText)
				}, (error) => {
					console.log(error)
					new Notice(`Upload failed, ${error}`)
				})
			}).open()


		}
	}

	async onload() {
		await this.loadSettings();

		this.pasteFunction = this.pasteHandler.bind(this);

		this.registerEvent(
			this.app.workspace.on('editor-paste', this.pasteFunction)
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ImageInfoModal extends Modal {
	private callback: (captionValue: string, slugValue: string) => void;

	constructor(app: App, onSubmit: (v1: string, v2: string) => void) {
		super(app);
		this.callback = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;


		// 创建输入框
		const captionInputEl = contentEl.createEl('input', {type: 'text', placeholder: 'Enter caption here...'});
		const slugInputEl = contentEl.createEl('input', {type: 'text', placeholder: 'Enter slug here...'});

		// 创建按钮容器
		const buttonContainer = contentEl.createEl('div', {cls: 'modal-button-container'});

		// 创建确定按钮
		const confirmButton = buttonContainer.createEl('button', {text: 'Confirm'});
		confirmButton.addEventListener('click', () => {
			// 获取输入框的值并回调
			this.callback(captionInputEl.value, slugInputEl.value);
			this.close(); // 关闭 Modal
		});

		// 创建取消按钮
		const cancelButton = buttonContainer.createEl('button', {text: 'Cancel'});
		cancelButton.addEventListener('click', () => {
			this.close(); // 关闭 Modal
		});

		// 添加简单的样式
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'space-between';
		confirmButton.style.marginRight = '10px';
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: ImageToLink;

	constructor(app: App, plugin: ImageToLink) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Api URL')
			.setDesc('Remote API URL to upload image')
			.addText(text => text
				.setPlaceholder('Enter your remote API URL')
				.setValue(this.plugin.settings.api_url)
				.onChange(async (value) => {
					this.plugin.settings.api_url = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Headers')
			.setDesc('Headers for remote API')
			.addText(text => text
				.setPlaceholder('Enter your headers')
				.setValue(JSON.stringify(this.plugin.settings.headers))
				.onChange(async (value) => {
					this.plugin.settings.headers = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Body')
			.setDesc('Body for remote API')
			.addText(text => text
				.setPlaceholder('Enter your body')
				.setValue(JSON.stringify(this.plugin.settings.body))
				.onChange(async (value) => {
					this.plugin.settings.body = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Response URL Target')
			.setDesc('Response URL Target for remote API')
			.addText(text => text
				.setPlaceholder('Enter your image url target in response')
				.setValue(this.plugin.settings.target)
				.onChange(async (value) => {
					this.plugin.settings.target = value;
					await this.plugin.saveSettings();
				}));
	}
}
