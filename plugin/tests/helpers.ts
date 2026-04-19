import type { TaxonomyNode, Stage0Cache } from '../src/interfaces';

export function makeTaxonomyNode(overrides?: Partial<TaxonomyNode>): TaxonomyNode {
  return {
    id: 'node-1',
    title: 'Test Node',
    description: 'A test node',
    ...overrides,
  };
}

export function makeStage0Cache(overrides?: Partial<Stage0Cache>): Stage0Cache {
  return {
    courseId: 'test-course-1',
    seedTopic: 'Machine Learning',
    taxonomy: [makeTaxonomyNode()],
    selectedScope: ['node-1'],
    scopeSummary: 'Test Node',
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeMockPlugin() {
  return {
    settings: {
      openRouterApiKey: 'test-key',
      defaultModel: 'anthropic/claude-3-5-sonnet',
      promptOverrides: {} as Record<string, string>,
    },
    app: {
      vault: {
        adapter: {
          write: async (_path: string, _content: string) => {},
          read: async (_path: string) => '{}',
          exists: async (_path: string) => false,
          remove: async (_path: string) => {},
        },
        getFiles: () => [],
        getAbstractFileByPath: (_path: string) => null,
        read: async () => '',
      },
      workspace: {
        getLeaf: () => ({
          setViewState: async () => {},
        }),
        revealLeaf: () => {},
      },
    },
    llmService: {
      callJson: async <T>() => ({}) as T,
      callText: async () => '',
      listModels: async () => [] as string[],
    },
    contextService: {
      build: async () => ({
        mode: 'knowledge-only' as const,
        fileCount: 0,
        content: '',
      }),
    },
    cacheService: {
      readStage: async () => undefined,
      writeStage: async () => {},
      readCourse: async () => ({}),
      writeMeta: async () => {},
      listCourses: async () => [],
      clearCourse: async () => {},
    },
    lockService: {
      acquire: async () => {},
      release: async () => {},
      read: async () => null,
      isLocked: async () => false,
    },
    loadData: async () => null,
    saveData: async () => {},
    loadPrompt: async (name: string) => `mock prompt for ${name}`,
  };
}
