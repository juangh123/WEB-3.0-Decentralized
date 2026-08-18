import subprocess
ff = r"C:\Users\Administrator\ffmpeg-extract\ffmpeg-9.0-essentials_build\bin\ffmpeg.exe"
img = r"E:\AI WORK\WEB 3.0 Decentralized\video-production\cards\card-01.png"
out = r"E:\AI WORK\WEB 3.0 Decentralized\video-production\segments\test3.mp4"
W, H, FPS = 1920, 1080, 30
frames = 15 * 30
dur = 15.0
zexpr = "min(zoom+0.0008,1.18)"
xexpr = "x=iw/2-(iw/zoom/2)"
yexpr = "y=ih/2-(ih/zoom/2)"
vf = (
    "scale=2560:1440:force_original_aspect_ratio=increase,"
    "crop=2560:1440,"
    "zoompan=z='{}':d={}:x={}:y={}:s={}x{}:fps={},"
    "format=yuv420p,"
    "fade=t=in:st=0:d=0.4,fade=t=out:st={:.1f}:d=0.5"
).format(zexpr, frames, xexpr, yexpr, W, H, FPS, dur - 0.5)
print("VF>>>", vf)
p = subprocess.run([ff, "-y", "-loop", "1", "-i", img, "-vf", vf, "-t", str(dur), "-r", str(FPS), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", out], capture_output=True, text=True)
print("RC:", p.returncode)
print(p.stderr[-800:])
