import { Config } from "@remotion/cli/config";

// H.264 MP4 at high quality, ready to upload with the submission. Render with `npm run render`.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
