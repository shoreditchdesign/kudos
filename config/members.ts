// Source of truth for "who is on the team."
//
// slackUserId is the canonical key — Slack returns it from every modal
// submission. email is recorded for human reference but never used to
// resolve identity at runtime.
//
// To add or remove someone:
//   1. Drop their headshot at public/headshots/<firstname-lastname>.png
//      (square or 3:4 portrait, ~900×1200 px).
//   2. Add a row to MEMBERS below.
//   3. Open a PR. The change is auditable in git history.

export type Member = {
  slackUserId: string;
  email: string;
  fullName: string;
  headshotPath: string; // path under /public, e.g. "/headshots/alice.png"
};

const FALLBACK_HEADSHOT = "/headshots/computer.png";

export const MEMBERS: Member[] = [
  {
    slackUserId: "U0B7T8NV672",
    email: "alex.gibson@shoreditchdesignstudio.com",
    fullName: "Alex Gibson",
    headshotPath: "/headshots/alex-gibson.png",
  },
  {
    slackUserId: "U0AHFTSU0B1",
    email: "alex@shoreditchdesignstudio.com",
    fullName: "Alex Vojtku",
    headshotPath: "/headshots/alex-vojtku.png",
  },
  {
    slackUserId: "U3K7P9T8E",
    email: "andrew@shoreditchdesignstudio.com",
    fullName: "Andrew Burton",
    headshotPath: "/headshots/andrew-burton.png",
  },
  {
    slackUserId: "U064CP6RXMZ",
    email: "austin@shoreditchdesignstudio.com",
    fullName: "Austin Joseph",
    headshotPath: "/headshots/austin-joseph.png",
  },
  {
    slackUserId: "U0ABZ52TA1Y",
    email: "charlotte@shoreditchdesignstudio.com",
    fullName: "Charlotte Reed",
    headshotPath: "/headshots/charlotte-reed.png",
  },
  {
    slackUserId: "U0AAG585D71",
    email: "chris@shoreditchdesignstudio.com",
    fullName: "Chris Cannon",
    headshotPath: "/headshots/chris-cannon.png",
  },
  {
    slackUserId: "U01CFQBLVU0",
    email: "danielle@shoreditchdesignstudio.com",
    fullName: "Danielle Willetts",
    headshotPath: "/headshots/danielle-willetts.png",
  },
  {
    slackUserId: "U09NQ0K9ZGS",
    email: "edward@shoreditchdesignstudio.com",
    fullName: "Edward Gray",
    headshotPath: "/headshots/edward-gray.png",
  },
  {
    slackUserId: "U02CPPHLU22",
    email: "emma@shoreditchdesignstudio.com",
    fullName: "Emma James",
    headshotPath: "/headshots/emma-james.png",
  },
  {
    slackUserId: "U01846U0H47",
    email: "flo@shoreditchdesignstudio.com",
    fullName: "Flo Slater",
    headshotPath: "/headshots/flo-slater.png",
  },
  {
    slackUserId: "U0AP4F1T9DE",
    email: "freya@shoreditchdesignstudio.com",
    fullName: "Freya Sprong",
    headshotPath: "/headshots/freya-sprong.png",
  },
  {
    slackUserId: "U03SAERMTMM",
    email: "jack@shoreditchdesignstudio.com",
    fullName: "Jack Tollman",
    headshotPath: "/headshots/jack-tollman.png",
  },
  {
    slackUserId: "U03NKAQQPSB",
    email: "jamain@shoreditchdesignstudio.com",
    fullName: "Jamain Gordon",
    headshotPath: "/headshots/jamain-gordon.png",
  },
  {
    slackUserId: "U08L9A916QL",
    email: "joe@shoreditchdesignstudio.com",
    fullName: "Joe Jonas",
    headshotPath: "/headshots/joe-jonas.png",
  },
  {
    slackUserId: "U03RS2RQRHU",
    email: "lucia@shoreditchdesignstudio.com",
    fullName: "Lucia Anton",
    headshotPath: "/headshots/lucia-anton.png",
  },
  {
    slackUserId: "U0AG048ECNQ",
    email: "matthew.birkinshaw@shoreditchdesignstudio.com",
    fullName: "Matthew Birkinshaw",
    headshotPath: "/headshots/mathew-birkinshaw.png",
  },
  {
    slackUserId: "U0ACD3ULQ02",
    email: "mathew@shoreditchdesignstudio.com",
    fullName: "Mathew Dane",
    headshotPath: "/headshots/mathew-dane.png",
  },
  {
    slackUserId: "U0AHXBQCWM8",
    email: "mia@shoreditchdesignstudio.com",
    fullName: "Mia Clark",
    headshotPath: "/headshots/mia-clark.png",
  },
  {
    slackUserId: "U01TYTJ3TEY",
    email: "sabi@shoreditchdesignstudio.com",
    fullName: "Sabi Andrade",
    headshotPath: "/headshots/sabi-andrade.png",
  },
  {
    slackUserId: "U068FLACNHG",
    email: "sean@shoreditchdesignstudio.com",
    fullName: "Sean Ayeltigah",
    headshotPath: "/headshots/sean-ayeltigah.png",
  },
  {
    slackUserId: "U02814LM1V5",
    email: "shaina@shoreditchdesignstudio.com",
    fullName: "Shaina Patel",
    headshotPath: "/headshots/shaina-patel.png",
  },
  {
    slackUserId: "U09QR15GW5N",
    email: "simon.patel@shoreditchdesignstudio.com",
    fullName: "Simon Patel",
    headshotPath: "/headshots/simon-patel.png",
  },
  {
    slackUserId: "UNNS67WTH",
    email: "will@shoreditchdesignstudio.com",
    fullName: "Will Gregson",
    headshotPath: "/headshots/will-gregson.png",
  },
  {
    slackUserId: "U0ANL4TEDKK",
    email: "zoe@shoreditchdesignstudio.com",
    fullName: "Zoe Jarvis",
    headshotPath: "/headshots/zoe-jarvis.png",
  },
];

export const MEMBERS_BY_SLACK_ID: Readonly<Record<string, Member>> =
  Object.freeze(Object.fromEntries(MEMBERS.map((m) => [m.slackUserId, m])));

export const MEMBERS_BY_EMAIL: Readonly<Record<string, Member>> = Object.freeze(
  Object.fromEntries(MEMBERS.map((m) => [m.email.toLowerCase(), m])),
);

// Lookup helper that never throws — returns a placeholder Member for unknown
// Slack IDs so the renderer can still produce a slide. Callers that want to
// surface "missing roster entry" warnings should check MEMBERS_BY_SLACK_ID
// directly.
export function resolveMember(slackUserId: string): Member {
  const known = MEMBERS_BY_SLACK_ID[slackUserId];
  if (known) return known;
  return {
    slackUserId,
    email: "",
    fullName: slackUserId,
    headshotPath: FALLBACK_HEADSHOT,
  };
}

// Sentinel used in the wins table when the sender ticks "Add whole team" in
// the Slack modal. Stored in recipient_slack_ids as ['@everyone'] so the
// renderer knows to swap the headshot grid for the everyone.png gallery.
export const EVERYONE_SENTINEL = "@everyone";
export const EVERYONE_IMAGE_PATH = "/headshots/everyone.png";
