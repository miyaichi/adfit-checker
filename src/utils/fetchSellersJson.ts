// Type definitions
export interface Seller {
  seller_id: string;
  name: string;
  domain: string;
  seller_type?: 'PUBLISHER' | 'INTERMEDIARY';
  is_confidential?: 0 | 1;
}

export interface SellersJson {
  version: string;
  sellers: Seller[];
}

export interface FetchSellersJsonResult {
  data?: SellersJson;
  error?: string;
}

/**
 * Fetches and parses the sellers.json file for the specified domain.
 * @param domain - The domain name to fetch the sellers.json file from
 * @returns FetchSellersJsonResult object
 */
export async function fetchSellersJson(domain: string): Promise<FetchSellersJsonResult> {
  const url = `https://${domain}/sellers.json`;
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return { error: `Failed to fetch sellers.json: HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.version || !Array.isArray(data.sellers)) {
      return { error: 'Invalid sellers.json format' };
    }

    return { data };
  } catch (error) {
    return { error: `Error fetching sellers.json: ${(error as Error).message}` };
  }
}

/**
// Example usage
(async () => {
  const domain = 'example.com';
  const result = await fetchSellersJson(domain);

  if (result.error) {
    console.error(result.error);
  } else {
    console.log('Sellers.json data:', result.data);
  }
})();
**/
