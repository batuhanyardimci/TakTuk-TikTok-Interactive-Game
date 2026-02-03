"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../../lib/config"));
/**
 * Custom cookie jar for axios
 * Because axios-cookiejar-support does not work as expected when using proxy agents
 * https://github.com/zerodytrash/TikTok-Livestream-Chat-Connector/issues/18
 */
class CookieJar {
    axiosInstance;
    cookies;
    /**
     * Constructor
     *
     * @param axiosInstance The axios instance to attach the cookie jar to
     * @param cookies The initial cookies to set
     */
    constructor(axiosInstance, cookies = config_1.default.DEFAULT_HTTP_CLIENT_COOKIES) {
        this.axiosInstance = axiosInstance;
        this.cookies = cookies;
        // Intercept responses to store cookies
        this.axiosInstance.interceptors.response.use((response) => {
            this.readCookies(response);
            return response;
        });
        // Intercept request to append cookies
        this.axiosInstance.interceptors.request.use((request) => {
            this.appendCookies(request);
            return request;
        });
        // Return a proxy object to allow direct access to cookies
        return new Proxy(this, {
            get(target, p) {
                if (p in target) {
                    return target[p];
                }
                else {
                    return target.cookies[p];
                }
            },
            set(target, p, value) {
                if (value === null) {
                    // Delete the cookie if the value is null
                    delete target.cookies[p];
                    return true;
                }
                if (p in target) {
                    target[p] = value;
                }
                else {
                    target.cookies[p] = value;
                }
                return true;
            },
            deleteProperty(target, p) {
                delete target.cookies[p];
                return true;
            }
        });
    }
    /**
     * Set the session ID and tt-target-idc
     *
     * @param sessionId The session ID to set
     * @param ttTargetIdc The tt-target-idc to set
     */
    setSession(sessionId, ttTargetIdc) {
        if (sessionId && !ttTargetIdc) {
            throw new Error('tt-target-idc is required when sessionId is set');
        }
        // (1) Set the sid
        this.cookies['sessionid'] = sessionId;
        this.cookies['sessionid_ss'] = sessionId;
        this.cookies['sid_tt'] = sessionId;
        this.cookies['sid_guard'] = sessionId;
        // (2) Set the IDC, basically, the account region. Must match the account's sid.
        this.cookies['tt-target-idc'] = ttTargetIdc;
    }
    /**
     * Get the tt-target-idc cookie
     */
    get ttTargetIdc() {
        return this.cookies['tt-target-idc'] || null;
    }
    /**
     * Get the session ID
     */
    get sessionId() {
        return this.cookies['sessionid'] || this.cookies['sessionid_ss'] || this.cookies['sid_tt'] || this.cookies['sid_guard'] || null;
    }
    /**
     * Read cookies from response headers
     * @param response The axios response
     */
    readCookies(response) {
        const setCookieHeaders = response.headers['set-cookie'];
        if (Array.isArray(setCookieHeaders)) {
            // Multiple set-cookie headers
            setCookieHeaders.forEach((setCookieHeader) => this.processSetCookieHeader(setCookieHeader));
        }
        else if (typeof setCookieHeaders === 'string') {
            // Single set-cookie header
            this.processSetCookieHeader(setCookieHeaders);
        }
    }
    /**
     * Append cookies to request headers
     * @param request The axios request
     */
    appendCookies(request) {
        // We use the capitalized 'Cookie' header, because every browser does that
        if (request.headers['cookie']) {
            request.headers['Cookie'] = request.headers['cookie'];
            delete request.headers['cookie'];
        }
        // Cookies already set by custom headers? => Append
        const headerCookie = request.headers['Cookie'];
        if (typeof headerCookie === 'string') {
            Object.assign(this.cookies, this.parseCookie(headerCookie), this.cookies);
        }
        request.headers['Cookie'] = this.getCookieString();
    }
    /**
     * Parse cookie string
     * @param str The cookie string
     */
    parseCookie(str) {
        const cookies = {};
        if (!str)
            return cookies;
        str.split('; ').forEach((v) => {
            if (!v)
                return;
            const parts = String(v).split('=');
            const cookieName = decodeURIComponent(parts.shift());
            cookies[cookieName] = parts.join('=');
        });
        return cookies;
    }
    /**
     * Process a single set-cookie header
     * @param setCookieHeader The set-cookie header
     */
    processSetCookieHeader(setCookieHeader) {
        const nameValuePart = setCookieHeader.split(';')[0];
        const parts = nameValuePart.split('=');
        const cookieName = parts.shift();
        const cookieValue = parts.join('=');
        if (typeof cookieName === 'string' && cookieName !== '' && typeof cookieValue === 'string') {
            this.cookies[decodeURIComponent(cookieName)] = cookieValue;
        }
    }
    /**
     * Get the cookie string
     * @param headers Optional existing headers to merge with
     */
    getCookieString(headers) {
        // Start with the current cookies in the jar
        let cookies = { ...this.cookies };
        // If a header was passed in, parse it and merge (existing header cookies overwritten by jar cookies)
        const cookieHeader = headers?.['Cookie'] || headers?.['cookie'];
        if (cookieHeader) {
            const parsedHeaderCookies = this.parseCookie(cookieHeader);
            // Merge: header first, then overwrite with current cookies
            cookies = { ...parsedHeaderCookies, ...cookies };
        }
        // Convert merged cookies into a single header string
        const cookieParams = [];
        for (const [cookieName, cookieValue] of Object.entries(cookies)) {
            if (!cookieValue)
                continue;
            cookieParams.push(`${cookieName}=${cookieValue}`);
        }
        return cookieParams.join('; ');
    }
}
exports.default = CookieJar;
//# sourceMappingURL=cookie-jar.js.map