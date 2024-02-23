import subprocess as sp
import cv2

from rtvideo.common.structs import Frame

# Define the FFmpeg command. This example encodes the video to H.264, segments it for HLS,
# and saves the output to the 'output' directory.

ffmpeg_raw_video_input = [
    '-f', 'rawvideo',  # Input format
    '-vcodec', 'rawvideo',  # Input codec
    '-pix_fmt', 'bgr24',  # Input pixel format
    '-s', '1920x1080',  # Input resolution
    '-re',  # Read input at native, variable frame rate
    '-i', '-',  # Input comes from a pipe
]

ffmpeg_hls_output = [
    '-c:v', 'libx264',  # Output codec
    '-pix_fmt', 'yuv420p',  # Output pixel format
    '-preset', 'veryfast',  # Encoding speed/quality trade-off
    '-g', '15', # Keyframe interval
    '-f', 'hls',  # Output format
    '-flush_packets', '1', # Flush frames immediately
    '-hls_time', '1',  # Segment length in seconds
    '-hls_playlist_type', 'event',  # Playlist type
    'output/stream.m3u8'  # Output HLS playlist and segments
]

ffmpeg_command = [
    'ffmpeg',
    '-y',  # Overwrite output files without asking
    *ffmpeg_raw_video_input,
    *ffmpeg_hls_output
]

HTML_PLAYER = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Fullscreen HLS Video</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<style>
  body {
    margin: 0;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: black;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover; /* This makes the video cover the full screen */
  }
</style>
</head>
<body>

<video id="video" controls autoplay muted></video> <!-- muted is required for autoplay in most browsers -->

<script>
  var video = document.getElementById('video');
  var videoSrc = '/stream.m3u8';

  function setupHls() {
    if (Hls.isSupported()) {
      var hls = new Hls();
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoSrc;
    }
  }

  function toggleFullScreen() {
    if (!document.fullscreenElement) {
      video.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  video.addEventListener('click', toggleFullScreen);
  document.addEventListener('DOMContentLoaded', setupHls);
</script>

</body>
</html>
"""

class HlsSink:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir

    def __str__(self) -> str:
        return f"HlsSink(output_dir={self.output_dir})"
    
    def open(self):
        sp.run(['rm', '-rf', self.output_dir])
        sp.run(['mkdir', '-p', self.output_dir])
        with open(f'{self.output_dir}/index.html', 'w') as f:
            f.write(HTML_PLAYER)
        ffmpeg_command[-1] = f'{self.output_dir}/stream.m3u8'
        self.ffmpeg = sp.Popen(ffmpeg_command, stdin=sp.PIPE)
        self.hls_server = sp.Popen(['python', '-m', 'http.server', '8888'], cwd=self.output_dir)

    def close(self):
        self.hls_server.terminate()
        self.ffmpeg.stdin.close()
        self.hls_server.wait()
        self.ffmpeg.wait()

    def __call__(self, frame: Frame) -> Frame:
        self.ffmpeg.stdin.write(frame.as_bgr().tobytes())
        self.ffmpeg.stdin.flush()
        return frame