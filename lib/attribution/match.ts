/**
 * Attribution matching (TRD §6): checkout metadata carries the link id
 * from the pf_ref cookie; the cookie is a fallback when metadata was
 * lost. An unmatched order is NULL — displayed as "Direct", never
 * guessed (Instagram's in-app browser loses 10–20% and that's honest).
 */

export interface AttributionInput {
  metadataLinkId: string | null;
  cookieLinkId: string | null;
  /** Does the candidate id reference a real, existing link? */
  linkExists: (id: string) => boolean;
}

export function matchSourceLink(input: AttributionInput): string | null {
  if (input.metadataLinkId !== null && input.linkExists(input.metadataLinkId)) {
    return input.metadataLinkId;
  }
  if (input.cookieLinkId !== null && input.linkExists(input.cookieLinkId)) {
    return input.cookieLinkId;
  }
  return null; // Direct — never guessed
}
