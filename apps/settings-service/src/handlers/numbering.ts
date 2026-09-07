import { toErrorResponse } from "@school-erp/errors";
import { hydrateSettingsRuntimeConfig } from "./runtime-config";
import {
  cancelNumber,
  issueNumber,
  issueNumbers,
} from "../modules/numbering/numbering-engine.service";

interface NumberingEvent {
  source?: string;
  operation?: "ISSUE_NUMBER" | "ISSUE_NUMBER_BATCH" | "CANCEL_NUMBER";
  payload?: unknown;
}

export async function handler(event: NumberingEvent) {
  try {
    await hydrateSettingsRuntimeConfig();
    if (event.source !== "erp.internal") {
      return { error: "internal numbering invocation is required" };
    }
    if (event.operation === "ISSUE_NUMBER") {
      return { result: await issueNumber(event.payload) };
    }
    if (event.operation === "ISSUE_NUMBER_BATCH") {
      return { result: await issueNumbers(event.payload) };
    }
    if (event.operation === "CANCEL_NUMBER") {
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as Record<string, unknown>)
          : {};
      return { result: await cancelNumber(payload.context, payload.reason) };
    }
    return { error: "unsupported numbering operation" };
  } catch (error) {
    const response = toErrorResponse(error);
    console.error("Settings numbering request failed", {
      operation: event.operation,
      code: response.body.error.code,
      message: response.body.error.message,
    });
    return { error: response.body.error.message };
  }
}
