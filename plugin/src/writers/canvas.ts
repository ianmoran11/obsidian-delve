import type DelvePlugin from '../../main';
import type { Curriculum } from '../interfaces';

export async function writeCanvas(
  plugin: DelvePlugin,
  curriculum: Curriculum,
  canvasPath: string,
  lessonPaths: Record<string, string>,
  modulePaths: Record<string, string>,
  courseIndexPath: string
): Promise<void> {
  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];

  nodes.push({
    id: 'course-index',
    type: 'file',
    file: courseIndexPath,
    x: 40,
    y: 40,
    width: 320,
    height: 120,
  });

  curriculum.modules.forEach((module, moduleIndex) => {
    const moduleNodeId = `module-${module.moduleId}`;
    nodes.push({
      id: moduleNodeId,
      type: 'file',
      file: modulePaths[module.moduleId],
      x: 420,
      y: 40 + moduleIndex * 260,
      width: 320,
      height: 140,
    });
    edges.push({
      id: `edge-course-${module.moduleId}`,
      fromNode: 'course-index',
      toNode: moduleNodeId,
    });

    module.lessons.forEach((lesson, lessonIndex) => {
      const lessonNodeId = `lesson-${lesson.lessonId}`;
      nodes.push({
        id: lessonNodeId,
        type: 'file',
        file: lessonPaths[lesson.lessonId],
        x: 840 + lessonIndex * 340,
        y: 40 + moduleIndex * 260,
        width: 300,
        height: 140,
      });
      edges.push({
        id: `edge-module-${module.moduleId}-${lesson.lessonId}`,
        fromNode: moduleNodeId,
        toNode: lessonNodeId,
      });

      lesson.prerequisites.forEach(prereq => {
        edges.push({
          id: `edge-prereq-${prereq}-${lesson.lessonId}`,
          fromNode: `lesson-${prereq}`,
          toNode: lessonNodeId,
        });
      });
    });
  });

  await plugin.app.vault.adapter.write(
    canvasPath,
    JSON.stringify({ nodes, edges }, null, 2)
  );
}
