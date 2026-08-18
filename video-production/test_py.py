import subprocess, os
ff = r"C:\Users\Administrator\ffmpeg-extract\ffmpeg-9.0-essentials_build\bin\ffmpeg.exe"
img = r"E:\AI WORK\WEB 3.0 Decentralized\video-production\cards\card-01.png"
out = r"E:\AI WORK\WEB 3.0 Decentralized\video-production\segments\test2.mp4"
vf = "scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,zoompan=z='min(zoom+0.0008,1.18)':d=60:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s=1920x1080:fps=30,format=yuv420p"
print("VF:", vf)
p = subprocess.run([ff, "-y", "-loop", "1", "-i", img, "-vf", vf, "-t", "2", "-r", "30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", out], capture_output=True, text=True)
print("RC:", p.returncode)
print(p.stderr[-1200:])
