import { listClosedWeeks } from "@/lib/wins";
import { CopyPage } from "./copy-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const weeks = await listClosedWeeks();
  return <CopyPage weeks={weeks} />;
}
