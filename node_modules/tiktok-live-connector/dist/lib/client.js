"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikTokLiveConnection = void 0;
const errors_1 = require("../types/errors");
const node_events_1 = require("node:events");
const ws_client_1 = __importDefault(require("../lib/ws/lib/ws-client"));
const config_1 = __importDefault(require("../lib/config"));
const utilities_1 = require("../lib/utilities");
const web_1 = require("../lib/web");
const events_1 = require("../types/events");
const types_1 = require("../types");
class TikTokLiveConnection extends node_events_1.EventEmitter {
    uniqueId;
    signer;
    // Public properties
    webClient;
    wsClient = null;
    // Protected properties
    _roomInfo = null;
    _availableGifts = null;
    _connectState = events_1.ConnectState.DISCONNECTED;
    options;
    /**
     * Create a new TikTokLiveConnection instance
     * @param {string} uniqueId TikTok username (from URL)
     * @param {object} [options] Connection options
     * @param {boolean} [options[].authenticateWs=false] Authenticate the WebSocket connection using the session ID from the "sessionid" cookie
     * @param {boolean} [options[].processInitialData=true] Process the initital data which includes messages of the last minutes
     * @param {boolean} [options[].fetchRoomInfoOnConnect=false] Fetch the room info (room status, streamer info, etc.) on connect (will be returned when calling connect())
     * @param {boolean} [options[].enableExtendedGiftInfo=false] Enable this option to get extended information on 'gift' events like gift name and cost
     * @param {boolean} [options[].enableRequestPolling=true] Use request polling if no WebSocket upgrade is offered. If `false` an exception will be thrown if TikTok does not offer a WebSocket upgrade.
     * @param {number} [options[].requestPollingIntervalMs=1000] Request polling interval if WebSocket is not used
     * @param {string} [options[].sessionId=null] The session ID from the "sessionid" cookie is required if you want to send automated messages in the chat.
     * @param {object} [options[].webClientParams={}] Custom client params for Webcast API
     * @param {object} [options[].webClientHeaders={}] Custom request headers for axios
     * @param {object} [options[].websocketHeaders={}] Custom request headers for websocket.client
     * @param {object} [options[].webClientOptions={}] Custom request options for axios. Here you can specify an `httpsAgent` to use a proxy and a `timeout` value for example.
     * @param {object} [options[].websocketOptions={}] Custom request options for websocket.client. Here you can specify an `agent` to use a proxy and a `timeout` value for example.
     * @param {boolean} [options[].connectWithUniqueId=false] Connect to the live stream using the unique ID instead of the room ID. If `true`, the room ID will be fetched from the TikTok API.
     * @param {boolean} [options[].logFetchFallbackErrors=false] Log errors when falling back to the API or Euler source
     * @param {function} [options[].signedWebSocketProvider] Custom function to fetch the signed WebSocket URL. If not specified, the default function will be used.
     * @param {EulerSigner} [signer] TikTok Signer instance. If not provided, a new instance will be created using the provided options
     */
    constructor(uniqueId, options, signer) {
        super();
        this.uniqueId = uniqueId;
        this.signer = signer;
        this.uniqueId = (0, utilities_1.validateAndNormalizeUniqueId)(uniqueId);
        // Assign the options
        this.options = {
            connectWithUniqueId: false,
            processInitialData: true,
            fetchRoomInfoOnConnect: true,
            enableExtendedGiftInfo: false,
            enableRequestPolling: true,
            requestPollingIntervalMs: 1000,
            sessionId: null,
            ttTargetIdc: null,
            signApiKey: null,
            disableEulerFallbacks: false,
            // Override Http client params
            webClientParams: {},
            webClientHeaders: {},
            webClientOptions: {},
            // Override WebSocket params
            wsClientHeaders: {},
            wsClientOptions: {},
            wsClientParams: {},
            authenticateWs: false,
            signedWebSocketProvider: undefined,
            ...options
        };
        this.webClient = new web_1.TikTokWebClient({
            customHeaders: this.options?.webClientHeaders || {},
            axiosOptions: this.options?.webClientOptions,
            clientParams: this.options?.webClientParams || {},
            authenticateWs: this.options?.authenticateWs || false,
            signApiKey: this.options?.signApiKey ?? undefined
        }, signer);
        this.webClient.cookieJar.setSession(this.options.sessionId, this.options.ttTargetIdc);
        this.setDisconnected();
    }
    /**
     * Set the connection state to disconnected
     * @protected
     */
    setDisconnected() {
        this._connectState = events_1.ConnectState.DISCONNECTED;
        this._roomInfo = null;
        // Reset the client parameters
        this.clientParams.cursor = '';
        this.clientParams.room_id = '';
        this.clientParams.internal_ext = '';
    }
    /**
     * Get the current Room Info
     */
    get roomInfo() {
        return this._roomInfo;
    }
    /**
     * Get the available gifts
     */
    get availableGifts() {
        return this._availableGifts;
    }
    /**
     * Get the current connection state
     */
    get isConnecting() {
        return this._connectState === events_1.ConnectState.CONNECTING;
    }
    /**
     * Check if the connection is established
     */
    get isConnected() {
        return this._connectState === events_1.ConnectState.CONNECTED;
    }
    /**
     * Get the current client parameters
     */
    get clientParams() {
        return this.webClient.clientParams;
    }
    /**
     * Get the current room ID
     */
    get roomId() {
        return this.webClient.roomId;
    }
    /**
     * Get the current connection state including the cached room info and all available gifts
     * (if `enableExtendedGiftInfo` option enabled)
     */
    get state() {
        return {
            isConnected: this.isConnected,
            roomId: this.roomId,
            roomInfo: this.roomInfo,
            availableGifts: this.availableGifts
        };
    }
    /**
     * Connects to the live stream of the specified streamer
     * @param roomId Room ID to connect to. If not specified, the room ID will be retrieved from the TikTok API
     * @returns The current connection state
     */
    async connect(roomId) {
        switch (this._connectState) {
            case events_1.ConnectState.CONNECTED:
                throw new errors_1.AlreadyConnectedError('Already connected!');
            case events_1.ConnectState.CONNECTING:
                throw new errors_1.AlreadyConnectingError('Already connecting!');
            default:
            case events_1.ConnectState.DISCONNECTED:
                try {
                    this._connectState = events_1.ConnectState.CONNECTING;
                    await this._connect(roomId);
                    this._connectState = events_1.ConnectState.CONNECTED;
                    this.emit(events_1.ControlEvent.CONNECTED, this.state);
                    return this.state;
                }
                catch (err) {
                    this._connectState = events_1.ConnectState.DISCONNECTED;
                    this.handleError(err, 'Error while connecting');
                    throw err;
                }
        }
    }
    /**
     * Connects to the live stream of the specified streamer
     *
     * @param roomId Room ID to connect to. If not specified, the room ID will be retrieved from the TikTok API
     * @protected
     */
    async _connect(roomId) {
        // First we set the Room ID
        if (!this.options.connectWithUniqueId || this.options.fetchRoomInfoOnConnect || this.options.enableExtendedGiftInfo) {
            this.clientParams.room_id = roomId || this.clientParams.room_id || await this.fetchRoomId();
        }
        // <Optional> Fetch Room Info
        if (this.options?.fetchRoomInfoOnConnect) {
            this._roomInfo = await this.fetchRoomInfo();
            if (this._roomInfo.data.status === 4) {
                throw new errors_1.UserOfflineError('The requested user isn\'t online :(');
            }
        }
        // <Optional> Fetch Gift Info
        if (this.options?.enableExtendedGiftInfo) {
            this._availableGifts = await this.fetchAvailableGifts();
        }
        // <Required> Fetch initial room info. Let the user specify their own backend for signing, if they don't want to use Euler
        const protoMessageFetchResult = await (this.options.signedWebSocketProvider || this.webClient.fetchSignedWebSocketFromEuler)({
            roomId: (roomId || !this.options.connectWithUniqueId) ? this.roomId : undefined,
            uniqueId: this.options.connectWithUniqueId ? this.uniqueId : undefined,
            sessionId: this.options.authenticateWs ? this.options.sessionId : undefined,
            ttTargetIdc: this.options.authenticateWs ? this.options.ttTargetIdc : undefined,
            useMobile: this.options.useMobile
        });
        // <Optional> Process the initial data
        if (this.options?.processInitialData) {
            await this.processProtoMessageFetchResult(protoMessageFetchResult);
        }
        // If we didn't receive a cursor
        if (!protoMessageFetchResult.cursor) {
            throw new errors_1.InvalidResponseError('Missing cursor in initial fetch response.');
        }
        // Update client parameters
        this.clientParams.cursor = protoMessageFetchResult.cursor;
        this.clientParams.internal_ext = protoMessageFetchResult.internalExt;
        // Connect to the WebSocket
        const wsParams = {
            compress: 'gzip',
            room_id: this.roomId,
            internal_ext: protoMessageFetchResult.internalExt,
            cursor: protoMessageFetchResult.cursor,
        };
        // Filter for only defined params, like web does
        for (const [key, value] of Object.entries(protoMessageFetchResult.wsParams || [])) {
            if (value)
                wsParams[key] = value;
        }
        // Create the WebSocket client
        this.wsClient = await this.setupWebsocket(protoMessageFetchResult.wsUrl, wsParams);
        // Default app behaviour is to send the im_enter_room message on WebSocket connect
        this.wsClient.switchRooms(this.roomId);
        this.emit(events_1.ControlEvent.WEBSOCKET_CONNECTED, this.wsClient);
    }
    /**
     * Disconnects the connection to the live stream
     */
    async disconnect() {
        if (this.isConnected) {
            this.wsClient?.close();
        }
    }
    /**
     * Fetch the room ID from the TikTok API
     * @param uniqueId Optional unique ID to use instead of the current one
     */
    async fetchRoomId(uniqueId) {
        let errors = [];
        uniqueId ||= this.uniqueId;
        // Method 1 (HTML Fallback)
        try {
            const roomInfo = await this.webClient.fetchRoomInfoFromHtml({ uniqueId: uniqueId });
            const roomId = roomInfo.user.roomId;
            if (!roomId)
                throw new Error('Failed to extract Room ID from HTML.');
            return roomId;
        }
        catch (ex) {
            this.handleError(ex, 'Failed to retrieve Room ID from main page, falling back to API source...');
            errors.push(ex);
        }
        // Method 2 (API Fallback)
        try {
            const roomData = await this.webClient.fetchRoomInfoFromApiLive({ uniqueId: uniqueId });
            const roomId = roomData?.data?.user?.roomId;
            if (!roomId)
                throw new Error('Failed to extract Room ID from API.');
            return roomId;
        }
        catch (ex) {
            this.handleError(ex, 'Failed to retrieve Room ID from API source, falling back to Euler source...');
            errors.push(ex);
        }
        // Method 3 (Euler Fallback)
        if (!this.options.disableEulerFallbacks) {
            try {
                const response = await this.webClient.fetchRoomIdFromEuler({ uniqueId: uniqueId });
                if ([403, 402, 401].includes(response.code)) {
                    throw new Error('Failed to retrieve Room ID from Euler Stream, which was made as a last resort due to the previous methods failing. ' +
                        'This happened due to a >>lack of permission<< for you to use Euler Stream\'s (https://www.eulerstream.com) fallback method. ' +
                        'If you do not want to use Euler Stream, disable this fallback method by setting the \'disableEulerFallbacks\' option to \'true\'.');
                }
                if (!response.ok)
                    throw new Error(`Failed to retrieve Room ID from Euler due to an error: ${response.message}`);
                if (!response.room_id)
                    throw new Error('Failed to extract Room ID from Euler.');
                return response.room_id;
            }
            catch (err) {
                this.handleError(err, 'Failed to retrieve Room ID from Euler source, no more sources available...');
                errors.push(err);
            }
        }
        // If we reach this point, it means all sources have failed
        const errMsg = 'Failed to retrieve Room ID from all sources.';
        const failErr = new errors_1.FetchIsLiveError(errors, errMsg);
        this.handleError(failErr, errMsg);
        throw failErr;
    }
    async fetchIsLive() {
        const errors = [];
        const isOnline = (status) => status !== 4;
        // Method 1 (HTML)
        try {
            const roomInfo = await this.webClient.fetchRoomInfoFromHtml({ uniqueId: this.uniqueId });
            if (roomInfo?.liveRoomUserInfo?.liveRoom?.status === undefined)
                throw new Error('Failed to extract status from HTML.');
            return isOnline(roomInfo?.liveRoomUserInfo?.liveRoom?.status);
        }
        catch (ex) {
            this.handleError(ex, 'Failed to retrieve room info for live status from main page, falling back to API source...');
            errors.push(ex);
        }
        // Method 2 (API)
        try {
            const roomData = await this.webClient.fetchRoomInfoFromApiLive({ uniqueId: this.uniqueId });
            if (roomData?.data?.liveRoom?.status === undefined)
                throw new Error('Failed to extract status from API.');
            return isOnline(roomData?.data?.liveRoom?.status);
        }
        catch (err) {
            this.handleError(err, 'Failed to retrieve room info for live status from API source, falling back to Euler source...');
            errors.push(err);
        }
        // Method 3 (Euler)
        if (!this.options.disableEulerFallbacks) {
            try {
                const roomData = await this.webClient.fetchRoomIdFromEuler({ uniqueId: this.uniqueId });
                if (roomData.code !== 200)
                    throw new Error('Failed to extract status from Euler.');
                return roomData.is_live;
            }
            catch (err) {
                this.handleError(err, 'Failed to retrieve room info for live status from Euler source, no more sources available...');
                errors.push(err);
            }
        }
        // If we reach this point, it means all sources have failed
        const errMsg = 'Failed to retrieve live status rom all sources.';
        const failErr = new errors_1.FetchIsLiveError(errors, errMsg);
        this.handleError(failErr, errMsg);
        throw failErr;
    }
    /**
     * Wait until the streamer is live
     * @param seconds Number of seconds to wait before checking if the streamer is live again
     */
    async waitUntilLive(seconds = 60) {
        seconds = Math.max(30, seconds);
        return new Promise(async (resolve) => {
            const fetchIsLive = async () => {
                const isLive = await this.fetchIsLive();
                if (isLive) {
                    clearInterval(interval);
                    resolve();
                }
            };
            const interval = setInterval(async () => fetchIsLive(), seconds * 1000);
            await fetchIsLive();
        });
    }
    /**
     * Get the current room info (including streamer info, room status and statistics)
     * @returns Promise that will be resolved when the room info has been retrieved from the API
     */
    async fetchRoomInfo() {
        if (!this.webClient.roomId)
            await this.fetchRoomId();
        this._roomInfo = await this.webClient.fetchRoomInfo();
        return this._roomInfo;
    }
    /**
     * Get the available gifts in the current room
     * @returns Promise that will be resolved when the available gifts have been retrieved from the API
     */
    async fetchAvailableGifts() {
        try {
            let response = await this.webClient.getJsonObjectFromWebcastApi('gift/list/', this.clientParams);
            return response.data.gifts;
        }
        catch (err) {
            throw new errors_1.InvalidResponseError(`Failed to fetch available gifts. ${err.message}`, err);
        }
    }
    /**
     * Send a message to a TikTok LIVE Room
     *
     * @param content Message content to send to the stream
     * @param options Optional parameters for the message (incl. parameter overrides)
     */
    async sendMessage(content, options) {
        const roomId = options?.roomId || this.roomId;
        if (!roomId) {
            throw new Error('Room ID is required to send a message.');
        }
        const sessionId = options?.sessionId || this.webClient.cookieJar.sessionId;
        if (!sessionId) {
            throw new Error('Session ID is required to send a message.');
        }
        const ttTargetIdc = options?.ttTargetIdc || this.webClient.cookieJar.ttTargetIdc;
        if (!ttTargetIdc) {
            throw new Error('ttTargetIdc is required to send a message.');
        }
        return this.webClient.sendRoomChatFromEuler({
            content: content,
            roomId: roomId,
            sessionId: sessionId,
            ttTargetIdc: ttTargetIdc
        });
    }
    /**
     * Set up the WebSocket connection
     *
     * @param wsUrl WebSocket URL
     * @param wsParams WebSocket parameters
     * @returns Promise that will be resolved when the WebSocket connection is established
     * @protected
     */
    async setupWebsocket(wsUrl, wsParams) {
        return new Promise((resolve, reject) => {
            // Instantiate the client
            const wsClient = new ws_client_1.default(wsUrl, this.webClient.cookieJar, { ...config_1.default.DEFAULT_WS_CLIENT_PARAMS, ...this.options.wsClientParams, ...wsParams }, { ...config_1.default.DEFAULT_WS_CLIENT_HEADERS, ...this.options?.wsClientHeaders }, this.options?.wsClientOptions);
            // Handle the connection
            wsClient.on('open', () => {
                clearTimeout(connectTimeout);
                wsClient.on('error', (e) => this.handleError(e, 'WebSocket Error'));
                wsClient.on('close', (code, reason) => {
                    this.setDisconnected();
                    this.emit(events_1.ControlEvent.DISCONNECTED, { code, reason: reason?.toString() });
                });
                resolve(wsClient);
            });
            wsClient.on('error', (err) => reject(`Websocket connection failed, ${err}`));
            wsClient.on('protoMessageFetchResult', this.processProtoMessageFetchResult.bind(this));
            wsClient.on('imEnteredRoom', (data) => this.emit(events_1.ControlEvent.ENTER_ROOM, data));
            wsClient.on('webSocketData', (data) => this.emit(events_1.ControlEvent.WEBSOCKET_DATA, data));
            wsClient.on('messageDecodingFailed', (err) => this.handleError(err, 'Websocket message decoding failed'));
            const connectTimeout = setTimeout(() => reject('Websocket not responding'), 20000);
        });
    }
    async processProtoMessageFetchResult(protoMessageFetchResult) {
        for (const message of protoMessageFetchResult.messages) {
            if (!message.decodedData) {
                continue;
            }
            // Emit the decoded data
            this.emit(events_1.ControlEvent.DECODED_DATA, message.type, message.decodedData, message.payload);
            // Process & emit decoded data depending on the message type
            try {
                await this.processDecodedData(message.decodedData);
            }
            catch (ex) {
                this.handleError(ex, 'Failed to process decoded data');
            }
        }
    }
    async processDecodedData({ data, type }) {
        // Emit a decoded data event
        switch (type) {
            case 'WebcastSocialMessage':
                if (data.common.displayText.displayType?.includes('follow')) {
                    return this.emit(events_1.WebcastEvent.FOLLOW, data);
                }
                if (data.common.displayText.displayType?.includes('share')) {
                    return this.emit(events_1.WebcastEvent.SHARE, data);
                }
                // First, emit the raw social message
                return this.emit(events_1.WebcastEvent.SOCIAL, data);
            case 'WebcastControlMessage':
                // Send raw message
                this.emit(events_1.WebcastEvent.CONTROL_MESSAGE, data);
                if (data.action === types_1.ControlAction.CONTROL_ACTION_STREAM_ENDED || data.action === types_1.ControlAction.CONTROL_ACTION_STREAM_SUSPENDED) {
                    this.emit(events_1.WebcastEvent.STREAM_END, { action: data.action });
                    await this.disconnect();
                }
                return;
            case 'WebcastGiftMessage':
                // Add extended gift info if available
                if (Array.isArray(this.availableGifts) && data.giftId) {
                    data.extendedGiftInfo = this.availableGifts.find((x) => x.id === data.giftId);
                }
                return this.emit(events_1.WebcastEvent.GIFT, data);
            case 'WebcastBarrageMessage':
                if (data.content?.displayType?.includes('ttlive_superFan')) {
                    this.emit(events_1.WebcastEvent.SUPER_FAN, data);
                }
                return this.emit(events_1.WebcastEvent.BARRAGE, data);
            default:
                // Handle all other events
                const basicEvent = events_1.WebcastEventMap[type];
                return basicEvent && this.emit(basicEvent, data);
        }
    }
    /**
     * Handle the error event
     *
     * @param exception Exception object
     * @param info Additional information about the error
     * @protected
     */
    handleError(exception, info) {
        if (this.listenerCount(events_1.ControlEvent.ERROR) < 1) {
            return;
        }
        this.emit(events_1.ControlEvent.ERROR, { info, exception });
    }
}
exports.TikTokLiveConnection = TikTokLiveConnection;
//# sourceMappingURL=client.js.map