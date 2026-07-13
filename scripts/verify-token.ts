import { getUserAccessToken } from '../lib/ebay/oauth';

async function main() {
  const t = await getUserAccessToken();
  console.log(`✓ Minted a live USER access token from the stored refresh token (${t.length} chars).`);
  console.log('  The agent can now act on the connected eBay account.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('✗ Could not mint a user token:', err.message);
    process.exit(1);
  },
);
