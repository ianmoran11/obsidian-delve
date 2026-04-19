export interface NavigationLinks {
  breadcrumbs: string;
  sequence: string;
}

export function buildNavigationLinks(
  courseIndexLink: string,
  moduleLink: string,
  previousLessonLink?: string,
  nextLessonLink?: string
): NavigationLinks {
  const breadcrumbs = `**Course:** ${courseIndexLink} > ${moduleLink}`;
  const previous = previousLessonLink ? `Previous: ${previousLessonLink}` : 'Previous: none';
  const next = nextLessonLink ? `Next: ${nextLessonLink}` : 'Next: none';

  return {
    breadcrumbs,
    sequence: `${previous} | ${next}`,
  };
}
