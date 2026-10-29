import { ApiError } from "@/shared/api/client";
import { requestErrorMessage } from "../requests.logic";

export function requestFailureMessage(failure: unknown) {
  return failure instanceof ApiError
    ? requestErrorMessage(failure.status, failure.message)
    : requestErrorMessage(null, "");
}

export function requestFormError(failure: unknown) {
  return failure instanceof Error && !(failure instanceof ApiError)
    ? failure.message
    : requestFailureMessage(failure);
}
