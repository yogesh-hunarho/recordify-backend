// import { Router } from "express";
// import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// import { fromEnv } from "@aws-sdk/credential-providers";

// const router = Router();

// const s3 = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: fromEnv(),
// });

// router.get("/videos", async (req, res) => {
//   const folder = req.query.folder || "recording-videos";
//   const prefix = `${folder}/`;

//   try {
//     const listCommand = new ListObjectsV2Command({
//       Bucket: process.env.AWS_BUCKET,
//       Prefix: prefix,
//     });

//     const { Contents } = await s3.send(listCommand);

//     if (!Contents || Contents.length === 0) {
//       return res.send("<h3>No videos found.</h3>");
//     }

//     // Get signed URLs for each file
//     const urls = await Promise.all(
//       Contents.map(async (file) => {
//         const getCmd = new GetObjectCommand({
//           Bucket: process.env.AWS_BUCKET,
//           Key: file.Key,
//         });

//         const url = await getSignedUrl(s3, getCmd, { expiresIn: 3600 });
//         return {
//           url,
//           name: file.Key.split("/").pop(),
//           type: file.Key.endsWith(".mp4") ? "video/mp4" : "video/webm",
//         };
//       })
//     );

//     const html = `
//       <html>
//         <head>
//           <title>Uploaded Videos</title>
//           <style>
//             body { font-family: sans-serif; padding: 20px; background: #f7f7f7; }
//             video { width: 100%; max-width: 600px; margin-bottom: 40px; display: block; }
//             h2 { margin-top: 40px; }
//           </style>
//         </head>
//         <body>
//           <h1>Uploaded Videos</h1>
//           ${urls
//             .map(
//               ({ url, name, type }) => `
//               <div>
//                 <h2>${name}</h2>
//                 <video controls>
//                   <source src="${url}" type="${type}">
//                   Your browser does not support the video tag.
//                 </video>
//               </div>`
//             )
//             .join("")}
//         </body>
//       </html>
//     `;

//     res.send(html);
//   } catch (err) {
//     console.error("List videos error:", err);
//     res.status(500).send("Error listing videos");
//   }
// });

// export default router;



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

    /* 2️⃣  build table rows with signed URLs (+ file meta) */
    const rows = await Promise.all(
      Contents.map(async ({ Key, Size, LastModified }) => {
        // one signed URL to STREAM/PLAY (1 h) …
        const playUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET,
            Key,
          }),
          { expiresIn: 3600 }
        );
        // …and one to FORCE download (add `response-content-disposition`)
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
          name: Key.split("/").pop(),
          size: (Size / 1024 / 1024).toFixed(1) + " MB",
          date: new Date(LastModified).toLocaleString(),
          playUrl,
          downloadUrl,
          type: Key.endsWith(".mp4") ? "video/mp4" : "video/webm",
        };
      })
    );

    /* 3️⃣  render HTML */
    const html = /*html*/ `
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
          </style>
        </head>
        <body>
          <h1>Uploaded videos (${rows.length})</h1>

          <table>
            <thead>
              <tr>
                <th>Name</th><th>Size</th><th>Date</th><th>Play</th><th>Download</th>
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
                    <td><a href="${r.downloadUrl}">⬇️ Download</a></td>
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
