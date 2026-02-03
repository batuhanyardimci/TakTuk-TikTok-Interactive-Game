/// <reference types="node" />
/// <reference types="node" />
import { WebcastPushFrame } from '../types/tiktok-schema';
import { DecodedWebcastPushFrame, IWebcastDeserializeConfig, WebcastMessage } from '../types/client';
import { DevicePreset } from '../lib/config';
import { BinaryWriter } from '@bufbuild/protobuf/wire';
export declare const WebcastDeserializeConfig: IWebcastDeserializeConfig;
export declare function deserializeMessage<T extends keyof WebcastMessage>(protoName: T, binaryMessage: Buffer): WebcastMessage[T];
export declare function deserializeWebSocketMessage(binaryMessage: Uint8Array): Promise<DecodedWebcastPushFrame>;
export declare function validateAndNormalizeUniqueId(uniqueId: string): string;
export declare function userAgentToDevicePreset(userAgent: string): DevicePreset;
export declare function generateDeviceId(): string;
export declare function createBaseWebcastPushFrame(overrides: Partial<WebcastPushFrame>): BinaryWriter;
//# sourceMappingURL=utilities.d.ts.map