// Type declaration for .md files loaded as plain text via esbuild loader: { '.md': 'text' }
declare module '*.md' {
  const content: string;
  export default content;
}
