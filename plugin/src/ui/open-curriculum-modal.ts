import { App, FuzzyMatch, FuzzySuggestModal } from 'obsidian';
import type { CourseMeta } from '../interfaces';

export class OpenCurriculumModal extends FuzzySuggestModal<CourseMeta> {
  constructor(
    app: App,
    private courses: CourseMeta[],
    private onChoose: (course: CourseMeta) => void
  ) {
    super(app);
    this.setPlaceholder('Select a saved curriculum…');
  }

  getItems(): CourseMeta[] {
    return this.courses;
  }

  getItemText(course: CourseMeta): string {
    return course.title;
  }

  renderSuggestion(match: FuzzyMatch<CourseMeta>, el: HTMLElement): void {
    const { item: course } = match;
    el.createDiv({ text: course.title, cls: 'delve-saved-curriculum__title' });
    el.createDiv({
      text: `Course ID: ${course.courseId} · Saved ${formatSavedDate(course.createdAt)}`,
      cls: 'delve-saved-curriculum__meta',
    });
  }

  onChooseItem(course: CourseMeta): void {
    this.onChoose(course);
  }
}

function formatSavedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}
