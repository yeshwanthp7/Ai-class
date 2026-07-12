/**
 * AI Teacher Service — Proxy Module
 *
 * Proxies askTeacher calls to the modular lib/teacher/index implementation.
 * Maintains backwards compatibility with all existing imports.
 */
export { askTeacher } from "./teacher/index";
export * from "./teacher/types";
