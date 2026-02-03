"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendRoomChatFromEulerRoute = void 0;
const route_1 = require("../../../types/route");
const types_1 = require("../../../types");
class SendRoomChatFromEulerRoute extends route_1.Route {
    async call({ roomId, content, sessionId, ttTargetIdc, options }) {
        const resolvedSessionId = sessionId || this.webClient.cookieJar.sessionId;
        const resolvedTtTargetIdc = ttTargetIdc || this.webClient.cookieJar.ttTargetIdc;
        if (resolvedSessionId && !resolvedTtTargetIdc) {
            throw new types_1.FetchSignedWebSocketIdentityParameterError('ttTargetIdc must be set when sessionId is provided.');
        }
        const fetchResponse = await this.webClient.webSigner.webcast.sendRoomChat({
            roomId,
            content,
            sessionId: resolvedSessionId,
            ttTargetIdc: resolvedTtTargetIdc
        }, options);
        switch (fetchResponse.status) {
            case 401:
            case 403:
                throw new types_1.PremiumFeatureError('Sending chats requires an API key & a paid plan, as it uses cloud managed services.', fetchResponse.data.message, JSON.stringify(fetchResponse.data));
            case 200:
                return fetchResponse.data;
            default:
                throw new Error(`Failed to send chat: ${fetchResponse?.data?.message || 'Unknown error'}`);
        }
    }
}
exports.SendRoomChatFromEulerRoute = SendRoomChatFromEulerRoute;
//# sourceMappingURL=send-room-chat-euler.js.map