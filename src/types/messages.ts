import { Context } from './types';

// Tab information type
export interface TabInfo {
  tabId: number;
  windowId: number;
  url: string;
  isScriptInjectionAllowed: boolean;
}

export interface PageInfo {
  html: string;
  imageDataURL: string;
}

// Message payloads type
export interface MessagePayloads {
  CAPTURE_TAB: void;
  CAPTURE_TAB_RESULT: {
    success: boolean;
    error?: string;
    imageDataUrl?: string;
    url: string | null;
  };
  SCRAPE_TAB: void;
  SCRAPE_TAB_RESULT: {
    success: boolean;
    error?: string;
    pageInfo?: PageInfo;
  };
}

// Base message structure
export interface BaseMessage {
  type: keyof MessagePayloads;
  payload: unknown;
  source: Context;
  target: Context;
  timestamp: number;
}

// Message handler type
export type MessageHandler<T extends BaseMessage = BaseMessage> = (message: T) => void;

// Message type
export type Message<T extends keyof MessagePayloads> = BaseMessage & {
  type: T;
  payload: MessagePayloads[T];
};

// Union of all message types
export type ExtensionMessage = {
  [K in keyof MessagePayloads]: Message<K>;
}[keyof MessagePayloads];
