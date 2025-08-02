import express from "express";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

const router = express.Router();

function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

router.get("/force-merge", async (req, res) => {
  const basePath = path.join("uploads/chunks");

  if (!fs.existsSync(basePath)) {
    return res.send("<h2>No chunks available</h2>");
  }

  const htmlBlocks = [];

  for (const batchId of fs.readdirSync(basePath)) {
    const batchPath = path.join(basePath, batchId);
    if (!fs.lstatSync(batchPath).isDirectory()) continue;

    for (const batchSessionId of fs.readdirSync(batchPath)) {
      const sessionPath = path.join(batchPath, batchSessionId);
      if (!fs.lstatSync(sessionPath).isDirectory()) continue;

      for (const teacherId of fs.readdirSync(sessionPath)) {
        const chunkPath = path.join(sessionPath, teacherId);
        if (!fs.lstatSync(chunkPath).isDirectory()) continue;

        const chunks = fs.readdirSync(chunkPath).filter(f => f.endsWith(".webm"));

        let totalSizeBytes = 0;
        let totalDurationSec = 0;
        const chunkDetails = [];

        for (const chunk of chunks) {
          const fullPath = path.join(chunkPath, chunk);
          try {
            const stats = fs.statSync(fullPath);
            totalSizeBytes += stats.size;

            const duration = await getVideoDuration(fullPath);
            if (!isNaN(duration)) {
              totalDurationSec += duration;
            }

            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            chunkDetails.push(`
              <tr class="border-b text-sm text-gray-700">
                <td class="py-1 px-2">${chunk}</td>
                <td class="py-1 px-2">${sizeMB} MB</td>
              </tr>
            `);
          } catch (err) {
            console.warn(`Skipping ${chunk} due to error:`, err.message);
          }
        }

        const sizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

        const detailsTable = `
          <div id="details-${batchId}-${batchSessionId}-${teacherId}" class="hidden mt-4">
            <table class="w-full border border-gray-200 text-left">
              <thead class="bg-gray-100">
                <tr>
                  <th class="py-2 px-2">Chunk Name</th>
                  <th class="py-2 px-2">Size</th>
                </tr>
              </thead>
              <tbody>
                ${chunkDetails.join("")}
              </tbody>
            </table>
          </div>
        `;

        htmlBlocks.push(`
          <div class="border border-gray-300 rounded-xl p-4 shadow mb-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="text-sm space-y-1">
                <div><span class="font-semibold">Session:</span> ${batchId}</div>
                <div><span class="font-semibold">BatchSession:</span> ${batchSessionId}</div>
                <div><span class="font-semibold">Teacher:</span> ${teacherId}</div>
                <div><span class="font-semibold">Chunks:</span> ${chunks.length}</div>
                <div><span class="font-semibold">Size:</span> ${sizeMB} MB</div>
              </div>
              <div class="mt-4 sm:mt-0 flex gap-2">
                <button onclick="mergeChunks('${batchId}', '${batchSessionId}', '${teacherId}')" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition">Merge</button>
                <button onclick="toggleDetails('${batchId}', '${batchSessionId}', '${teacherId}')" class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition">Show Chunks</button>
                <button onclick="deleteChunks('${batchId}', '${batchSessionId}', '${teacherId}')" class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition">Delete</button>

              </div>
            </div>
            ${detailsTable}
          </div>
        `);
      }
    }
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Force Merge</title>
      <script>
        async function mergeChunks(batchId, batchSessionId, teacherId) {
          const confirmed = confirm("Are you sure you want to merge these chunks?");
          if (!confirmed) return;

          try {
            const response = await fetch("/api/merge-chunks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ batchId, batchSessionId, teacherId }),
            });
            const result = await response.json();
            alert(result.success ? "Merged successfully" : result.error || "Unknown error");
            location.reload();
          } catch (err) {
            alert("Merge failed: " + err.message);
          }
        }

        function toggleDetails(batchId, batchSessionId, teacherId) {
          const el = document.getElementById("details-" + batchId + "-" + batchSessionId + "-" + teacherId);
          el.classList.toggle("hidden");
        }

        async function deleteChunks(batchId, batchSessionId, teacherId) {
          const confirmed = confirm("Are you sure you want to delete these chunks? This action is irreversible.");
          if (!confirmed) return;

          try {
            const response = await fetch("/api/delete-chunks", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ batchId, batchSessionId, teacherId }),
            });
            const result = await response.json();
            alert(result.success ? "Deleted successfully" : result.error || "Unknown error");
            location.reload();
          } catch (err) {
            alert("Delete failed: " + err.message);
          }
        }
      </script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 text-gray-900">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <h1 class="text-2xl font-bold mb-6">Force Merge Pending Recordings</h1>
        <div class="flex gap-4 mb-6">
          <a href="/videos" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition">Go To Upload</a>
          <a href="/session" class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition">All Sessions</a>
          <a href="/force-merge" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">Refresh</a>
        </div>
        ${htmlBlocks.length ? htmlBlocks.join("") : "<p>No pending chunks found.</p>"}
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

export default router;
