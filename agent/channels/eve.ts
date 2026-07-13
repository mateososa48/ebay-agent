import { eveChannel } from "eve/channels/eve";
import { none } from "eve/channels/auth";

// Personal, single-user tool: no login system, and the deploy is already public,
// so the agent endpoint is open (none()). Publishing to eBay stays approval-gated,
// so an open agent can only ever queue drafts for review — never list on its own.
// If this ever gets real users, swap none() for Auth.js/Clerk here.
export default eveChannel({
  auth: [none()],
});
