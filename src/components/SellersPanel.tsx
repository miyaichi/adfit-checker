import React from 'react';
import { SellerAnalysis } from '../hooks/useAdsSellers';

interface SellersPanelProps {
  analyzing: boolean;
  sellerAnalysis: SellerAnalysis[];
}

export const SellersPanel: React.FC<SellersPanelProps> = ({ analyzing, sellerAnalysis }) => {
  if (analyzing) {
    return <div className="p-4 text-center text-gray-500">Analyzing...</div>;
  }

  if (!sellerAnalysis.length) {
    return (
      <div className="p-4 text-center text-gray-500">
        No seller analysis available. Click Analyze to fetch data.
      </div>
    );
  }

  return (
    <div className="space-y-2 ml-4">
      {sellerAnalysis.map((analysis, idx) => (
        <div key={`${analysis.domain}-${idx}`} className="space-y-2">
          <span className="font-bold">{analysis.domain}</span>

          {analysis.sellersJson?.error ? (
            <div className="text-red-600 p-2 bg-red-50 rounded">{analysis.sellersJson.error}</div>
          ) : analysis.sellersJson?.data && analysis.sellersJson.data.length > 0 ? (
            <ul>
              {analysis.sellersJson?.data?.map((seller, sellerIdx) => (
                <li key={`${analysis.domain}-${sellerIdx}`}>
                  {seller.domain || seller.name || 'confidential'}
                  {seller.seller_type && <> - {seller.seller_type}</>}- {seller.seller_id}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-2 bg-gray-100 rounded">No sellers found</div>
          )}
        </div>
      ))}
    </div>
  );
};
