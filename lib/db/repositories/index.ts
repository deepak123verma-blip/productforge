import mock from "./mock";
import supabase from "./supabase";
import type { Repository } from "./types";

/**
 * THE data-backend switch. One env var, one file. No page or component
 * imports mock.ts or supabase.ts directly — only this.
 */
export function getRepository(): Repository {
  return process.env.DATA_BACKEND === "supabase" ? supabase : mock;
}

export * from "./types";
