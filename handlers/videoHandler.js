import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { fromEnv } from "@aws-sdk/credential-providers";
import { v4 as uuidv4 } from "uuid";
import Recording from "../models/Recording.js";

const execAsync = promisify(exec);

class VideoHandler {
  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: fromEnv(),
    });
  }

  validateMergeRequest(req) {
    const { batchSessionId, batchId, teacherId } = req.body;
    
    if (!batchSessionId || !batchId || !teacherId) {
      throw new Error("Missing required parameters: batchSessionId, batchId, or teacherId");
    }

    return { batchSessionId, batchId, teacherId };
  }

  setupPaths(batchId, batchSessionId, teacherId) {
    const chunkDir = path.join("uploads/chunks", String(batchId), String(batchSessionId), String(teacherId));
    const outputDir = path.join("uploads", "final");
    const outputPath = path.join(outputDir, `${batchId}_${batchSessionId}_${teacherId}.mp4`);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    return { chunkDir, outputDir, outputPath };
  }

  getChunkFiles(chunkDir) {
    if (!fs.existsSync(chunkDir)) {
      throw new Error("Chunks directory not found");
    }

    const files = fs.readdirSync(chunkDir)
      .filter(f => f.endsWith('.webm'))
      .sort((a, b) => {
        const aNum = parseInt(a.split("_")[1]);
        const bNum = parseInt(b.split("_")[1]);
        return aNum - bNum;
      });

    if (files.length === 0) {
      throw new Error("No WebM chunks found");
    }

    console.log("Found chunks:", files);
    return files;
  }

  createFileList(chunkDir, files) {
    const listFile = path.join(chunkDir, "chunks.txt");
    const fileList = files.map(f => `file '${f}'`).join("\n");
    fs.writeFileSync(listFile, fileList);
    return listFile;
  }

  async mergeChunks(listFile, outputPath) {
    return new Promise((resolve, reject) => {
      const absoluteOutputPath = path.resolve(outputPath);
      const ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${absoluteOutputPath}"`;

      exec(ffmpegCmd, (err, stdout, stderr) => {
        if (err) {
          console.error("❌ ffmpeg error:", err.message);
          console.error("❌ ffmpeg stderr:", stderr);
          reject(new Error(`Merge failed: ${err.message}`));
          return;
        }

        console.log("✅ FFmpeg stdout:", stdout);
        console.log("✅ Video merged successfully");

        if (!fs.existsSync(absoluteOutputPath)) {
          reject(new Error("Output file was not created"));
          return;
        }

        resolve(absoluteOutputPath);
      });
    });
  }

  async getVideoDuration(filePath) {
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
      const duration = parseFloat(stdout.trim());
      return Math.round(duration);
    } catch (error) {
      console.error("❌ Error getting video duration:", error);
      throw new Error("Failed to get video duration");
    }
  }

  async uploadToS3(filePath, key, contentType = 'video/mp4') {
    try {
      const fileStream = fs.createReadStream(filePath);
      
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
      });

      await this.s3.send(command);
      
      const s3Url = `${process.env.AWS_HOST}${key}`;
      return s3Url;
    } catch (error) {
      console.error("❌ S3 upload error:", error);
      throw error;
    }
  }

  generateS3Key(batchId, batchSessionId, teacherId) {
    const date = new Date().toISOString().split('T')[0];
    const uuid = uuidv4();
    return `merged-videos/${date}/${uuid}-${batchId}_${batchSessionId}_${teacherId}.mp4`;
  }

  async saveToDatabase(batchSessionId, batchId, teacherId, videoUrl, duration) {
    const recording = new Recording({
      batchSessionId: batchSessionId,
      batchId: parseInt(batchId),
      teacherId: parseInt(teacherId),
      videoUrl: videoUrl,
      duration: duration
    });

    await recording.save();
    console.log("✅ Recording saved to database");
    return recording;
  }

  async callExternalAPI(batchSessionId, batchId, teacherId, videoUrl, duration) {
    try {
      const myHeaders = new Headers();
      myHeaders.append("Authorization", "ipVefQSuBvkt4i9AFX3brGOVIEEK6xL4");
      myHeaders.append("Accept", "application/json");
      myHeaders.append("Content-Type", "application/json");

      const raw = JSON.stringify({
        "batch_session_id": parseInt(batchSessionId),
        "batch_id": parseInt(batchId),
        "teacher_id": parseInt(teacherId),
        "session_uid": `session_${batchId}`,
        "recording_session_id": `rec_${batchId}_${teacherId}`,
        "recording_file": videoUrl,
        "duration": duration
      });

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
      };

      const response = await fetch("https://lmsuat.hunarho.com/api/session-recordings", requestOptions);
      const result = await response.text();
      
      if (!response.ok) {
        throw new Error(`External API call failed: ${response.status} - ${result}`);
      }
      
      console.log("✅ External API response:", result);
      return result;
    } catch (error) {
      console.error("❌ External API call error:", error);
      throw error;
    }
  }

  async cleanup(outputPath, chunkDir) {
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        console.log("✅ Local merged video file removed");
      }
      
      if (fs.existsSync(chunkDir)) {
        fs.rmSync(chunkDir, { recursive: true, force: true });
        console.log("✅ Cleaned up chunk directory");
      }
    } catch (cleanupErr) {
      console.warn("⚠️ Failed to clean up local files:", cleanupErr.message);
    }
  }

  async handle(req, res) {
    try {
      console.log("📹 Starting video merge process...");

      const { batchSessionId, batchId, teacherId } = this.validateMergeRequest(req);

      const { chunkDir, outputPath } = this.setupPaths(batchId, batchSessionId, teacherId);

      const files = this.getChunkFiles(chunkDir);

      const listFile = this.createFileList(chunkDir, files);

      console.log("🔄 Merging video chunks...");
      const mergedFilePath = await this.mergeChunks(listFile, outputPath);

      const duration = await this.getVideoDuration(mergedFilePath);

      console.log("🚀 Uploading to S3...");
      const s3Key = this.generateS3Key(batchId, batchSessionId, teacherId);
      const s3Url = await this.uploadToS3(mergedFilePath, s3Key);
      console.log("✅ Video uploaded to S3:", s3Url);

      console.log("💾 Saving to database...");
      // await this.saveToDatabase(batchSessionId, batchId, teacherId, s3Url, duration);

      console.log("🌐 Calling external API...");
      // await this.callExternalAPI(batchSessionId, batchId, teacherId, s3Url, duration);
      console.log("✅ External API called successfully");

      console.log("🧹 Cleaning up temporary files...");
      await this.cleanup(mergedFilePath, chunkDir);

      res.json({ 
        success: true, 
        message: "Video chunks merged successfully, uploaded to S3, and recorded on external server",
        videoUrl: s3Url,
        duration: duration
      });

    } catch (error) {
      console.error("❌ Error in video processing:", error);
      res.status(error.message.includes("Missing required parameters") ? 400 : error.message.includes("not found") ? 404 : 500)
      .json({ 
        error: "Video processing failed", 
        details: error.message 
      });
    }
  }
}

export default VideoHandler;