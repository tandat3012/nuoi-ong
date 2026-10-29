import { parsePushResponsePayload } from './push-response';

// Foreground presentation only. Navigation/read state belongs to later stages.
export function foregroundPushBehavior(
  data: unknown,
  audience: { userId: string | null; farmIds: string[] },
) {
  const payload = parsePushResponsePayload(data);
  const allowed = !!(
    audience.userId &&
    payload &&
    payload.recipientUserId === audience.userId &&
    audience.farmIds.includes(payload.farmId)
  );
  return {
    shouldShowBanner: allowed,
    shouldShowList: allowed,
    shouldPlaySound: allowed,
    shouldSetBadge: false,
  };
}
