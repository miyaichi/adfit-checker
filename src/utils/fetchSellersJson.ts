import { FetchTimeoutError, fetchWithTimeout } from './fetchWithTimeout';

// Type definitions
export interface Seller {
  seller_id: string;
  is_confidential?: 0 | 1;
  seller_type?: 'PUBLISHER' | 'INTERMEDIARY';
  is_passthrough?: 0 | 1;
  name: string;
  domain: string;
  comment?: string;
  ext?: any;
}

export interface SellersJson {
  identifiers?: any;
  contact_email?: string;
  contact_address?: string;
  version: string;
  ext?: any;
  sellers: Seller[];
}

export interface FetchSellersJsonResult {
  data?: SellersJson;
  error?: string;
}

export interface FetchSellersJsonOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Fetches and parses the sellers.json file for the specified domain.
 * @param domain - The domain name to fetch the sellers.json file from
 * @returns FetchSellersJsonResult object
 */
export const fetchSellersJson = async (
  domain: string,
  options: FetchSellersJsonOptions = {}
): Promise<FetchSellersJsonResult> => {
  const { timeout = 5000, retries = 2, retryDelay = 1000 } = options;

  const url = `https://${domain}/sellers.json`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }

      const response = await fetchWithTimeout(url, { timeout });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.version || !Array.isArray(data.sellers)) {
        return { error: 'Invalid sellers.json format' };
      }

      return { data };
    } catch (error) {
      lastError = error as Error;

      // Don't retry on format errors
      if (error instanceof SyntaxError) {
        return { error: 'Invalid JSON format' };
      }

      // Only retry on timeout or network errors
      if (!(error instanceof FetchTimeoutError) && !(error instanceof TypeError)) {
        break;
      }

      // Don't wait on the last attempt
      if (attempt === retries) {
        break;
      }
    }
  }

  return {
    error: `Error fetching sellers.json: ${lastError?.message || 'Unknown error'}`,
  };
};

/**
 * Filters the sellers by the specified seller IDs.
 * @param sellers - The list of sellers to filter
 * @param sellerIds - The seller IDs to filter by
 * @returns The filtered list of sellers
 */
export const filterSellersByIds = (sellers: Seller[], sellerIds: string[]): Seller[] => {
  return sellers.filter((seller) => sellerIds.includes(seller.seller_id));
};
