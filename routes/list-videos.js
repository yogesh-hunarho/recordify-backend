import { Router } from "express";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fromEnv } from "@aws-sdk/credential-providers";

const router = Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

router.get("/videos", async (req, res) => {
  const folder  = req.query.folder || "recording-videos";
  const prefix  = `${folder}/`;

  try {
    /* 1️⃣  list all objects under the prefix */
    const { Contents } = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_BUCKET,
        Prefix: prefix,
      })
    );

    if (!Contents?.length) return res.send("<h3>No videos found.</h3>");

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

    const html =`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Uploaded videos</title>
          <style>
            body   { font-family: system-ui, sans-serif; background:#fafafa; padding:32px; }
            table  { border-collapse: collapse; width:100%; background:#fff; box-shadow:0 2px 6px #0002; }
            th,td  { padding:12px 16px; border-bottom:1px solid #eee; text-align:left; }
            th     { background:#f0f0f0; }
            button { padding:6px 12px; cursor:pointer; }
            video  { width:100%; max-height:480px; margin-top:12px; outline:1px solid #ddd; }
            a      { text-decoration: none;}
          </style>
        </head>
        <body>
          <h1>Uploaded videos (${rows.length})</h1>

          <table>
            <thead>
              <tr>
                <th>Name</th><th>Size</th><th>Date</th><th>Play</th><th>Download</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r, i) =>`
                  <tr>
                    <td>${r.name}</td>
                    <td>${r.size}</td>
                    <td>${r.date}</td>
                    <td>
                      <button onclick="toggle(${i})">▶️ Play</button>
                      <div id="player-${i}" style="display:none">
                        <video controls preload="metadata">
                          <source src="${r.playUrl}" type="${r.type}">
                          Your browser doesn’t support HTML5 video.
                        </video>
                      </div>
                    </td>
                    <td>
                      <button>
                        <a role="button" href="${r.downloadUrl}">⬇️ Download</a>
                      </button>
                    </td>
                    <td>
                      <button>🧨 Delete</button>
                    </td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>

          <script>
            function toggle(idx){
              const div = document.getElementById('player-'+idx);
              div.style.display = div.style.display==='none' ? 'block':'none';
            }
            async function del(encodedKey){
              if(!confirm('Really delete this file?')) return;
              const res = await fetch('/videos/'+encodedKey, { method:'DELETE' });
              if(res.ok){ location.reload(); }
              else      { alert('Delete failed'); }
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
