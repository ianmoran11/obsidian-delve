import type { AllPluginData, Stage0Cache, TaxonomyNode } from '../src/interfaces';

// ─── Data factories ──────────────────────────────────────────────────────────

export function makeTaxonomy(): TaxonomyNode[] {
  return [
    {
      id: 'ml',
      title: 'Machine Learning',
      description: 'Core concepts behind learning from data.',
      children: [
        {
          id: 'ml-supervised',
          title: 'Supervised Learning',
          description: 'Learning from labelled training examples.',
        },
        {
          id: 'ml-unsupervised',
          title: 'Unsupervised Learning',
          description: 'Finding structure in unlabelled data.',
        },
      ],
    },
    {
      id: 'dl',
      title: 'Deep Learning',
      description: 'Neural network architectures and training techniques.',
    },
  ];
}

export function makeStage0Cache(overrides?: Partial<Stage0Cache>): Stage0Cache {
  return {
    courseId: 'test-course-abc123',
    seedTopic: 'Machine Learning',
    taxonomy: makeTaxonomy(),
    selectedScope: ['ml', 'ml-supervised', 'ml-unsupervised'],
    scopeSummary: 'Machine Learning, Supervised Learning, Unsupervised Learning',
    completedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeEmptyPluginData(): AllPluginData {
  return { settings: {}, courses: {}, activeCourseId: undefined };
}

// ─── In-memory data store helper ────────────────────────────────────────────

export function makeDataStore(initial?: Partial<AllPluginData>) {
  let store: AllPluginData = { settings: {}, courses: {}, ...initial };
  return {
    load: async (): Promise<AllPluginData> => ({ ...store }),
    save: async (data: AllPluginData): Promise<void> => {
      store = { ...data };
    },
    getStore: () => store,
  };
}

// ─── Mock vault adapter ────────────────────────────────────────────────────

export function makeMockVaultAdapter() {
  const fs: Record<string, string> = {};
  return {
    fs,
    adapter: {
      async write(path: string, content: string): Promise<void> {
        fs[path] = content;
      },
      async read(path: string): Promise<string> {
        if (fs[path] === undefined) throw new Error(`Not found: ${path}`);
        return fs[path];
      },
      async remove(path: string): Promise<void> {
        delete fs[path];
      },
    },
  };
}
