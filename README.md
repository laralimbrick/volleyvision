VolleyVision (p5.js)
A p5.js prototype that annotates volleyball sets from video and reports metrics (peak height, set width). Built for athlete self-analysis and empowerment.

Run locally
First, make sure Visual Studio Code is downloaded onto your desktop. (can get it from this link https://code.visualstudio.com/)
In Github, click on the big green button that says '<>Code', scroll down to the bottom and click 'Download Zip'.
Open the folder in VS Code, go to File ▸ Open Folder…, select the volleyvision_ folder, and you should see these files: index.html sketch.js stupid training.mp4
Click the Extensions icon (left toolbar) in VS Studio (fifth from the bottom), search Live Server (by Ritwick Dey), and click Install.
After that extension is downloaded, go back into the folders, go into the 'index.html' folder, right click and choose the 'Open with Live Server' option.
Click once to start the video, then use:
N = end rep and hide until end
Z = undo point
Space = play/pause
, / . = frame step
S = restart hidden
On first run, follow the on-screen calibration prompts (click net bottom/top at left and right antennae).
Pause video once ball reaches the hands of the setter (second touch), and click the screen. Let the ball reach its peak height in the set, pause the video and click the screen where the ball is again. Finally, let the ball contact the hand of the hitter, pause the video and click the screen where the ball makes contact. Press the 'n' key to start a new rep.
Files
index.html – page and p5.js includes
sketch.js – all prototype logic
stupid training.mp4 – sample video (tracked with Git LFS)
Notes
Large media tracked with Git LFS (GitHub’s 100 MB limit).
