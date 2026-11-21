import { Response } from 'playwright';

export interface HttpStatusCheckResult {
  statusCode: number;
  statusText: string;
  is200: boolean;
  formattedOutput: string;
}

/**
 * Case 3 - Confirm HTTP 200 status code or not for given page.
 */
export function checkHttpStatus(response: Response | null): HttpStatusCheckResult {
  if (!response) {
    return {
      statusCode: 0,
      statusText: 'No Response',
      is200: false,
      formattedOutput: '0 (Failed - No Response)'
    };
  }

  const code = response.status();
  const is200 = code === 200;

  return {
    statusCode: code,
    statusText: response.statusText(),
    is200,
    formattedOutput: is200 ? '200 (Passed)' : `${code} (Failed)`
  };
}
