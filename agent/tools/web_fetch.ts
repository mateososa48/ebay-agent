import { disableTool } from 'eve/tools';

// Disable eve's built-in web_fetch. Fetching arbitrary pages gets 403-blocked by
// many sites and adds latency/step-burn that stalled the run. The agent relies on
// web_search result snippets instead, which are enough to identify + price an item.
export default disableTool();
