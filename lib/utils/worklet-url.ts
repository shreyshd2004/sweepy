export function createWorkletUrl(workletName: string): string {
  return new URL(`../${workletName}.ts`, import.meta.url).toString();
}