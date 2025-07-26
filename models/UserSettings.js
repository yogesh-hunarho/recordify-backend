import mongoose from "mongoose";

const UserSettingsSchema = new mongoose.Schema({
  username: String,
  courseID: Number,
  batchID: Number,
  teacherID:Number,
  userAgent: String,
  availableRam:String,
  platformInfo: {
    arch: String,
    nacl_arch: String,
    os: String,
  },
  manifestInfo: String,
  defaultAudioInput: String,
  defaultVideoInput: String,
  quality: String,
  systemAudio: Boolean,
  audioInput: [
    {
      deviceId: String,
      label: String,
    },
  ],
  backgroundEffectsActive: Boolean,
  recording: Boolean,
  recordingType: String,
  askForPermissions: Boolean,
  cameraPermission: Boolean,
  microphonePermission: Boolean,
  askMicrophone: Boolean,
  cursorMode: String,
  zoomEnabled: Boolean,
  offscreenRecording: Boolean,
  updateChrome: Boolean,
  permissionsChecked: Boolean,
  permissionsLoaded: Boolean,
  hideUI: Boolean,
  alarm: Boolean,
  alarmTime: Number,
  surface: String,
  blurMode: Boolean,
}, { timestamps: true });

export default mongoose.model("UserSettings", UserSettingsSchema);
