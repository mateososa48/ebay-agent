import { withEve } from 'eve/next';

/** @type {import('next').NextConfig} */
const nextConfig = {};

// withEve mounts the eve agent (agent/ dir) under /eve/v1/* on the same origin,
// so the Next.js dashboard and the agent deploy as one Vercel project.
export default withEve(nextConfig);
