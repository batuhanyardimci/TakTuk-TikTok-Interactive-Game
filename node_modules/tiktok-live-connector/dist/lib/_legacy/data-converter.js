"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreferredPictureFormat = exports.mapBadges = exports.getTopViewerAttributes = exports.getEventAttributes = exports.simplifyObject = void 0;
/**
 * This ugly function brings the nested protobuf objects to a flat level
 * In addition, attributes in "Long" format are converted to strings (e.g. UserIds)
 * This makes it easier to handle the data later, since some libraries have problems to serialize this protobuf specific data.
 */
function simplifyObject(type, originalObject) {
    // Utility function for modifying types easily
    const simplify = (fn) => fn(originalObject);
    if (originalObject.user) {
        originalObject = simplify((webcastObject) => {
            Object.assign(webcastObject, getUserAttributes(webcastObject.user));
            delete webcastObject.user;
            return webcastObject;
        });
    }
    if (originalObject.common) {
        originalObject = simplify((webcastObject) => {
            Object.assign(webcastObject, webcastObject.common.displayText);
            delete webcastObject.common.displayText;
            Object.assign(webcastObject, webcastObject.common);
            delete webcastObject.common;
            return webcastObject;
        });
    }
    switch (type) {
        case 'WebcastQuestionNewMessage': {
            originalObject = simplify((webcastObject) => {
                Object.assign(webcastObject, webcastObject.details);
                delete webcastObject.details;
                return webcastObject;
            });
            break;
        }
        case 'WebcastRoomUserSeqMessage': {
            originalObject = simplify((webcastObject) => {
                webcastObject.topViewers = getTopViewerAttributes(webcastObject.ranksList);
                delete webcastObject.ranksList;
                return webcastObject;
            });
            break;
        }
        case 'WebcastLinkMicBattle': {
            originalObject = simplify((webcastObject) => {
                const battleUsers = [];
                Object.values(webcastObject.anchorInfo).forEach((anchor) => {
                    if (anchor.user) {
                        battleUsers.push(getUserAttributes(anchor.user));
                    }
                });
                webcastObject.battleUsers = battleUsers;
                return webcastObject;
            });
            break;
        }
        case 'WebcastGiftMessage': {
            originalObject = simplify((webcastObject) => {
                webcastObject.repeatEnd = !!webcastObject.repeatEnd;
                webcastObject.gift = {
                    gift_id: webcastObject.giftId,
                    repeat_count: webcastObject.repeatCount,
                    repeat_end: webcastObject.repeatEnd ? 1 : 0,
                    gift_type: webcastObject.giftDetails?.giftType
                };
                if (webcastObject.giftDetails?.giftImage?.url?.length) {
                    webcastObject.giftPictureUrl = webcastObject.giftDetails.giftImage.url[0];
                }
                if (webcastObject.giftDetails) {
                    Object.assign(webcastObject, webcastObject.giftDetails);
                    delete webcastObject.giftDetails;
                }
                if (webcastObject.giftExtra) {
                    if (webcastObject.giftExtra.toUserId) {
                        webcastObject.receiverUserId = webcastObject.giftExtra.toUserId;
                        delete webcastObject.giftExtra.toUserId;
                    }
                    if (webcastObject.giftExtra.sendGiftSendMessageSuccessMs) {
                        webcastObject.timestamp = parseInt(webcastObject.giftExtra.sendGiftSendMessageSuccessMs);
                        delete webcastObject.giftExtra.sendGiftSendMessageSuccessMs;
                    }
                    Object.assign(webcastObject, webcastObject.giftExtra);
                    delete webcastObject.giftExtra;
                }
                if (webcastObject.monitorExtra?.indexOf('{') === 0) {
                    try {
                        webcastObject.monitorExtra = JSON.parse(webcastObject.monitorExtra);
                    }
                    catch (err) {
                        console.warn("Failed to parse monitorExtra JSON:", err);
                    }
                }
                return webcastObject;
            });
            break;
        }
        case 'WebcastChatMessage': {
            originalObject = simplify((webcastObject) => {
                webcastObject.emotes = webcastObject.emotes.map((emote) => ({
                    emoteId: emote.emote.emoteId,
                    emoteImageUrl: emote.emote.image.imageUrl,
                    placeInComment: emote.placeInComment
                }));
                return webcastObject;
            });
            break;
        }
        case 'WebcastEmoteChatMessage': {
            originalObject = simplify((webcastObject) => {
                webcastObject.emotes = webcastObject.emoteList.map((emote) => ({
                    emoteId: emote.emoteId,
                    emoteImageUrl: emote.image.url[0]
                }));
                return webcastObject;
            });
            break;
        }
    }
    return originalObject;
}
exports.simplifyObject = simplifyObject;
function getUserAttributes(webcastUser) {
    webcastUser ||= {};
    const userAttributes = {
        userId: webcastUser.userId?.toString(),
        secUid: webcastUser.secUid?.toString(),
        uniqueId: webcastUser.uniqueId !== '' ? webcastUser.uniqueId : undefined,
        nickname: webcastUser.nickname !== '' ? webcastUser.nickname : undefined,
        profilePictureUrl: getPreferredPictureFormat(webcastUser.profilePicture?.url),
        followRole: webcastUser.followInfo?.followStatus,
        userBadges: mapBadges(webcastUser.badges),
        userSceneTypes: webcastUser.badges?.map((x) => x?.badgeScene || 0),
        userDetails: {
            createTime: webcastUser.createTime?.toString(),
            bioDescription: webcastUser.bioDescription,
            profilePictureUrls: webcastUser.profilePicture?.url
        }
    };
    if (webcastUser.followInfo) {
        userAttributes.followInfo = {
            followingCount: webcastUser.followInfo.followingCount,
            followerCount: webcastUser.followInfo.followerCount,
            followStatus: webcastUser.followInfo.followStatus,
            pushStatus: webcastUser.followInfo.pushStatus
        };
    }
    userAttributes.isModerator = userAttributes.userBadges.some((x) => (x.type && x.type.toLowerCase().includes('moderator')) || x.badgeSceneType === 1);
    userAttributes.isNewGifter = userAttributes.userBadges.some((x) => x.type && x.type.toLowerCase().includes('live_ng_'));
    userAttributes.isSubscriber = userAttributes.userBadges.some((x) => (x.url && x.url.toLowerCase().includes('/sub_')) || x.badgeSceneType === 4 || x.badgeSceneType === 7);
    userAttributes.topGifterRank =
        userAttributes.userBadges
            .find((x) => x.url && x.url.includes('/ranklist_top_gifter_'))
            ?.url.match(/(?<=ranklist_top_gifter_)(\d+)(?=.png)/g)
            ?.map(Number)[0] ?? null;
    userAttributes.gifterLevel = userAttributes.userBadges.find((x) => x.badgeSceneType === 8)?.level || 0; // BadgeSceneType_UserGrade
    userAttributes.teamMemberLevel = userAttributes.userBadges.find((x) => x.badgeSceneType === 10)?.level || 0; // BadgeSceneType_Fans
    return userAttributes;
}
function getEventAttributes(event) {
    if (event.msgId)
        event.msgId = event.msgId.toString();
    if (event.createTime)
        event.createTime = event.createTime.toString();
    return event;
}
exports.getEventAttributes = getEventAttributes;
function getTopViewerAttributes(topViewers) {
    return topViewers.map((viewer) => {
        return {
            user: viewer.user ? getUserAttributes(viewer.user) : null,
            coinCount: viewer.coinCount ? parseInt(viewer.coinCount) : 0
        };
    });
}
exports.getTopViewerAttributes = getTopViewerAttributes;
function mapBadges(badges) {
    let simplifiedBadges = [];
    if (Array.isArray(badges)) {
        badges.forEach((innerBadges) => {
            let badgeSceneType = innerBadges.badgeSceneType;
            if (Array.isArray(innerBadges.badges)) {
                innerBadges.badges.forEach((badge) => {
                    simplifiedBadges.push(Object.assign({ badgeSceneType }, badge));
                });
            }
            if (Array.isArray(innerBadges.imageBadges)) {
                innerBadges.imageBadges.forEach((badge) => {
                    if (badge && badge.image && badge.image.url) {
                        simplifiedBadges.push({
                            type: 'image',
                            badgeSceneType,
                            displayType: badge.displayType,
                            url: badge.image.url
                        });
                    }
                });
            }
            if (innerBadges.privilegeLogExtra?.level && innerBadges.privilegeLogExtra?.level !== '0') {
                simplifiedBadges.push({
                    type: 'privilege',
                    privilegeId: innerBadges.privilegeLogExtra.privilegeId,
                    level: parseInt(innerBadges.privilegeLogExtra.level),
                    badgeSceneType: innerBadges.badgeSceneType
                });
            }
        });
    }
    return simplifiedBadges;
}
exports.mapBadges = mapBadges;
function getPreferredPictureFormat(pictureUrls) {
    if (!pictureUrls || !Array.isArray(pictureUrls) || !pictureUrls.length) {
        return null;
    }
    return (pictureUrls.find((x) => x.includes('100x100') && x.includes('.webp')) ||
        pictureUrls.find((x) => x.includes('100x100') && x.includes('.jpeg')) ||
        pictureUrls.find((x) => !x.includes('shrink')) ||
        pictureUrls[0]);
}
exports.getPreferredPictureFormat = getPreferredPictureFormat;
//# sourceMappingURL=data-converter.js.map