import "server-only";
import { WebClient } from "@slack/web-api";

let _client: WebClient | null = null;

export function slack(): WebClient {
  if (_client) return _client;
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not set");
  _client = new WebClient(token);
  return _client;
}
