// Context type
export type Context = 'background' | 'sidepanel' | `content-${number}` | 'undefined';

// Connection status type
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// Page information type
export interface PageInfo {
  html: string;
  demensions: {
    width: number;
    height: number;
  };
  scroll: {
    x: number;
    y: number;
  };
  viewport: {
    width: number;
    height: number;
  };
}
