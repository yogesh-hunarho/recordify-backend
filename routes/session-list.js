import { Router } from "express";
import Recording from "../models/Recording.js";

const router = Router();

router.get("/session", async (req, res) => {
  try {
    const recordings = await Recording.find().sort({ createdAt: -1 });

    const rows = recordings.map((rec, i) => `
      <tr class="border-b">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.batchId}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.batchSessionId}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${rec.teacherId}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${rec.duration}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${new Date(rec.createdAt).toLocaleString()}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${rec.videoUrl}</td>
      </tr>
    `).join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Recording Sessions</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 text-gray-800 p-6">
          <div class="max-w-6xl mx-auto">
            <h1 class="text-3xl font-bold mb-6">Recording Sessions (${recordings.length})</h1>
            
            <div class="flex gap-4 mb-6">
              <a href="/videos" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Go To AWS Uploads</a>
              <a href="/session" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Session List</a>
            </div>

            <div class="overflow-x-auto bg-white shadow rounded-lg">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">BatchID</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">BatchSessionId</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">TeacherID</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Duration</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th class="px-6 py-3 text-left text-sm font-semibold text-gray-700">URL</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-100">
                  ${rows}
                </tbody>
              </table>
            </div>
          </div>
        </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8").send(html);
  } catch (err) {
    console.error("List sessions error:", err);
    res.status(500).send("Error listing sessions");
  }
});

export default router;
