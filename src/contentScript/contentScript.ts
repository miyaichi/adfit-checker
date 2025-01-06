import { MessageHandler, PageInfo } from '../types/messages';
import { Context } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';

class ContentScript {
  private connectionManager: ConnectionManager | null = null;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('content-script');
    this.initialize();
  }

  private async initialize() {
    try {
      // Listen for PING and SIDEPANEL_CLOSED messages
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PING') {
          sendResponse({ status: 'alive' });
          return false;
        }
        if (message.type === 'SIDEPANEL_CLOSED') {
          this.logger.info('Sidepanel closed, performing cleanup');
          this.performCleanup();
          sendResponse({ status: 'cleaned' });
          return false;
        }
      });

      // Listen for page show events
      window.addEventListener('pageshow', async (event) => {
        const e = event as PageTransitionEvent;
        if (e.persisted) {
          this.logger.info('Page restored from BFCache');

          // Reset connection and cleanup
          this.connectionManager = null;
          this.performCleanup();
        }
      });

      // Get activeTabInfo from storage
      const { activeTabInfo } = await chrome.storage.local.get('activeTabInfo');

      if (activeTabInfo?.isScriptInjectionAllowed) {
        this.setupConnection(activeTabInfo.tabId);
      } else {
        this.logger.debug('Script injection not allowed for this tab');
      }

      // Listen for storage changes
      chrome.storage.local.onChanged.addListener((changes) => {
        const { oldValue, newValue } = changes.activeTabInfo || {};
        const newTabId = newValue?.tabId;
        const isAllowed = newValue?.isScriptInjectionAllowed;

        // Setup connection if allowed and connection doesn't exist or tabId has changed
        if (newTabId && isAllowed && (!this.connectionManager || newTabId !== oldValue?.tabId)) {
          this.setupConnection(newTabId);
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize content script:', error);
    }
  }

  private setupConnection(tabId: number) {
    if (this.connectionManager) {
      this.logger.debug('Connection already established');
      return;
    }

    try {
      this.connectionManager = new ConnectionManager(`content-${tabId}`, this.handleMessage);
      this.connectionManager.connect();
      this.logger.debug('Connection established', { tabId });

      // Monitor connection status, perform cleanup on disconnect
      const intervalId = setInterval(() => {
        const connectionStatus = this.connectionManager?.getStatus() || 'disconnected';
        if (connectionStatus !== 'connected') {
          this.logger.info('Connection lost, performing cleanup');
          this.performCleanup();
          clearInterval(intervalId);
        }
      }, 5000);
    } catch (error) {
      this.logger.error('Failed to setup connection:', error);
    }
  }

  private handleMessage: MessageHandler = (message) => {
    this.logger.debug('Message received', { type: message.type });

    // Implement other message handling here ...
    switch (message.type) {
      case 'SCRAPE_TAB':
        this.handleScrapeTab(message.source);
        break;
      default:
        this.logger.debug('Unknown message type:', message.type);
        break;
    }
  };

  // Cleanup existing state
  private performCleanup() {
    this.logger.info('Performing cleanup');
    // Implement cleanup logic here ...
  }

  private async handleScrapeTab(source: Context) {
    this.logger.info('Scraping tab content');

    const width = Math.max(
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth
    );
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.documentElement.clientHeight
    );
    const imageDataURL = await this.captureTab(width, height, window.innerHeight, window.scrollY);

    const pageInfo: PageInfo = {
      html: document.documentElement.outerHTML,
      imageDataURL: imageDataURL,
    };

    this.connectionManager?.sendMessage(source, {
      type: 'SCRAPE_TAB_RESULT',
      payload: {
        success: true,
        ...pageInfo,
      },
    });
  }

  // Capture full page screenshot
  private async captureTab(
    width: number,
    height: number,
    windowHeight: number,
    scrollPosition: number
  ): Promise<string> {
    this.logger.info('Starting full page capture');

    // Store original scroll position to restore later
    const originalScroll = scrollPosition;

    // Create a canvas to merge all screenshots
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx || !this.connectionManager) {
      throw new Error('Failed to initialize capture');
    }

    try {
      // Calculate number of screenshots needed
      const screenshotsNeeded = Math.ceil(height / windowHeight);

      // Take screenshots for each section
      for (let i = 0; i < screenshotsNeeded; i++) {
        // Scroll to position
        const targetScroll = i * windowHeight;
        window.scrollTo(0, targetScroll);

        // Wait for scroll to complete and any dynamic content to load
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Request screenshot from background
        const imageData = await new Promise<string>((resolve, reject) => {
          // Set up one-time message handler for the response
          const handleResponse = (message: any) => {
            if (message.type === 'CAPTURE_TAB_RESULT') {
              if (message.payload.success && message.payload.imageDataUrl) {
                resolve(message.payload.imageDataUrl);
              } else {
                reject(new Error(message.payload.error || 'Failed to capture screenshot'));
              }
            }
          };

          // Add temporary message handler
          const originalHandler = this.handleMessage;
          this.handleMessage = (message) => {
            handleResponse(message);
            // Restore original handler after receiving response
            this.handleMessage = originalHandler;
            originalHandler(message);
          };

          // Send capture request
          this.connectionManager?.sendMessage('background', {
            type: 'CAPTURE_TAB',
            payload: undefined,
          });
        });

        // Draw screenshot onto canvas
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = imageData;
        });

        ctx.drawImage(
          img,
          0, // source x
          0, // source y
          width, // source width
          windowHeight, // source height
          0, // destination x
          targetScroll, // destination y
          width, // destination width
          windowHeight // destination height
        );

        this.logger.debug(`Captured section ${i + 1}/${screenshotsNeeded}`);
      }

      // Restore original scroll position
      window.scrollTo(0, originalScroll);

      // Convert canvas to data URL
      const fullPageImage = canvas.toDataURL('image/png');
      this.logger.info('Full page capture completed successfully');

      return fullPageImage;
    } catch (error) {
      this.logger.error('Failed to capture full page:', error);
      // Restore original scroll position on error
      window.scrollTo(0, originalScroll);
      throw error;
    }
  }
}

// Initialize content script
new ContentScript();
