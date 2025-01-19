import { useEffect, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { AdsTxtPanel } from '../components/AdsTxtPanel';
import { SellersPanel } from '../components/SellersPanel';
import { useAdsSellers } from '../hooks/useAdsSellers';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { BaseMessage, MessagePayloads, TabInfo } from '../types/messages';
import { Context, PageInfo } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { Logger } from '../utils/logger';

const logger = new Logger('sidepanel');

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [contentScriptContext, setContentScriptContext] = useState<Context>('undefined');
  const initialized = useRef(false);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);

  const { capturing, screenCapture, captureScreen, handleCaptureResult } = useScreenCapture(
    connectionManager,
    contentScriptContext
  );

  const { analyzing, adsTxtData, sellerAnalysis, analyze, isValidEntry } = useAdsSellers();

  useEffect(() => {
    if (initialized.current) {
      logger.debug('App already initialized, skipping...');
      return;
    }

    const initializeTab = async () => {
      if (initialized.current) return;

      try {
        const manager = new ConnectionManager('sidepanel', handleMessage);
        manager.connect();
        setConnectionManager(manager);

        // Initialize active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          setTabId(tab.id);
          setTabInfo({
            tabId: tab.id,
            windowId: tab.windowId,
            url: tab.url || '',
            isScriptInjectionAllowed: tab.url ? tab.url.startsWith('http') : false,
          });
          initialized.current = true;
        }

        logger.debug('Initialized', { tab });
      } catch (error) {
        logger.error('Tab initialization failed:', error);
      }
    };

    initializeTab();

    // Monitor storage changes
    chrome.storage.local.onChanged.addListener((changes) => {
      const { activeTabInfo } = changes;
      const newTab = activeTabInfo?.newValue as TabInfo | undefined;
      if (!newTab) return;

      logger.debug('Tab info change detected from storage:', newTab);
      setTabId(newTab.tabId);
      setTabInfo(newTab);
    });
  }, []);

  useEffect(() => {
    // Update content script context
    if (tabId && tabInfo && tabInfo.isScriptInjectionAllowed) {
      const context: Context = `content-${tabId}`;
      setContentScriptContext(context);

      // Update content script context
      connectionManager?.sendMessage(context, { type: 'PAGE_INFO', payload: undefined });
    }
  }, [tabId, tabInfo]);

  const handleMessage = (message: BaseMessage) => {
    logger.debug('Message received', { type: message.type });

    switch (message.type) {
      case 'CAPTURE_TAB_RESULT': {
        const payload = message.payload as MessagePayloads['CAPTURE_TAB_RESULT'];
        handleCaptureResult(payload.success ? payload.imageDataUrl || '' : '');
        break;
      }
      case 'PAGE_INFO_RESULT': {
        const payload = message.payload as MessagePayloads['PAGE_INFO_RESULT'];
        setPageInfo(payload.pageInfo);
        break;
      }
      default:
        logger.debug('Unknown message type:', message.type);
        break;
    }
  };

  const handleAnalyze = async () => {
    if (!tabInfo || !tabInfo.isScriptInjectionAllowed || analyzing) return;

    try {
      if (pageInfo) {
        captureScreen(pageInfo);
      }

      await analyze(tabInfo.url);
    } catch (error) {
      logger.error('Analysis failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-4">
        {/* Header and Analyze Button */}
        <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
          <button
            onClick={handleAnalyze}
            disabled={!tabId || analyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-white
              ${
                !tabId || analyzing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {/* Tabs Section */}
        <div className="bg-white rounded-lg shadow">
          <Tabs>
            <TabList>
              <Tab>Ads.txt</Tab>
              <Tab>Sellers</Tab>
              <Tab>Capture</Tab>
            </TabList>

            <TabPanel>
              <AdsTxtPanel
                analyzing={analyzing}
                adsTxtData={adsTxtData}
                isValidEntry={isValidEntry}
              />
            </TabPanel>
            <TabPanel>
              <SellersPanel analyzing={analyzing} sellerAnalysis={sellerAnalysis} />
            </TabPanel>
            <TabPanel>
              {capturing && (
                <div className="p-4 text-center text-gray-500">Capturing screen...</div>
              )}
              {screenCapture && (
                <div className="p-4">
                  <img src={screenCapture} alt="Screen capture" />
                </div>
              )}
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
