import { unstable_cache } from "next/cache";
import { listClosedWeeks } from "@/lib/wins";
import { CopyPage } from "./copy-page";

export const dynamic = "force-dynamic";

// The closed-weeks list only changes when a new week's Thursday 16:00 cutoff
// passes — a 60s cache window cuts repeat-visit DB queries to near-zero.
const cachedListClosedWeeks = unstable_cache(
  async () => listClosedWeeks(),
  ["list-closed-weeks"],
  { revalidate: 60 },
);

export default async function Page() {
  const weeks = await cachedListClosedWeeks();
  return <CopyPage weeks={weeks} />;
}
