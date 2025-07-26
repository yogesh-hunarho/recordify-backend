// // import express from "express";
// // import multer from "multer";
// // import fs from "fs";
// // import path from "path";

// // const router = express.Router();
// // const upload = multer({ dest: "uploads/" });

// // router.post("/upload-blob", upload.single("blobfile"), async (req, res) => {
// //   try {
// //     const raw = fs.readFileSync(req.file.path, "utf8");
// //     const byteArray = JSON.parse(raw);
// //     const buffer = Buffer.from(byteArray);

// //     const fixedUploadsDir = path.join("fixed-uploads");
// //     if (!fs.existsSync(fixedUploadsDir)) {
// //       fs.mkdirSync(fixedUploadsDir);
// //     }

// //     const outPath = path.join(fixedUploadsDir, `${Date.now()}.webm`);
// //     fs.writeFileSync(outPath, buffer);

// //     res.json({
// //       message: "WebM reconstructed",
// //       downloadUrl: `/api/fixed-uploads/${path.basename(outPath)}`
// //     });
// //   } catch (err) {
// //     console.error(err);
// //     res.status(500).json({ error: "Failed to reconstruct Blob" });
// //   }
// // });

// // export default router;




// import express from "express";
// import multer from "multer";
// import fs from "fs";
// import path from "path";
// import ffmpeg from "fluent-ffmpeg";
// import which from "which";

// ffmpeg.setFfmpegPath(which.sync("ffmpeg"));

// const router = express.Router();
// const upload = multer({ dest: "uploads/" });

// router.post("/upload-blob", upload.single("blobfile"), async (req, res) => {
//   try {
//     const uploadedPath = req.file.path;
//     const raw = fs.readFileSync(uploadedPath, "utf8");
//     try {
//         const byteArray = JSON.parse(raw);
//         if (!Array.isArray(byteArray)) throw new Error("Not an array");

//         const buffer = Buffer.from(byteArray);
//         const tempInputPath = `temp-${Date.now()}.webm`;
//         fs.writeFileSync(tempInputPath, buffer);

//         if (!Array.isArray(byteArray)) throw new Error("Invalid blob array");
//         console.log("Wrote reconstructed .webm to:", tempInputPath);
//         console.log("Size:", fs.statSync(tempInputPath).size, "bytes");


//         const outputDir = "fixed-uploads";
//         if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

//         const fixedOutputPath = path.join(outputDir, `${Date.now()}.webm`);

//         ffmpeg(tempInputPath)
//         .outputOptions([
//             "-c:v libvpx",   // VP8 for webm
//             "-b:v 1M",
//             "-c:a libopus"   // Audio is already opus
//         ])
//         .on("start", (cmd) => console.log("Running:", cmd))
//         .on("end", () => {
//             res.json({ message: "Conversion successful", downloadUrl: `/api/fixed-uploads/${path.basename(fixedOutputPath)}` });

//             // Auto-delete after 5 min
//             setTimeout(() => {
//             fs.unlink(fixedOutputPath, (err) => {
//                 if (err) console.warn("Cleanup failed:", err.message);
//                 else console.log(`🧹 Deleted ${fixedOutputPath}`);
//             });
//             }, 5 * 60 * 1000);
//         })
//         .on("error", (err) => {
//             console.error("FFmpeg error:", err.message);
//             res.status(500).json({ error: "FFmpeg processing failed" });
//         })
//         .save(fixedOutputPath);
//         } catch (err) {
//             console.error("Invalid JSON in uploaded txt file:", err.message);
//             return res.status(400).json({ error: "Invalid .txt file content" });
//         }

//     } catch (err) {
//         console.error("Upload handler error:", err.message);
//         res.status(500).json({ error: err.message || "Server error" });
//     }
// });

// export default router;
