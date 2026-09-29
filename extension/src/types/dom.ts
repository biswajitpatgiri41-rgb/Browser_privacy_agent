/**
 * DOM-related types for the extension.
 */

export interface DOMElement {
  elementId: string;
  tagName: string;
  role?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textContent?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  type?: string;
  isInteractive: boolean;
  isVisible: boolean;
  attributes: Record<string, string>;
  children?: DOMElement[];
}

export interface DOMExtractionResult {
  elements: DOMElement[];
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  url: string;
  title: string;
  timestamp: number;
}

export interface ElementSelector {
  elementId: string;
  xpath?: string;
  cssSelector?: string;
}
