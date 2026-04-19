# Stage 3: Curriculum Design Prompt

Design a personalised draft curriculum from:
- the scoped topic
- extracted concepts
- the learner's self-assessed proficiency
- optional source context

Return a JSON object with a `curriculum` containing:
- `courseId`
- `title`
- `modules`

Each module must contain:
- `moduleId`
- `title`
- `description`
- `lessons`

Each lesson must contain:
- `lessonId`
- `title`
- `description`
- `prerequisites`
