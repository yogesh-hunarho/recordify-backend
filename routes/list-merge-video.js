import { Router } from "express";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fromEnv } from "@aws-sdk/credential-providers";

const router = Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

router.get("/auto-upload", async (req, res) => {
  const prefix = `merged-videos/`;

  try {
    const { Contents } = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET,
        Prefix: prefix,
      })
    );

    if (!Contents?.length) {
      return res.send("<h3>No videos found.</h3>");
    }

    const rows = await Promise.all(
      Contents.map(async ({ Key, Size, LastModified }) => {
        const playUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key,
          }),
          { expiresIn: 3600 }
        );

        const downloadUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key,
            ResponseContentDisposition: `attachment; filename="${Key.split("/").pop()}"`
          }),
          { expiresIn: 3600 }
        );

        return {
          Key,
          name: Key.split("/").pop(),
          size: (Size / 1024 / 1024).toFixed(1) + " MB",
          date: new Date(LastModified).toLocaleString(),
          playUrl,
          downloadUrl,
          type: Key.endsWith(".mp4") ? "video/mp4" : "video/webm",
        };
      })
    );

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Merged Videos</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 text-gray-800 p-6">
          <div class="max-w-7xl mx-auto">
            <h1 class="text-3xl font-bold mb-6">Merged Videos (${rows.length})</h1>

            <div class="flex gap-4 mb-6">
              <a href="/videos" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">AWS Uploads</a>
              <a href="/session" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Sessions</a>
              <a href="/force-merge" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Force Merge</a>
            </div>

            <div class="overflow-x-auto bg-white shadow rounded-lg">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Size</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Play</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Download</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-100">
                  ${rows
                    .map(
                      (r, i) => `
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap">${r.name}</td>
                      <td class="px-6 py-4">${r.size}</td>
                      <td class="px-6 py-4">${r.date}</td>
                      <td class="px-6 py-4">
                        <button onclick="toggle(${i})" class="text-blue-600 hover:underline">▶️ Play</button>
                        <div id="player-${i}" class="mt-2 hidden">
                          <video controls class="w-full max-h-96 mt-2 rounded shadow">
                            <source src="${r.playUrl}" type="${r.type}">
                            Your browser doesn’t support HTML5 video.
                          </video>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <a href="${r.downloadUrl}" class="text-green-600 hover:underline">⬇️ Download</a>
                      </td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>

          <script>
            function toggle(idx){
              const div = document.getElementById('player-'+idx);
              div.classList.toggle('hidden');
            }
          </script>
        </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8").send(html);
  } catch (err) {
    console.error("List videos error:", err);
    res.status(500).send("Error listing videos");
  }
});


export default router;
