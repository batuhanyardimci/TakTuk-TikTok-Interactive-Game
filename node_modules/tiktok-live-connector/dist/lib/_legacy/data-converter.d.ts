import { WebcastEventMessage } from '../../types';
/**
 * This ugly function brings the nested protobuf objects to a flat level
 * In addition, attributes in "Long" format are converted to strings (e.g. UserIds)
 * This makes it easier to handle the data later, since some libraries have problems to serialize this protobuf specific data.
 */
export declare function simplifyObject(type: keyof WebcastEventMessage, originalObject: any): WebcastEventMessage & Record<string, any>;
export declare function getEventAttributes(event: any): any;
export declare function getTopViewerAttributes(topViewers: any): any;
export declare function mapBadges(badges: any): any[];
export declare function getPreferredPictureFormat(pictureUrls: any): any;
//# sourceMappingURL=data-converter.d.ts.map