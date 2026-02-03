"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utilities_1 = require("../../../lib/utilities");
const config_1 = __importDefault(require("../../../lib/config"));
const types_1 = require("../../../types");
const ws_1 = require("ws");
const textEncoder = new TextEncoder();
class TikTokWsClient extends ws_1.WebSocket {
    webSocketParams;
    webSocketPingIntervalMs;
    pingInterval;
    // Incremental sequence ID for messages, goes up for each heartbeat sent, starts at 1
    // Important for mobile compatibility
    seqId = 1;
    constructor(wsUrl, cookieJar, webSocketParams, webSocketHeaders = {}, webSocketOptions, webSocketPingIntervalMs = 10000) {
        const wsHeaders = { ...webSocketHeaders, Cookie: cookieJar.getCookieString(webSocketHeaders) };
        const wsUrlWithParams = `${wsUrl}?${new URLSearchParams(webSocketParams)}${config_1.default.DEFAULT_WS_CLIENT_PARAMS_APPEND_PARAMETER}`;
        super(wsUrlWithParams, {
            headers: wsHeaders,
            host: `https://${config_1.default.TIKTOK_HOST_WEB}`,
            ...webSocketOptions,
            autoPong: false
        });
        this.webSocketParams = webSocketParams;
        this.webSocketPingIntervalMs = webSocketPingIntervalMs;
        this.pingInterval = null;
        this.on('message', this.onMessage.bind(this));
        this.on('close', this.onDisconnect.bind(this));
    }
    get open() {
        return this.readyState === ws_1.WebSocket.OPEN;
    }
    /**
     * Send a message to the WebSocket server
     * @param data The message to send
     * @returns True if the message was sent, false otherwise
     */
    sendBytes(data) {
        if (this.open) {
            super.send(Buffer.from(data));
            return true;
        }
        return false;
    }
    onDisconnect() {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
        this.seqId = 1;
    }
    /**
     * Handle incoming messages
     * @param message The incoming WebSocket message (type => Buffer)
     * @protected
     */
    async onMessage(message) {
        // Emit WebSocket data
        this.emit('webSocketData', message);
        //  If the message is binary, decode it
        try {
            const decodedContainer = await (0, utilities_1.deserializeWebSocketMessage)(message);
            // If the message has a decoded protoMessageFetchResult, emit it
            if (decodedContainer.protoMessageFetchResult) {
                // If it needs an ack, send the ack
                if (decodedContainer.protoMessageFetchResult.needsAck) {
                    this.sendAck(decodedContainer);
                }
                this.emit('protoMessageFetchResult', decodedContainer.protoMessageFetchResult);
            }
            // If it's a room enter, emit
            if (decodedContainer.payloadType === 'im_enter_room_resp') {
                this.emit('imEnteredRoom', decodedContainer);
            }
        }
        catch (err) {
            this.emit('messageDecodingFailed', err);
        }
    }
    /**
     * Static Keep-Alive ping
     */
    sendHeartbeat() {
        const { room_id } = this.webSocketParams;
        // Create the heartbeat
        const hb = types_1.HeartbeatMessage.encode({ roomId: room_id, sendPacketSeqId: '1' });
        // Wrap it in the WebcastPushFrame
        const webcastPushFrame = (0, utilities_1.createBaseWebcastPushFrame)({
            payloadEncoding: 'pb',
            payloadType: 'hb',
            payload: hb.finish(),
            service: undefined,
            method: undefined,
            headers: {}
        });
        this.sendBytes(Buffer.from(webcastPushFrame.finish()));
        this.seqId++;
    }
    /**
     * EXPERIMENTAL: Switch to a different TikTok LIVE room while connected to the WebSocket
     * @param roomId The room ID to switch to
     */
    switchRooms(roomId) {
        this.seqId = 1;
        const imEnterRoomMessage = types_1.WebcastImEnterRoomMessage.encode({
            roomId: roomId,
            roomTag: '',
            liveRegion: '',
            liveId: '12',
            identity: 'audience',
            cursor: '',
            accountType: '0',
            enterUniqueId: '',
            filterWelcomeMsg: '0',
            isAnchorContinueKeepMsg: false
        });
        const webcastPushFrame = (0, utilities_1.createBaseWebcastPushFrame)({
            payloadEncoding: 'pb',
            payloadType: 'im_enter_room',
            payload: imEnterRoomMessage.finish()
        });
        this.sendBytes(Buffer.from(webcastPushFrame.finish()));
        // For mobile compatibility, we should only do the ping heartbeat AFTER connecting to a room
        // For reference, payload_handler_hb (1000) is the close code if you don't
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => this.sendHeartbeat(), this.webSocketPingIntervalMs);
    }
    /**
     * Acknowledge the message was received
     */
    sendAck({ logId, protoMessageFetchResult: { internalExt } }) {
        // Always send an ACK for the message
        if (!logId) {
            return;
        }
        const webcastPushFrame = (0, utilities_1.createBaseWebcastPushFrame)({
            logId: logId,
            payloadEncoding: 'pb',
            payloadType: 'ack',
            payload: textEncoder.encode(internalExt)
        });
        this.sendBytes(Buffer.from(webcastPushFrame.finish()));
    }
}
exports.default = TikTokWsClient;
//# sourceMappingURL=ws-client.js.map