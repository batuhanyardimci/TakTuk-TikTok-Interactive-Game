import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
/**
 * Custom cookie jar for axios
 * Because axios-cookiejar-support does not work as expected when using proxy agents
 * https://github.com/zerodytrash/TikTok-Livestream-Chat-Connector/issues/18
 */
export default class CookieJar {
    readonly axiosInstance: AxiosInstance;
    readonly cookies: Record<string, string>;
    /**
     * Constructor
     *
     * @param axiosInstance The axios instance to attach the cookie jar to
     * @param cookies The initial cookies to set
     */
    constructor(axiosInstance: AxiosInstance, cookies?: Record<string, string>);
    /**
     * Set the session ID and tt-target-idc
     *
     * @param sessionId The session ID to set
     * @param ttTargetIdc The tt-target-idc to set
     */
    setSession(sessionId: string | null, ttTargetIdc: string | null): void;
    /**
     * Get the tt-target-idc cookie
     */
    get ttTargetIdc(): string | null;
    /**
     * Get the session ID
     */
    get sessionId(): string | null;
    /**
     * Read cookies from response headers
     * @param response The axios response
     */
    readCookies(response: AxiosResponse): void;
    /**
     * Append cookies to request headers
     * @param request The axios request
     */
    appendCookies(request: AxiosRequestConfig): void;
    /**
     * Parse cookie string
     * @param str The cookie string
     */
    parseCookie(str: string): Record<string, string>;
    /**
     * Process a single set-cookie header
     * @param setCookieHeader The set-cookie header
     */
    processSetCookieHeader(setCookieHeader: string): void;
    /**
     * Get the cookie string
     * @param headers Optional existing headers to merge with
     */
    getCookieString(headers?: Record<string, string>): string;
}
//# sourceMappingURL=cookie-jar.d.ts.map