import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Authorizes direct browser → Vercel Blob uploads (bypasses the serverless body limit).
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        // Only eBay-safe raster formats. HEIC/HEIF/WebP are converted to JPEG client-side
        // before upload, so nothing eBay would reject as a PictureURL reaches Blob.
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif'],
        addRandomSuffix: true,
        maximumSizeInBytes: 20 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {
        /* no-op: the item is created client-side with the returned URLs */
      },
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
