import { vi } from 'vitest';

export const Notice = vi.fn();

export class Modal {
  app: unknown;
  contentEl: HTMLElement;
  constructor(app: unknown) {
    this.app = app;
    this.contentEl = document.createElement('div');
  }
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class Plugin {
  app: unknown;
  manifest: unknown;
  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }
  async loadData(): Promise<null> { return null; }
  async saveData(_data: unknown): Promise<void> {}
  addCommand(_cmd: unknown): void {}
  addSettingTab(_tab: unknown): void {}
  registerView(_type: string, _cb: unknown): void {}
}

export class ItemView {
  leaf: unknown;
  contentEl: HTMLElement;
  constructor(leaf: unknown) {
    this.leaf = leaf;
    this.contentEl = document.createElement('div');
  }
  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl: HTMLElement;
  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }
  display(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_: string): this { return this; }
  setDesc(_: string): this { return this; }
  addText(_cb: (t: MockText) => void): this {
    _cb(new MockText());
    return this;
  }
  addTextArea(_cb: (t: MockText) => void): this {
    _cb(new MockText());
    return this;
  }
  addButton(_cb: (b: MockButton) => void): this {
    _cb(new MockButton());
    return this;
  }
}

class MockText {
  inputEl = document.createElement('input');
  setValue(_: string): this { return this; }
  setPlaceholder(_: string): this { return this; }
  onChange(_: (v: string) => void): this { return this; }
}

class MockButton {
  setButtonText(_: string): this { return this; }
  setCta(): this { return this; }
  setDisabled(_: boolean): this { return this; }
  onClick(_: () => void): this { return this; }
}

export class WorkspaceLeaf {}

export const requestUrl = vi.fn().mockResolvedValue({
  status: 200,
  json: {},
  text: '',
});

export class Vault {}
