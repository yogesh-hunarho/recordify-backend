import { DeleteObjectCommand } from "@aws-sdk/client-s3";

router.delete("/videos/:key", async (req, res) => {
  try {
    const Key = decodeURIComponent(req.params.key);

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key,
      })
    );

    res.sendStatus(204);
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Failed to delete");
  }
});
