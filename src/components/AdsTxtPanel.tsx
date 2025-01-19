import _ from 'lodash';
import React from 'react';
import { FetchAdsTxtResult } from '../utils/fetchAdsTxt';

interface AdsTxtPanelProps {
  analyzing: boolean;
  adsTxtData: FetchAdsTxtResult | null;
  isValidEntry: (domain: string, publisherId: string) => boolean;
}

export const AdsTxtPanel: React.FC<AdsTxtPanelProps> = ({
  analyzing,
  adsTxtData,
  isValidEntry,
}) => {
  if (analyzing) {
    return <div className="p-4 text-center text-gray-500">Analyzing...</div>;
  }

  if (!adsTxtData) {
    return (
      <div className="p-4 text-center text-gray-500">
        No data available. Click Analyze to fetch Ads.txt
      </div>
    );
  }

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
              <li
                key={`direct-${index}`}
                className={
                  isValidEntry(entry.domain, entry.publisherId) ? 'text-green-600' : 'text-red-600'
                }
              >
                {entry.domain} - {entry.publisherId}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-bold">Reseller ({resellerEntries.length})</h3>
          <ul>
            {resellerEntries.map((entry: { domain: string; publisherId: string }, index) => (
              <li
                key={`reseller-${index}`}
                className={
                  isValidEntry(entry.domain, entry.publisherId) ? 'text-green-600' : 'text-red-600'
                }
              >
                {entry.domain} - {entry.publisherId}
              </li>
            ))}
          </ul>
        </div>
        {adsTxtData.errors && adsTxtData.errors.length > 0 && (
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
