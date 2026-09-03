import { HttpClient } from "./http";

export * from "./http";
export * from "./errors";
export * from "./sse";

export const http = new HttpClient();
export default http;