/** GLM Flash advertises JSON mode, not provider-enforced JSON Schema.
 * Both paths still require schema validation in our server adapter. */
export function openRouterFormat(model: string, name: string, schema: object) {
  const jsonOnly = model === "z-ai/glm-5.3-flash";
  return {
    // User-selected max effort needs a larger output and time budget.
    reasoning: jsonOnly ? { effort: "max", exclude: true } : undefined,
    timeoutMs: jsonOnly ? 120_000 : 25_000,
    foodTokens: jsonOnly ? 8000 : 2500,
    machineTokens: jsonOnly ? 4000 : 900,
    instruction: jsonOnly
      ? ` Devolve apenas um objeto JSON válido, sem Markdown, conforme este schema: ${JSON.stringify(schema)}`
      : "",
    response_format: jsonOnly
      ? { type: "json_object" }
      : { type: "json_schema", json_schema: { name, strict: true, schema } },
  };
}
