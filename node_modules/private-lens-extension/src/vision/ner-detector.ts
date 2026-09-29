/**
 * Local NER (Named Entity Recognition) for PII detection in text.
 * Runs entirely on-device using ONNX model.
 */

import { logger } from "../shared/logger";
import { 
  loadModel, 
  ModelSession,
  ONNXModelConfig
} from "./onnx-runtime";

export interface NEREntity {
  text: string;
  label: string;
  start: number;
  end: number;
  confidence: number;
}

export interface NERResult {
  entities: NEREntity[];
  processingTimeMs: number;
  provider: "webgpu" | "wasm" | "cpu";
}

const NER_CONFIG: ONNXModelConfig = {
  modelPath: "models/ner.onnx",
  inputName: "input_ids",
  outputNames: ["logits"],
  inputShape: [1, 512],
  scoreThreshold: 0.5,
  iouThreshold: 0.5,
  classNames: [
    "O", "B-PER", "I-PER", "B-ORG", "I-ORG", 
    "B-LOC", "I-LOC", "B-MISC", "I-MISC",
    "B-EMAIL", "I-EMAIL", "B-PHONE", "I-PHONE",
    "B-SSN", "I-SSN", "B-CREDIT_CARD", "I-CREDIT_CARD",
    "B-IP", "I-IP", "B-DOB", "I-DOB",
    "B-API_KEY", "I-API_KEY", "B-TOKEN", "I-TOKEN",
    "B-PASSWORD", "I-PASSWORD",
  ],
};

const LABEL_TO_PII_TYPE: Record<string, string> = {
  "PER": "PERSON", "ORG": "ORGANIZATION", "LOC": "ADDRESS",
  "EMAIL": "EMAIL", "PHONE": "PHONE", "SSN": "SSN",
  "CREDIT_CARD": "CREDIT_CARD", "IP": "IP_ADDRESS", "DOB": "DATE_OF_BIRTH",
  "API_KEY": "API_KEY", "TOKEN": "TOKEN", "PASSWORD": "PASSWORD", "MISC": "OTHER",
};

let nerSession: ModelSession | null = null;
let isLoading = false;
let tokenizer: any = null;

async function loadTokenizer(): Promise<any> {
  if (tokenizer) return tokenizer;
  try {
    const { AutoTokenizer } = await import("@xenova/transformers");
    tokenizer = await AutoTokenizer.from_pretrained("Xenova/distilbert-base-uncased");
    return tokenizer;
  } catch (error) {
    logger.warn("NER", "Failed to load transformers tokenizer, using fallback", { error: (error as Error).message });
    return {
      encode: (text: string) => ({ input_ids: text.split(/\s+/).map((_, i) => i + 100).slice(0, 512), attention_mask: text.split(/\s+/).map(() => 1).slice(0, 512) }),
      decode: (ids: number[]) => ids.map(id => `[${id}]`).join(" "),
    };
  }
}

export async function getNERSession(): Promise<ModelSession> {
  if (nerSession) return nerSession;
  if (isLoading) { while (isLoading) await new Promise(r => setTimeout(r, 50)); return nerSession!; }
  isLoading = true;
  try { nerSession = await loadModel(NER_CONFIG); await loadTokenizer(); return nerSession!; }
  finally { isLoading = false; }
}

export async function detectEntities(text: string): Promise<NERResult> {
  const startTime = performance.now();
  
  try {
    const session = await getNERSession();
    const { config } = session;
    const tok = await loadTokenizer();
    
    const encoded = tok.encode(text);
    const inputIds = new Float32Array(encoded.input_ids);
    const attentionMask = new Float32Array(encoded.attention_mask);
    
    const maxLen = config.inputShape[1];
    const paddedInputIds = new Float32Array(maxLen);
    const paddedAttentionMask = new Float32Array(maxLen);
    paddedInputIds.set(inputIds.slice(0, maxLen));
    paddedAttentionMask.set(attentionMask.slice(0, maxLen));
    
    const ortModule = (await import("onnxruntime-web")) as any;
    const inputTensor = new ortModule.Tensor("float32", paddedInputIds, [1, maxLen]);
    const maskTensor = new ortModule.Tensor("float32", paddedAttentionMask, [1, maxLen]);
    
    const results = await (session.session as { run: (feeds: Record<string, unknown>, outputNames: string[]) => Promise<Record<string, any>> }).run(
      { [config.inputName]: inputTensor, "attention_mask": maskTensor },
      config.outputNames
    );
    
    const logits = results[config.outputNames[0]];
    const predictions = logits.data as Float32Array;
    
    const entities: NEREntity[] = [];
    const numTokens = Math.min(encoded.input_ids.length, maxLen);
    const numClasses = config.classNames.length;
    
    let currentEntity: { label: string; start: number; tokens: number[] } | null = null;
    
    for (let i = 0; i < numTokens; i++) {
      const tokenLogits = predictions.slice(i * numClasses, (i + 1) * numClasses);
      const maxIdx = tokenLogits.indexOf(Math.max(...tokenLogits));
      const label = config.classNames[maxIdx];
      const confidence = Math.max(...tokenLogits) / tokenLogits.reduce((a, b) => a + Math.exp(b), 0);
      
      if (label.startsWith("B-")) {
        if (currentEntity) {
          entities.push(finalizeEntity(currentEntity, text, encoded, tok));
        }
        currentEntity = { label: label.slice(2), start: i, tokens: [i] };
      } else if (label.startsWith("I-") && currentEntity && label.slice(2) === currentEntity.label) {
        currentEntity.tokens.push(i);
      } else {
        if (currentEntity) {
          entities.push(finalizeEntity(currentEntity, text, encoded, tok));
          currentEntity = null;
        }
      }
    }
    
    if (currentEntity) {
      entities.push(finalizeEntity(currentEntity, text, encoded, tok));
    }
    
    const filtered = entities.filter(e => e.confidence >= config.scoreThreshold);
    
    const processingTimeMs = performance.now() - startTime;
    
    logger.debug("NER", "Detection complete", { 
      count: filtered.length,
      processingTimeMs,
      provider: session.provider 
    });
    
    return {
      entities: filtered,
      processingTimeMs,
      provider: session.provider,
    };
  } catch (error) {
    logger.error("NER", "Detection failed", { error: (error as Error).message });
    return fallbackRegexDetection(text);
  }
}

function finalizeEntity(
  entity: { label: string; start: number; tokens: number[] },
  text: string,
  encoded: any,
  tokenizer: any
): NEREntity {
  const piiType = LABEL_TO_PII_TYPE[entity.label] ?? "OTHER";
  const tokenText = tokenizer.decode(encoded.input_ids.slice(entity.start, entity.tokens[entity.tokens.length - 1] + 1));
  
  const start = text.indexOf(tokenText);
  const end = start + tokenText.length;
  
  return {
    text: tokenText,
    label: piiType,
    start: start >= 0 ? start : entity.start,
    end: end >= 0 ? end : entity.start + tokenText.length,
    confidence: 0.8,
  };
}

function fallbackRegexDetection(text: string): NERResult {
  const patterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, label: "EMAIL" },
    { regex: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "PHONE" },
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g, label: "SSN" },
    { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, label: "CREDIT_CARD" },
    { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, label: "IP_ADDRESS" },
    { regex: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, label: "DATE_OF_BIRTH" },
  ];
  
  const entities: NEREntity[] = [];
  for (const { regex, label } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        label,
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9,
      });
    }
  }
  
  return {
    entities,
    processingTimeMs: 0,
    provider: "wasm",
  };
}

export function clearNERCache(): void {
  nerSession = null;
  tokenizer = null;
}