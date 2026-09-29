/**
 * Context Builder - builds sanitized context from DOM.
 */

import { DomExtractor } from "../content/dom-extractor";
import { SanitizedContext } from "../types/agent";

export class ContextBuilder {
  private extractor: DomExtractor;

  constructor() {
    this.extractor = new DomExtractor();
  }

  async build(): Promise<SanitizedContext> {
    return this.extractor.extract();
  }
}
