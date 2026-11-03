import { cookies } from "next/headers";
import { parseStoreRegion, REGION_COOKIE } from "./region.logic";

export async function getStoreRegion() {
  return parseStoreRegion((await cookies()).get(REGION_COOKIE)?.value);
}
