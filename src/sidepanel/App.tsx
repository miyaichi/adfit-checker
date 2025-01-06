import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { BaseMessage, TabInfo } from '../types/messages';
import { Context } from '../types/types';
import { ConnectionManager } from '../utils/connectionManager';
import { fetchAdsTxt, FetchAdsTxtResult, getUniqueDomains } from '../utils/fetchAdsTxt';
import { Logger } from '../utils/logger';

const logger = new Logger('sidepanel');

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [contentScriptContext, setContentScriptContext] = useState<Context>('undefined');
  const initialized = React.useRef(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [adsTxtData, setAdsTxtData] = useState<FetchAdsTxtResult | null>(null);

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
      setContentScriptContext(tabId ? `content-${tabId}` : 'undefined');
    }
  }, [tabId, tabInfo]);

  const handleMessage = (message: BaseMessage) => {
    logger.debug('Message received', { type: message.type });

    // Implement other message handling here ...
    switch (message.type) {
      default:
        logger.debug('Unknown message type:', message.type);
        break;
    }
  };

  const handleAnalyze = async () => {
    if (!tabInfo || !tabInfo.isScriptInjectionAllowed || analyzing) return;
    setAnalyzing(true);

    try {
      const domain = new URL(tabInfo.url).hostname;

      // Fetch data to analyze
      const [adsTxtResult] = await Promise.all([fetchAdsTxt(domain)]);
      setAdsTxtData(adsTxtResult);

      const sellerDomains = getUniqueDomains(adsTxtResult.data);
      logger.info('Seller domains:', sellerDomains);
    } catch (error) {
      logger.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const renderAdsTxt = () => {
    if (!adsTxtData)
      return (
        <div className="p-4 text-center text-gray-500">
          No data available. Click Analyze to fetch Ads.txt
        </div>
      );

    const directEntries = _.orderBy(
      adsTxtData.data.filter((entry) => entry.relationship === 'DIRECT'),
      ['domain', 'publisherId'],
      ['asc', 'asc']
    );

    const resellerEntries = _.orderBy(
      adsTxtData.data.filter((entry) => entry.relationship === 'RESELLER'),
      ['domain', 'publisherId'],
      ['asc', 'asc']
    );

    return (
      <div>
        <div className="space-y-2 ml-4">
          <div>
            <h3 className="text-lg font-bold">Direct ({directEntries.length})</h3>
            <ul>
              {directEntries.map((entry: { domain: string; publisherId: string }, index) => (
                <li key={`direct-${index}`}>
                  {entry.domain} - {entry.publisherId}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold">Reseller ({resellerEntries.length})</h3>
            <ul>
              {resellerEntries.map((entry: { domain: string; publisherId: string }, index) => (
                <li key={`reseller-${index}`}>
                  {entry.domain} - {entry.publisherId}
                </li>
              ))}
            </ul>
          </div>
          {adsTxtData && adsTxtData.errors && (
            <div>
              <h3 className="text-lg font-bold">Errors ({adsTxtData.errors.length})</h3>
              <div className="space-y-2">
                {adsTxtData.errors.map((error, index) => (
                  <div key={index} className="p-3 bg-red-50 text-red-700 rounded-md">
                    {error.line > 0 ? (
                      <>
                        <p className="font-medium">
                          Line {error.line}: {error.message}
                        </p>
                        <p className="text-sm mt-1">Content: {error.content}</p>
                      </>
                    ) : (
                      <p className="font-medium">{error.message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
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
            </TabList>

            <TabPanel>{renderAdsTxt()}</TabPanel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
