// hooks/useScreenCapture.ts
import { useCallback, useRef, useState } from 'react';
import { CaptureService } from '../services/captureService';
import { Context, PageInfo } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';

const logger = new Logger('useScreenCapture');

export function useScreenCapture(
  connectionManager: ConnectionManager | null,
  contentScriptContext: Context
) {
  const [capturing, setCapturing] = useState(false);
  const [screenCapture, setScreenCapture] = useState<string | null>(null);
  const captureServiceRef = useRef<CaptureService | null>(null);

  const initializeCaptureService = useCallback(() => {
    if (!connectionManager) return;

    captureServiceRef.current = new CaptureService(connectionManager, contentScriptContext);
  }, [connectionManager, contentScriptContext]);

  const handleCaptureResult = useCallback((imageDataUrl: string) => {
    if (captureServiceRef.current) {
      captureServiceRef.current.handleCaptureResult(imageDataUrl);
    }
  }, []);

  const captureScreen = useCallback(
    async (pageInfo: PageInfo) => {
      if (!connectionManager || capturing) return null;

      try {
        setCapturing(true);

        if (!captureServiceRef.current) {
          initializeCaptureService();
        }

        const imageDataUrl = await captureServiceRef.current?.captureTab(pageInfo);
        if (imageDataUrl) {
          setScreenCapture(imageDataUrl);
        }
        return imageDataUrl;
      } catch (error) {
        logger.error('Screen capture failed:', error);
        return null;
      } finally {
        setCapturing(false);
      }
    },
    [connectionManager, capturing, initializeCaptureService]
  );

  return {
    capturing,
    screenCapture,
    captureScreen,
    handleCaptureResult,
  };
}
