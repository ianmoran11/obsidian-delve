// Minimal Obsidian API mock for vitest (jsdom environment)

export class Plugin {
  app: App;
  manifest = { id: 'delve', name: 'Delve', version: '0.1.0' };

  constructor() {
    this.app = new App();
  }

  async loadData(): Promise<unknown> {
    return null;
  }
  async saveData(_data: unknown): Promise<void> {}
  registerView(_type: string, _factory: unknown): void {}
  addSettingTab(_tab: unknown): void {}
  addCommand(_cmd: unknown): void {}
}

export class App {
  vault = new Vault();
  workspace = new Workspace();
  setting = { open(): void {} };
}

export class Vault {
  private _files: Record<string, string> = {};

  getFiles() {
    return [];
  }
  async cachedRead(_file: unknown): Promise<string> {
    return '';
  }
  adapter = {
    _store: {} as Record<string, string>,
    async write(path: string, content: string): Promise<void> {
      this._store[path] = content;
    },
    async read(path: string): Promise<string> {
      if (this._store[path] === undefined) throw new Error(`Not found: ${path}`);
      return this._store[path];
    },
    async remove(path: string): Promise<void> {
      delete this._store[path];
    },
  };
}

export class Workspace {
  getLeavesOfType(_type: string) {
    return [];
  }
  getLeaf(_split?: boolean) {
    return new WorkspaceLeaf();
  }
  revealLeaf(_leaf: unknown): void {}
  detachLeavesOfType(_type: string): void {}
}

export class WorkspaceLeaf {
  async setViewState(_state: unknown): Promise<void> {}
  async detach(): Promise<void> {}
}

export class Modal {
  app: App;
  contentEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
  }

  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class ItemView {
  leaf: WorkspaceLeaf;
  contentEl: HTMLElement;
  app: App;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.contentEl = document.createElement('div');
    this.app = new App();
  }

  getViewType(): string {
    return '';
  }
  getDisplayText(): string {
    return '';
  }
  getIcon(): string {
    return '';
  }
  async setState(_state: unknown, _result: unknown): Promise<void> {}
  getState(): unknown {
    return null;
  }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
}

export class Setting {
  settingEl: HTMLElement;
  constructor(_container: HTMLElement) {
    this.settingEl = document.createElement('div');
  }
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  addText(_fn: (t: MockTextComponent) => void): this {
    _fn(new MockTextComponent());
    return this;
  }
  addTextArea(_fn: (t: MockTextAreaComponent) => void): this {
    _fn(new MockTextAreaComponent());
    return this;
  }
  addButton(_fn: (b: MockButtonComponent) => void): this {
    _fn(new MockButtonComponent());
    return this;
  }
}

export class PluginSettingTab {
  app: App;
  plugin: unknown;
  containerEl: HTMLElement;

  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
}

class MockTextComponent {
  inputEl: HTMLInputElement = document.createElement('input');
  setPlaceholder(_p: string): this {
    return this;
  }
  setValue(_v: string): this {
    return this;
  }
  onChange(_fn: (v: string) => void): this {
    return this;
  }
  getAttribute(_a: string): string {
    return '';
  }
  setAttribute(_a: string, _v: string): void {}
}

class MockTextAreaComponent {
  inputEl: HTMLTextAreaElement = document.createElement('textarea');
  rows = 4;
  setPlaceholder(_p: string): this {
    return this;
  }
  setValue(_v: string): this {
    return this;
  }
  onChange(_fn: (v: string) => void): this {
    return this;
  }
}

class MockButtonComponent {
  setButtonText(_t: string): this {
    return this;
  }
  setCta(): this {
    return this;
  }
  onClick(_fn: () => void): this {
    return this;
  }
}

export class Notice {
  constructor(_message: string) {}
}

export async function requestUrl(_options: unknown): Promise<{
  status: number;
  text: string;
  json: unknown;
}> {
  return { status: 200, text: '{}', json: {} };
}
