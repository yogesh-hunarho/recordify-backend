import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fromEnv }  from "@aws-sdk/credential-providers";  
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

// this is for any video upload with content type
export const getPresignedUrl = async (filename, contentType) => {
  const key = `recording-videos/${new Date().toISOString().split('T')[0]}/${uuidv4()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 60 * 30 });
  return { url, key };
};
