/** One turn of the conversation as the model sees it. */
export interface ModelTurn {
  role: "user" | "assistant";
  content: string;
}

/** What is sent to the model: the rules and data (system), then the conversation. */
export interface ModelCall {
  system: string[];
  messages: ModelTurn[];
}

export type ModelResult = { kind: "text"; text: string } | { kind: "refusal" };

/** Asks the model. Swappable, so the proxy can be tested, and run in the browser tests, without a key or a network. */
export type CompleteFn = (call: ModelCall) => Promise<ModelResult>;
