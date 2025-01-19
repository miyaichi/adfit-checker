// services/captureService.ts
import { Context, PageInfo } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';

interface CapturePromiseRef {
  promise: Promise<string>;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

export class CaptureService {
  private capturePromiseRef: CapturePromiseRef | null = null;

  constructor(
    private connectionManager: ConnectionManager,
    private contentScriptContext: Context
  ) {}

  private createCapturePromise(): Promise<string> {
    let resolvePromise: (value: string) => void;
    let rejectPromise: (error: Error) => void;

    const promise = new Promise<string>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    this.capturePromiseRef = {
      promise,
      resolve: resolvePromise!,
      reject: rejectPromise!,
    };

    return promise;
  }

  async captureTab(pageInfo: PageInfo): Promise<string> {
    // Save the original scroll position
    const originalScroll = pageInfo.scroll;

    // Create a canvas to stitch the screenshots
    const canvas = document.createElement('canvas');
    canvas.width = pageInfo.demensions.width;
    canvas.height = pageInfo.demensions.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    try {
      // Calculate the number of screenshots needed
      const screenshotsNeeded = Math.ceil(pageInfo.demensions.height / pageInfo.viewport.height);

      // Capture each viewport
      for (let i = 0; i < screenshotsNeeded; i++) {
        // Scroll to the next viewport
        const scroll = i * pageInfo.viewport.height;
        this.connectionManager.sendMessage(this.contentScriptContext, {
          type: 'SCROLL_TO',
          payload: { x: 0, y: scroll },
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Capture the viewport
        const capturePromise = this.createCapturePromise();
        this.connectionManager.sendMessage('background', {
          type: 'CAPTURE_TAB',
          payload: undefined,
        });
        const imageDataUrl = await Promise.race([
          capturePromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Capture timeout')), 5000)
          ),
        ]);

        // Load the image data URL
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = imageDataUrl;
        });

        // Draw the viewport on the canvas
        context.drawImage(img, 0, scroll, pageInfo.demensions.width, pageInfo.viewport.height);
      }

      // Reset the scroll position
      this.connectionManager.sendMessage(this.contentScriptContext, {
        type: 'SCROLL_TO',
        payload: { x: originalScroll.x, y: originalScroll.y },
      });

      // Convert the canvas to image data URL
      return canvas.toDataURL('image/png');
    } catch (error) {
      // Reset the scroll position on error
      this.connectionManager.sendMessage(this.contentScriptContext, {
        type: 'SCROLL_TO',
        payload: { x: originalScroll.x, y: originalScroll.y },
      });
      throw error;
    }
  }

  handleCaptureResult(imageDataUrl: string): void {
    if (this.capturePromiseRef) {
      this.capturePromiseRef.resolve(imageDataUrl);
      this.capturePromiseRef = null;
    }
  }
}
