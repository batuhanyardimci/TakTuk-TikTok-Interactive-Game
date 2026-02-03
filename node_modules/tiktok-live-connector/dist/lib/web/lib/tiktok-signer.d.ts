/// <reference types="node" />
import { URL } from 'url';
import EulerStreamApiClient, { ClientConfiguration, SignWebcastUrl200Response } from '@eulerstream/euler-api-sdk';
import { SignTikTokUrlBodyMethodEnum } from '@eulerstream/euler-api-sdk/dist/sdk/api';
/**
 * TikTok Signer class
 */
export declare class EulerSigner extends EulerStreamApiClient {
    constructor(config?: Partial<ClientConfiguration>);
    /**
     * Sign a URL using the TikTok signature provider
     *
     * @param url The URL to sign
     * @param method The HTTP method to use (GET, POST, etc.)
     * @param userAgent The user agent to sign with
     * @param sessionId The session ID to use (optional)
     * @param ttTargetIdc The target IDC to use (optional)
     */
    webcastSign(url: string | URL, method: SignTikTokUrlBodyMethodEnum, userAgent: string, sessionId?: string, ttTargetIdc?: string): Promise<SignWebcastUrl200Response>;
}
//# sourceMappingURL=tiktok-signer.d.ts.map